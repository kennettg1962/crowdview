const express = require('express');
const router  = express.Router();
const pool    = require('../db/connection');
const auth    = require('../middleware/auth');

// ── Tier definitions ──────────────────────────────────────────────────────────
// liveMinutes: -1 = unlimited.  trialDays only on 'trial' tier.
const TIERS = {
  trial:    { liveMinutes: 600,  unlimited: false, trialDays: 30, price: 0 },
  lite:     { liveMinutes: 0,    unlimited: false, price: 2.99 },
  personal: { liveMinutes: 600,  unlimited: false, price: 5.99 },
  plus:     { liveMinutes: 7200, unlimited: false, price: 19.99 },
  power:    { liveMinutes: -1,   unlimited: true,  price: 49.99 },
};
const TOPUP_MINUTES = 1200;   // 20 hours per top-up purchase

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierConfig(tierTxt) {
  return TIERS[tierTxt] || TIERS.trial;
}

// Roll the billing period forward if 30 days have elapsed.
// Archives the old period to Subscription_History, resets counters.
async function maybeRollPeriod(conn, sub) {
  const periodStart = new Date(sub.Period_Start_Dt);
  const now         = new Date();
  const daysSince   = Math.floor((now - periodStart) / 86400000);
  if (daysSince < 30) return sub; // still within period

  // Archive closed period
  await conn.execute(
    `INSERT INTO Subscription_History
       (User_Id, Tier_Txt, Period_Start_Dt, Period_End_Dt,
        Live_Minutes_Alloc_Int, Live_Minutes_Used_Int, Topup_Minutes_Int)
     VALUES (?, ?, ?, CURDATE(), ?, ?, ?)`,
    [sub.User_Id, sub.Tier_Txt, sub.Period_Start_Dt,
     sub.Live_Minutes_Alloc_Int, sub.Live_Minutes_Used_Int, sub.Live_Minutes_Topup_Int]
  );

  // Check trial expiry — after 30 days trial drops to lite behaviour
  let newTier = sub.Tier_Txt;
  if (sub.Tier_Txt === 'trial') newTier = 'lite';
  const cfg = tierConfig(newTier);

  await conn.execute(
    `UPDATE User_Subscription
     SET Tier_Txt = ?, Period_Start_Dt = CURDATE(),
         Live_Minutes_Alloc_Int = ?, Live_Minutes_Used_Int = 0,
         Live_Minutes_Topup_Int = 0
     WHERE User_Id = ?`,
    [newTier, cfg.liveMinutes, sub.User_Id]
  );

  // Return refreshed row
  const [rows] = await conn.execute(
    'SELECT * FROM User_Subscription WHERE User_Id = ?', [sub.User_Id]);
  return rows[0];
}

// Build the status object returned to the client
function buildStatus(sub) {
  const cfg      = tierConfig(sub.Tier_Txt);
  const alloc    = sub.Live_Minutes_Alloc_Int;
  const used     = sub.Live_Minutes_Used_Int;
  const topup    = sub.Live_Minutes_Topup_Int;
  const total    = alloc === -1 ? -1 : alloc + topup;
  const remaining = total === -1 ? -1 : Math.max(0, total - used);
  const canUseLive = cfg.unlimited || remaining > 0;

  // Trial days remaining
  let trialDaysLeft = null;
  if (sub.Tier_Txt === 'trial') {
    const trialStart  = new Date(sub.Trial_Started_At);
    const elapsed     = Math.floor((Date.now() - trialStart) / 86400000);
    trialDaysLeft     = Math.max(0, 30 - elapsed);
  }

  return {
    tier:           sub.Tier_Txt,
    periodStart:    sub.Period_Start_Dt,
    minutesAlloc:   alloc,
    minutesUsed:    used,
    minutesTopup:   topup,
    minutesTotal:   total,
    minutesRemaining: remaining,
    isUnlimited:    cfg.unlimited,
    canUseLive,
    trialDaysLeft,
    price:          cfg.price,
  };
}

