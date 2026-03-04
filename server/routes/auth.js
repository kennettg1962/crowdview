const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'crowdview_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO User (Email, Password_Hash, Name_Txt) VALUES (?, ?, ?)',
      [email.toLowerCase(), hash, name || '']
    );
    const token = jwt.sign({ userId: result.insertId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, userId: result.insertId, email, name: name || '' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [rows] = await pool.execute('SELECT * FROM User WHERE Email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.Password_Hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.User_Id, email: user.Email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      token,
      userId: user.User_Id,
      email: user.Email,
      name: user.Name_Txt,
      lastSourceDeviceId: user.Last_Source_Device_Id,
      connectLastDevice: user.Connect_Last_Used_Device_After_Login_Fl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  // Stub: in production, send email with reset link
  console.log(`Password reset requested for: ${email}`);
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

module.exports = router;
