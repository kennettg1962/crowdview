'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const operationsAdmin = require('../middleware/operationsAdmin');
const { detectActivity, deviceHeartbeat, DETECT_TTL, HEARTBEAT_TTL, sessionDetectCount } = require('../activity');

// All routes require auth + operations role
router.use(auth, operationsAdmin);

const TOKENS_PER_CALL = 100;

const TIER_ALLOTMENTS = {
  trial:      1000,
  starter:    20000,
  growth:     60000,
  pro:        175000,
  enterprise: 9999999,
};

// ---------------------------------------------------------------------------
// Shared helper: build device list for a given orgId (mirrors corporate dashboard)
// ---------------------------------------------------------------------------
async function buildOrgDashboard(orgId) {
  // Fetch plan fields
  const [orgRows] = await pool.execute(
    `SELECT COALESCE(Plan_Tier_Txt, 'trial') AS Plan_Tier_Txt,
            COALESCE(Token_Allotment_Int, 1000) AS Token_Allotment_Int,
            Plan_Renews_Dt
       FROM Organization WHERE Organization_Id = ?`,
    [orgId]
  );
  const orgPlan = orgRows[0] || { Plan_Tier_Txt: 'trial', Token_Allotment_Int: 1000, Plan_Renews_Dt: null };

  const [users] = await pool.execute(
    `SELECT User_Id, Name_Txt, Email, Corporate_Admin_Fl,
            Detect_Month_Count, Detect_Month_Ref,
            Detect_Year_Count,  Detect_Year_Ref
       FROM User WHERE Parent_Organization_Id = ? ORDER BY Name_Txt`,
    [orgId]
  );

  const [streams] = await pool.execute(
    `SELECT s.User_Id FROM Stream s
       JOIN User u ON u.User_Id = s.User_Id
      WHERE s.Status_Fl = 'live' AND u.Parent_Organization_Id = ?`,
    [orgId]
  );
  const liveUserIds = new Set(streams.map(s => s.User_Id));

  const now      = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearRef  = String(now.getFullYear());

  const devices = users.map(u => {
    const detecting = detectActivity.has(u.User_Id)  && (Date.now() - detectActivity.get(u.User_Id))  < DETECT_TTL;
    const active    = deviceHeartbeat.has(u.User_Id) && (Date.now() - deviceHeartbeat.get(u.User_Id)) < HEARTBEAT_TTL;
    const streaming = liveUserIds.has(u.User_Id);

    let status = 'offline';
    if (detecting)      status = 'detecting';
    else if (streaming) status = 'streaming';
    else if (active)    status = 'active';

    const monthCount = u.Detect_Month_Ref === monthRef ? (u.Detect_Month_Count || 0) : 0;
    const yearCount  = u.Detect_Year_Ref  === yearRef  ? (u.Detect_Year_Count  || 0) : 0;

    return {
      userId:       u.User_Id,
      name:         u.Name_Txt,
      email:        u.Email,
      role:         u.Corporate_Admin_Fl,
      status,
      lastSeen:     deviceHeartbeat.get(u.User_Id) || null,
      sessionCount: sessionDetectCount.get(u.User_Id) || 0,
      monthCount,
      yearCount,
    };
  });

  const monthRawCalls = devices.reduce((sum, d) => sum + d.monthCount, 0);
  const tokensUsed    = Math.floor(monthRawCalls / TOKENS_PER_CALL);

  return {
    planTier:      orgPlan.Plan_Tier_Txt,
    allotment:     orgPlan.Token_Allotment_Int,
    planRenewsDt:  orgPlan.Plan_Renews_Dt,
    tokensUsed,
    monthRawCalls,
    activeDetects: devices.filter(d => d.status === 'detecting').length,
    liveStreams:   liveUserIds.size,
    activeDevices: devices.filter(d => d.status !== 'offline').length,
    totalUsers:    users.length,
    devices,
  };
}