// ── POST /api/subscription/provision ─────────────────────────────────────────
// Called once from signup — creates the trial subscription.
// Not authenticated (called with the new userId immediately after insert).
async function provisionTrial(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT IGNORE INTO User_Subscription
         (User_Id, Tier_Txt, Period_Start_Dt, Live_Minutes_Alloc_Int,
          Live_Minutes_Used_Int, Live_Minutes_Topup_Int, Trial_Started_At)
       VALUES (?, 'trial', CURDATE(), 600, 0, 0, NOW())`,
      [userId]
    );
  } finally {
    conn.release();
  }
}

// ── GET /api/subscription/status ─────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  // Corporate users are not subject to individual subscription limits
  if (req.user.parentOrganizationId) {
    return res.json({ tier: 'corporate', canUseLive: true, isUnlimited: true });
  }

  const conn = await pool.getConnection();
  try {
    let [rows] = await conn.execute(
      'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);

    // Provision on first call if missing (legacy accounts)
    if (!rows.length) {
      await provisionTrial(req.user.userId);
      [rows] = await conn.execute(
        'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);
    }

    let sub = rows[0];
    sub = await maybeRollPeriod(conn, sub);
    res.json(buildStatus(sub));
  } catch (err) {
    console.error('[subscription/status]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/subscription/live/start ────────────────────────────────────────
// Called when the user clicks the Live button ON.
// Returns { sessionId, canUseLive, minutesRemaining }.
router.post('/live/start', auth, async (req, res) => {
  if (req.user.parentOrganizationId) {
    return res.json({ sessionId: null, canUseLive: true, minutesRemaining: -1 });
  }

  const conn = await pool.getConnection();
  try {
    let [rows] = await conn.execute(
      'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);
    if (!rows.length) {
      await provisionTrial(req.user.userId);
      [rows] = await conn.execute(
        'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);
    }
    let sub = rows[0];
    sub = await maybeRollPeriod(conn, sub);

    const status = buildStatus(sub);
    if (!status.canUseLive) {
      return res.status(403).json({
        error: 'No live minutes remaining',
        canUseLive: false,
        minutesRemaining: 0,
      });
    }

    const [result] = await conn.execute(
      'INSERT INTO Live_Session_Log (User_Id, Started_At) VALUES (?, NOW())',
      [req.user.userId]
    );
    res.json({
      sessionId:        result.insertId,
      canUseLive:       true,
      minutesRemaining: status.minutesRemaining,
      isUnlimited:      status.isUnlimited,
    });
  } catch (err) {
    console.error('[subscription/live/start]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/subscription/live/end ──────────────────────────────────────────
// Called when the user clicks Live OFF or navigates away.
// Body: { sessionId }
router.post('/live/end', auth, async (req, res) => {
  if (req.user.parentOrganizationId) return res.json({ ok: true });

  const { sessionId } = req.body;
  if (!sessionId) return res.json({ ok: true });

  const conn = await pool.getConnection();
  try {
    // Close the session and compute duration
    await conn.execute(
      `UPDATE Live_Session_Log
       SET Ended_At = NOW(),
           Duration_Seconds_Int = TIMESTAMPDIFF(SECOND, Started_At, NOW())
       WHERE Session_Id = ? AND User_Id = ? AND Ended_At IS NULL`,
      [sessionId, req.user.userId]
    );

    // Read back the actual duration
    const [sessions] = await conn.execute(
      'SELECT Duration_Seconds_Int FROM Live_Session_Log WHERE Session_Id = ?',
      [sessionId]
    );
    const seconds = sessions[0]?.Duration_Seconds_Int || 0;
    const minutes = Math.ceil(seconds / 60); // round up to nearest minute

    if (minutes > 0) {
      await conn.execute(
        `UPDATE User_Subscription
         SET Live_Minutes_Used_Int = Live_Minutes_Used_Int + ?
         WHERE User_Id = ?`,
        [minutes, req.user.userId]
      );
    }

    // Return fresh status
    const [rows] = await conn.execute(
      'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);
    const status = rows.length ? buildStatus(rows[0]) : { minutesRemaining: 0 };
    res.json({ ok: true, minutesUsedThisSession: minutes, minutesRemaining: status.minutesRemaining });
  } catch (err) {
    console.error('[subscription/live/end]', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/subscription/detection ─────────────────────────────────────────
// Log a detection API call for analytics. Body: { type } ('id'|'live'|'snap')
router.post('/detection', auth, async (req, res) => {
  const type = ['id', 'live', 'snap'].includes(req.body.type) ? req.body.type : 'id';
  try {
    await pool.execute(
      'INSERT INTO Detection_Call_Log (User_Id, Detection_Type_Txt) VALUES (?, ?)',
      [req.user.userId, type]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[subscription/detection]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/subscription/history ────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT Tier_Txt, Period_Start_Dt, Period_End_Dt,
              Live_Minutes_Alloc_Int, Live_Minutes_Used_Int, Topup_Minutes_Int
       FROM Subscription_History
       WHERE User_Id = ?
       ORDER BY Period_Start_Dt DESC
       LIMIT 24`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[subscription/history]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/subscription/topup ─────────────────────────────────────────────
// Purchase 20 hrs (1,200 min) of additional live time.
// Payment processing is a stub — integrate Stripe etc. here.
router.post('/topup', auth, async (req, res) => {
  if (req.user.parentOrganizationId) {
    return res.status(400).json({ error: 'Top-ups not available for corporate accounts' });
  }
  try {
    // TODO: process payment here before crediting minutes
    await pool.execute(
      `UPDATE User_Subscription
       SET Live_Minutes_Topup_Int = Live_Minutes_Topup_Int + ?
       WHERE User_Id = ?`,
      [TOPUP_MINUTES, req.user.userId]
    );
    const [rows] = await pool.execute(
      'SELECT * FROM User_Subscription WHERE User_Id = ?', [req.user.userId]);
    res.json({ ok: true, ...buildStatus(rows[0]) });
  } catch (err) {
    console.error('[subscription/topup]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, provisionTrial };
