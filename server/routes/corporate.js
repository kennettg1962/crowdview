'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const corporateAdmin = require('../middleware/corporateAdmin');
const { detectActivity, deviceHeartbeat, DETECT_TTL, HEARTBEAT_TTL, sessionDetectCount } = require('../activity');
const { indexEmployeeFace, deleteFaces } = require('../rekognition');

const empUpload = multer({ storage: multer.memoryStorage() });

// All routes require auth + OAU role
router.use(auth, corporateAdmin);

// Helper: verify the target user belongs to the OAU's organisation
async function getOrgUser(userId, orgId) {
  const [rows] = await pool.execute(
    'SELECT User_Id, Email, Name_Txt, Connect_Last_Used_Device_After_Login_Fl, Corporate_Admin_Fl FROM User WHERE User_Id = ? AND Parent_Organization_Id = ?',
    [userId, orgId]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// GET /api/corporate/users  — list all users in the OAU's organisation
// ---------------------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT User_Id, Email, Name_Txt, Connect_Last_Used_Device_After_Login_Fl, Corporate_Admin_Fl, Created_At
         FROM User
        WHERE Parent_Organization_Id = ?
        ORDER BY Name_Txt ASC`,
      [req.user.parentOrganizationId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corporate/users  — add a new user to the organisation
// ---------------------------------------------------------------------------
router.post('/users', async (req, res) => {
  const { email, password, name, connectLastDevice, corporateAdminFl } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO User
         (Email, Password_Hash, Name_Txt, Connect_Last_Used_Device_After_Login_Fl, Corporate_Admin_Fl, Parent_Organization_Id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        email.toLowerCase(),
        hash,
        name || '',
        connectLastDevice === 'Y' ? 'Y' : 'Y', // default Y per spec
        ['Y', 'B'].includes(corporateAdminFl) ? corporateAdminFl : 'N',
        req.user.parentOrganizationId,
      ]
    );
    res.status(201).json({ userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/corporate/users/:id  — update a user in the organisation
// ---------------------------------------------------------------------------
router.put('/users/:id', async (req, res) => {
  const { name, connectLastDevice, corporateAdminFl } = req.body;
  const targetId = req.params.id;

  // Prevent OAU demoting themselves
  if (String(targetId) === String(req.user.userId) && corporateAdminFl === 'N') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }

  try {
    const target = await getOrgUser(targetId, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await pool.execute(
      `UPDATE User
          SET Name_Txt = ?,
              Connect_Last_Used_Device_After_Login_Fl = ?,
              Corporate_Admin_Fl = ?
        WHERE User_Id = ? AND Parent_Organization_Id = ?`,
      [
        name || '',
        connectLastDevice === 'Y' ? 'Y' : 'N',
        ['Y', 'B'].includes(corporateAdminFl) ? corporateAdminFl : 'N',
        targetId,
        req.user.parentOrganizationId,
      ]
    );
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/corporate/users/:id  — remove a user from the organisation
// ---------------------------------------------------------------------------
router.delete('/users/:id', async (req, res) => {
  const targetId = req.params.id;
  if (String(targetId) === String(req.user.userId)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const target = await getOrgUser(targetId, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting the last admin in the org
    if (target.Corporate_Admin_Fl === 'Y') {
      const [[{ adminCount }]] = await pool.execute(
        'SELECT COUNT(*) AS adminCount FROM User WHERE Parent_Organization_Id = ? AND Corporate_Admin_Fl = ?',
        [req.user.parentOrganizationId, 'Y']
      );
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only admin user for this organization' });
      }
    }

    await pool.execute('DELETE FROM User WHERE User_Id = ? AND Parent_Organization_Id = ?', [targetId, req.user.parentOrganizationId]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corporate/users/:id/reset-password  — OAU sets a new password
// ---------------------------------------------------------------------------
router.post('/users/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const target = await getOrgUser(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE User SET Password_Hash = ?, Password_Reset_Token = NULL, Password_Reset_Expires = NULL WHERE User_Id = ?',
      [hash, req.params.id]
    );
    res.json({ message: 'Password reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/dashboard  — real-time activity dashboard for OAU
// ---------------------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.user.parentOrganizationId;

    // All users in the org (include detect counters)
    const [users] = await pool.execute(
      `SELECT User_Id, Name_Txt, Email, Corporate_Admin_Fl,
              Detect_Month_Count, Detect_Month_Ref,
              Detect_Year_Count,  Detect_Year_Ref
         FROM User WHERE Parent_Organization_Id = ? ORDER BY Name_Txt`,
      [orgId]
    );

    // Live streams for the org
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

    // Build device list with status + detection counts
    const devices = users.map(u => {
      const detecting  = detectActivity.has(u.User_Id)  && (Date.now() - detectActivity.get(u.User_Id))  < DETECT_TTL;
      const active     = deviceHeartbeat.has(u.User_Id) && (Date.now() - deviceHeartbeat.get(u.User_Id)) < HEARTBEAT_TTL;
      const streaming  = liveUserIds.has(u.User_Id);

      let status = 'offline';
      if (detecting)       status = 'detecting';
      else if (streaming)  status = 'streaming';
      else if (active)     status = 'active';

      // Month/year counts reset automatically if the ref doesn't match current period
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

    res.json({
      activeDetects:  devices.filter(d => d.status === 'detecting').length,
      liveStreams:    liveUserIds.size,
      activeDevices:  devices.filter(d => d.status !== 'offline').length,
      totalUsers:     users.length,
      devices,
    });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Employee helpers
// ---------------------------------------------------------------------------
async function getOrgEmployee(employeeId, orgId) {
  const [rows] = await pool.execute(
    'SELECT * FROM Organization_Employee WHERE Organization_Employee_Id = ? AND Organization_Id = ?',
    [employeeId, orgId]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// GET /api/corporate/employees  — list all employees in the org
// ---------------------------------------------------------------------------
router.get('/employees', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT e.Organization_Employee_Id, e.Employee_Nm, e.Login_Cd, e.Created_At,
              COUNT(p.Organization_Employee_Photo_Id) AS Photo_Count
         FROM Organization_Employee e
         LEFT JOIN Organization_Employee_Photo p ON p.Organization_Employee_Id = e.Organization_Employee_Id
        WHERE e.Organization_Id = ?
        GROUP BY e.Organization_Employee_Id, e.Employee_Nm, e.Login_Cd, e.Created_At
        ORDER BY e.Employee_Nm ASC`,
      [req.user.parentOrganizationId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/employees/dashboard  — attendance stats per employee
// IMPORTANT: must be defined before /employees/:id routes
// ---------------------------------------------------------------------------
router.get('/employees/dashboard', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         e.Organization_Employee_Id AS employeeId,
         e.Employee_Nm              AS employeeName,
         e.Login_Cd                 AS loginCode,
         COUNT(DISTINCT CASE WHEN a.Attendance_Dt >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
                             THEN a.Attendance_Dt END) AS weekCount,
         COUNT(DISTINCT CASE WHEN a.Attendance_Dt >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                             THEN a.Attendance_Dt END) AS monthCount,
         COUNT(DISTINCT CASE WHEN a.Attendance_Dt >= DATE_FORMAT(CURDATE(), '%Y-01-01')
                             THEN a.Attendance_Dt END) AS yearCount
       FROM Organization_Employee e
       LEFT JOIN Organization_Employee_Attendance a
              ON a.Organization_Employee_Id = e.Organization_Employee_Id
       WHERE e.Organization_Id = ?
       GROUP BY e.Organization_Employee_Id, e.Employee_Nm, e.Login_Cd
       ORDER BY e.Employee_Nm ASC`,
      [req.user.parentOrganizationId]
    );
    res.json(rows);
  } catch (err) {
    console.error('employee dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corporate/employees  — create employee
// ---------------------------------------------------------------------------
router.post('/employees', async (req, res) => {
  const { employeeName, loginCode, password } = req.body;
  if (!employeeName || !loginCode || !password)
    return res.status(400).json({ error: 'Name, login code and password required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const now = new Date();
    const [result] = await pool.execute(
      `INSERT INTO Organization_Employee
         (Organization_Id, Login_Cd, Login_Password_Hash, Employee_Nm, Created_At, Updated_At)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.parentOrganizationId, loginCode, hash, employeeName, now, now]
    );
    res.status(201).json({ employeeId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Login code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/corporate/employees/:id  — update employee name / login code
// ---------------------------------------------------------------------------
router.put('/employees/:id', async (req, res) => {
  const { employeeName, loginCode } = req.body;
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    await pool.execute(
      `UPDATE Organization_Employee
          SET Employee_Nm = ?, Login_Cd = ?, Updated_At = ?
        WHERE Organization_Employee_Id = ?`,
      [employeeName || target.Employee_Nm, loginCode || target.Login_Cd, new Date(), req.params.id]
    );
    res.json({ message: 'Employee updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Login code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/corporate/employees/:id  — delete employee
// ---------------------------------------------------------------------------
router.delete('/employees/:id', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });

    // Remove face collection entries first
    const [photos] = await pool.execute(
      'SELECT Rekognition_Face_Id FROM Organization_Employee_Photo WHERE Organization_Employee_Id = ? AND Rekognition_Face_Id IS NOT NULL',
      [req.params.id]
    );
    const faceIds = photos.map(p => p.Rekognition_Face_Id).filter(Boolean);
    if (faceIds.length) deleteFaces(faceIds).catch(err => console.error('deleteFaces:', err.message));

    await pool.execute(
      'DELETE FROM Organization_Employee WHERE Organization_Employee_Id = ? AND Organization_Id = ?',
      [req.params.id, req.user.parentOrganizationId]
    );
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corporate/employees/:id/reset-password
// ---------------------------------------------------------------------------
router.post('/employees/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE Organization_Employee SET Login_Password_Hash = ?, Updated_At = ? WHERE Organization_Employee_Id = ?',
      [hash, new Date(), req.params.id]
    );
    res.json({ message: 'Password reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/employees/:id/photos  — list employee photos
// ---------------------------------------------------------------------------
router.get('/employees/:id/photos', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [rows] = await pool.execute(
      `SELECT Organization_Employee_Photo_Id, Photo_Mime_Type, Created_At
         FROM Organization_Employee_Photo
        WHERE Organization_Employee_Id = ?
        ORDER BY Created_At ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corporate/employees/:id/photos  — upload photo + index face
// ---------------------------------------------------------------------------
router.post('/employees/:id/photos', empUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Photo file required' });
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [result] = await pool.execute(
      'INSERT INTO Organization_Employee_Photo (Organization_Employee_Id, Photo_Data, Photo_Mime_Type) VALUES (?, ?, ?)',
      [req.params.id, req.file.buffer, req.file.mimetype]
    );
    const photoId = result.insertId;
    indexEmployeeFace(req.file.buffer, req.user.parentOrganizationId, req.params.id, photoId)
      .then(faceId => {
        if (faceId) {
          return pool.execute(
            'UPDATE Organization_Employee_Photo SET Rekognition_Face_Id = ? WHERE Organization_Employee_Photo_Id = ?',
            [faceId, photoId]
          );
        }
      })
      .catch(err => console.error('indexEmployeeFace error:', err.message));
    res.status(201).json({ photoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/corporate/employees/:id/photos/:pid
// ---------------------------------------------------------------------------
router.delete('/employees/:id/photos/:pid', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [photoRows] = await pool.execute(
      'SELECT Rekognition_Face_Id FROM Organization_Employee_Photo WHERE Organization_Employee_Photo_Id = ? AND Organization_Employee_Id = ?',
      [req.params.pid, req.params.id]
    );
    if (photoRows.length && photoRows[0].Rekognition_Face_Id) {
      deleteFaces([photoRows[0].Rekognition_Face_Id]).catch(err => console.error('deleteFaces:', err.message));
    }
    const [result] = await pool.execute(
      'DELETE FROM Organization_Employee_Photo WHERE Organization_Employee_Photo_Id = ? AND Organization_Employee_Id = ?',
      [req.params.pid, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Photo not found' });
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/employees/:id/photos/primary/data  — first photo blob
// IMPORTANT: must be defined before /:id/photos/:pid/data
// ---------------------------------------------------------------------------
router.get('/employees/:id/photos/primary/data', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [rows] = await pool.execute(
      `SELECT Photo_Data, Photo_Mime_Type FROM Organization_Employee_Photo
        WHERE Organization_Employee_Id = ? ORDER BY Created_At ASC LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).end();
    res.set('Content-Type', rows[0].Photo_Mime_Type || 'image/jpeg');
    res.send(rows[0].Photo_Data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/employees/:id/photos/:pid/data  — serve photo blob
// ---------------------------------------------------------------------------
router.get('/employees/:id/photos/:pid/data', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [rows] = await pool.execute(
      'SELECT Photo_Data, Photo_Mime_Type FROM Organization_Employee_Photo WHERE Organization_Employee_Photo_Id = ? AND Organization_Employee_Id = ?',
      [req.params.pid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    res.set('Content-Type', rows[0].Photo_Mime_Type || 'image/jpeg');
    res.send(rows[0].Photo_Data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/corporate/employees/:id/attendance  — date drilldown for one employee
// ---------------------------------------------------------------------------
router.get('/employees/:id/attendance', async (req, res) => {
  try {
    const target = await getOrgEmployee(req.params.id, req.user.parentOrganizationId);
    if (!target) return res.status(404).json({ error: 'Employee not found' });
    const [rows] = await pool.execute(
      `SELECT Attendance_Dt FROM Organization_Employee_Attendance
        WHERE Organization_Employee_Id = ?
        ORDER BY Attendance_Dt DESC`,
      [req.params.id]
    );
    res.json(rows.map(r => r.Attendance_Dt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