// ---------------------------------------------------------------------------
// GET /api/operations/dashboard  — summary across all organizations
// ---------------------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    const now      = new Date();
    const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Single query: org plan fields + org-level month raw call total
    const [orgRows] = await pool.execute(
      `SELECT o.Organization_Id,
              o.Organization_Name_Txt,
              COALESCE(o.Plan_Tier_Txt, 'trial')   AS Plan_Tier_Txt,
              COALESCE(o.Token_Allotment_Int, 1000) AS Token_Allotment_Int,
              COALESCE(SUM(CASE WHEN u.Detect_Month_Ref = ? THEN u.Detect_Month_Count ELSE 0 END), 0) AS Month_Raw_Calls
         FROM Organization o
         LEFT JOIN User u ON u.Parent_Organization_Id = o.Organization_Id
        GROUP BY o.Organization_Id
        ORDER BY o.Organization_Name_Txt`,
      [monthRef]
    );

    const summaries = await Promise.all(orgRows.map(async org => {
      const orgId = org.Organization_Id;

      const [users] = await pool.execute(
        'SELECT User_Id FROM User WHERE Parent_Organization_Id = ?',
        [orgId]
      );
      const [streams] = await pool.execute(
        `SELECT s.User_Id FROM Stream s
           JOIN User u ON u.User_Id = s.User_Id
          WHERE s.Status_Fl = 'live' AND u.Parent_Organization_Id = ?`,
        [orgId]
      );
      const liveUserIds = new Set(streams.map(s => s.User_Id));

      let activeDetects = 0;
      let activeDevices = 0;
      for (const u of users) {
        const detecting = detectActivity.has(u.User_Id)  && (Date.now() - detectActivity.get(u.User_Id))  < DETECT_TTL;
        const active    = deviceHeartbeat.has(u.User_Id) && (Date.now() - deviceHeartbeat.get(u.User_Id)) < HEARTBEAT_TTL;
        const streaming = liveUserIds.has(u.User_Id);
        if (detecting)                        activeDetects++;
        if (detecting || streaming || active) activeDevices++;
      }

      const monthRawCalls = Number(org.Month_Raw_Calls);
      const tokensUsed    = Math.floor(monthRawCalls / TOKENS_PER_CALL);

      return {
        orgId:         orgId,
        orgName:       org.Organization_Name_Txt,
        planTier:      org.Plan_Tier_Txt,
        allotment:     org.Token_Allotment_Int,
        tokensUsed,
        monthRawCalls,
        activeDetects,
        liveStreams:   liveUserIds.size,
        activeDevices,
        totalUsers:    users.length,
      };
    }));

    res.json(summaries);
  } catch (err) {
    console.error('ops dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/operations/dashboard/:orgId  — per-org detail (mirrors corporate dashboard)
// ---------------------------------------------------------------------------
router.get('/dashboard/:orgId', async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);
    if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

    const result = await buildOrgDashboard(orgId);
    res.json(result);
  } catch (err) {
    console.error('ops org dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/operations/orgs  — list all organizations with user counts
// ---------------------------------------------------------------------------
router.get('/orgs', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.Organization_Id,
              o.Organization_Name_Txt,
              o.Contact_Name_Txt,
              o.Contact_Email_Txt,
              o.Contact_Phone_Txt,
              o.Contact_City_Txt,
              o.Contact_State_Txt,
              o.Contact_Country_Txt,
              o.Description_Multi_Line_Txt,
              o.Created_At,
              COUNT(u.User_Id) as User_Count
         FROM Organization o
         LEFT JOIN User u ON u.Parent_Organization_Id = o.Organization_Id
        GROUP BY o.Organization_Id
        ORDER BY o.Organization_Name_Txt`
    );
    res.json(rows);
  } catch (err) {
    console.error('ops orgs list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/operations/orgs  — create a new organization + admin user
// ---------------------------------------------------------------------------
router.post('/orgs', async (req, res) => {
  const {
    orgName, contactName, contactEmail, contactPhone,
    contactAddress, contactCity, contactState, contactZip, contactCountry,
    description,
    adminEmail, adminPassword, adminName,
  } = req.body;

  if (!orgName)         return res.status(400).json({ error: 'orgName is required' });
  if (!adminEmail)      return res.status(400).json({ error: 'adminEmail is required' });
  if (!adminPassword)   return res.status(400).json({ error: 'adminPassword is required' });
  if (adminPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert organization
    let orgResult;
    try {
      [orgResult] = await conn.execute(
        `INSERT INTO Organization
           (Organization_Name_Txt, Contact_Name_Txt, Contact_Email_Txt, Contact_Phone_Txt,
            Contact_Address_Multi_Line_Txt, Contact_City_Txt, Contact_State_Txt,
            Contact_Zip_Txt, Contact_Country_Txt, Description_Multi_Line_Txt,
            Created_At, Updated_At)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          orgName,
          contactName  || '',
          contactEmail || '',
          contactPhone || '',
          contactAddress || '',
          contactCity    || '',
          contactState   || '',
          contactZip     || '',
          contactCountry || '',
          description    || '',
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        conn.release();
        return res.status(409).json({ error: 'Organization name already exists' });
      }
      throw err;
    }

    const orgId = orgResult.insertId;

    // Insert admin user
    const hash = await bcrypt.hash(adminPassword, 10);
    let userResult;
    try {
      [userResult] = await conn.execute(
        `INSERT INTO User
           (Email, Password_Hash, Name_Txt, Corporate_Admin_Fl,
            Connect_Last_Used_Device_After_Login_Fl, Parent_Organization_Id)
         VALUES (?, ?, ?, 'Y', 'Y', ?)`,
        [adminEmail.toLowerCase(), hash, adminName || '', orgId]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        conn.release();
        return res.status(409).json({ error: 'Admin email already registered' });
      }
      throw err;
    }

    // Seed default customer tiers
    const defaultTiers = [
      ['Security Risk', '#111827', 0],
      ['Standard',      '#22c55e', 1],
      ['Silver',        '#9ca3af', 2],
      ['Gold',          '#f59e0b', 3],
      ['Platinum',      '#3b82f6', 4],
      ['VIP',           '#a855f7', 5],
    ];
    for (const [tierName, tierColor, sortOrder] of defaultTiers) {
      await conn.execute(
        'INSERT INTO Organization_Customer_Tier (Organization_Id, Tier_Name_Txt, Tier_Color_Txt, Sort_Order) VALUES (?, ?, ?, ?)',
        [orgId, tierName, tierColor, sortOrder]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({ orgId, userId: userResult.insertId });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('ops create org error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/operations/orgs/:id  — update organization details
// ---------------------------------------------------------------------------
router.put('/orgs/:id', async (req, res) => {
  const orgId = Number(req.params.id);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  const {
    orgName, contactName, contactEmail, contactPhone,
    contactAddress, contactCity, contactState, contactZip, contactCountry,
    description,
  } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE Organization
          SET Organization_Name_Txt            = ?,
              Contact_Name_Txt                 = ?,
              Contact_Email_Txt                = ?,
              Contact_Phone_Txt                = ?,
              Contact_Address_Multi_Line_Txt   = ?,
              Contact_City_Txt                 = ?,
              Contact_State_Txt                = ?,
              Contact_Zip_Txt                  = ?,
              Contact_Country_Txt              = ?,
              Description_Multi_Line_Txt       = ?,
              Updated_At                       = NOW()
        WHERE Organization_Id = ?`,
      [
        orgName        || '',
        contactName    || '',
        contactEmail   || '',
        contactPhone   || '',
        contactAddress || '',
        contactCity    || '',
        contactState   || '',
        contactZip     || '',
        contactCountry || '',
        description    || '',
        orgId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ message: 'Organization updated' });
  } catch (err) {
    console.error('ops update org error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/operations/orgs/:id/plan  — set plan tier + token allotment
// ---------------------------------------------------------------------------
router.put('/orgs/:id/plan', async (req, res) => {
  const orgId = Number(req.params.id);
  if (!orgId) return res.status(400).json({ error: 'Invalid orgId' });

  const { planTier, tokenAllotment } = req.body;
  if (!planTier) return res.status(400).json({ error: 'planTier required' });

  const allotment = tokenAllotment != null
    ? Number(tokenAllotment)
    : (TIER_ALLOTMENTS[planTier] ?? 1000);

  try {
    await pool.execute(
      'UPDATE Organization SET Plan_Tier_Txt = ?, Token_Allotment_Int = ? WHERE Organization_Id = ?',
      [planTier, allotment, orgId]
    );
    res.json({ planTier, tokenAllotment: allotment });
  } catch (err) {
    console.error('ops update plan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
