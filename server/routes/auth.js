const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/connection');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'crowdview_secret';
const JWT_EXPIRES_INDIVIDUAL = process.env.JWT_EXPIRES_IN || '7d';
const JWT_EXPIRES_CORPORATE  = process.env.JWT_EXPIRES_IN_CORPORATE || '1d';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO User (Email, Password_Hash, Name_Txt) VALUES (?, ?, ?)',
      [email.toLowerCase(), hash, name || '']
    );
    const token = jwt.sign({ userId: result.insertId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_INDIVIDUAL });
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
    const payload = {
      userId: user.User_Id,
      email: user.Email,
      parentOrganizationId: user.Parent_Organization_Id || null,
      corporateAdminFl: user.Corporate_Admin_Fl || 'N',
    };
    const expiresIn = payload.parentOrganizationId ? JWT_EXPIRES_CORPORATE : JWT_EXPIRES_INDIVIDUAL;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
    res.json({
      token,
      userId: user.User_Id,
      email: user.Email,
      name: user.Name_Txt,
      lastSourceDeviceId: user.Last_Source_Device_Id,
      connectLastDevice: user.Connect_Last_Used_Device_After_Login_Fl,
      parentOrganizationId: user.Parent_Organization_Id || null,
      corporateAdminFl: user.Corporate_Admin_Fl || 'N',
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
  try {
    const [rows] = await pool.execute(
      'SELECT User_Id, Parent_Organization_Id, Corporate_Admin_Fl FROM User WHERE Email = ?',
      [email.toLowerCase()]
    );
    // Always respond with success to prevent email enumeration
    if (!rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    // Corporate non-admin users cannot self-serve password reset — the OAU resets for them
    const user = rows[0];
    if (user.Parent_Organization_Id && user.Corporate_Admin_Fl !== 'Y') {
      return res.status(403).json({ error: 'Contact your administrator to reset your password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.execute(
      'UPDATE User SET Password_Reset_Token = ?, Password_Reset_Expires = ? WHERE User_Id = ?',
      [token, expires, user.User_Id]
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    // Send email via nodemailer if SMTP is configured, otherwise log to console
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'CrowdView – Reset Your Password',
          html: `
            <p>Hi,</p>
            <p>You requested a password reset for your CrowdView account.</p>
            <p><a href="${resetUrl}" style="color:#2563eb;font-weight:bold;">Click here to reset your password</a></p>
            <p>This link expires in 1 hour.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
          `
        });
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
      }
    } else {
      console.log(`[Password Reset] No SMTP configured. Reset URL for ${email}:\n${resetUrl}`);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const [rows] = await pool.execute(
      'SELECT User_Id FROM User WHERE Password_Reset_Token = ? AND Password_Reset_Expires > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE User SET Password_Hash = ?, Password_Reset_Token = NULL, Password_Reset_Expires = NULL WHERE User_Id = ?',
      [hash, rows[0].User_Id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
