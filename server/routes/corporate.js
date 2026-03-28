'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const corporateAdmin = require('../middleware/corporateAdmin');

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

module.exports = router;
