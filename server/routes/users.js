const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { deviceHeartbeat } = require('../activity');

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT User_Id, Email, Name_Txt, Last_Source_Device_Id, Connect_Last_Used_Device_After_Login_Fl, User_Level, Inmo_Air3_Enabled_Fl, Meta_Glasses_Enabled_Fl FROM User WHERE User_Id = ?',
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  const { name, password, connectLastDevice, lastSourceDeviceId, inmoAir3Enabled, metaGlassesEnabled } = req.body;
  try {
    let passwordHash;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('Name_Txt = ?'); values.push(name); }
    if (passwordHash) { fields.push('Password_Hash = ?'); values.push(passwordHash); }
    if (connectLastDevice !== undefined) { fields.push('Connect_Last_Used_Device_After_Login_Fl = ?'); values.push(connectLastDevice); }
    if (lastSourceDeviceId !== undefined) { fields.push('Last_Source_Device_Id = ?'); values.push(lastSourceDeviceId); }
    if (inmoAir3Enabled !== undefined) { fields.push('Inmo_Air3_Enabled_Fl = ?'); values.push(inmoAir3Enabled ? 'Y' : 'N'); }
    if (metaGlassesEnabled !== undefined) { fields.push('Meta_Glasses_Enabled_Fl = ?'); values.push(metaGlassesEnabled ? 'Y' : 'N'); }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.user.userId);
    await pool.execute(`UPDATE User SET ${fields.join(', ')} WHERE User_Id = ?`, values);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/heartbeat  — called every 15 s from HubScreen while camera
// is active; feeds the corporate real-time dashboard
// ---------------------------------------------------------------------------
router.post('/heartbeat', auth, (req, res) => {
  deviceHeartbeat.set(req.user.userId, Date.now());
  res.json({ ok: true });
});

module.exports = router;
