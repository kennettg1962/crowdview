const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/connection');
require('dotenv').config();

const { sessionDetectCount } = require('../activity');
const { provisionTrial }    = require('./subscription');
const JWT_SECRET = process.env.JWT_SECRET || 'crowdview_secret';
const JWT_EXPIRES_INDIVIDUAL = process.env.JWT_EXPIRES_IN || '7d';
const JWT_EXPIRES_CORPORATE  = process.env.JWT_EXPIRES_IN_CORPORATE || '1d';

// ── Shared email helper ──────────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  } else {
    console.log(`[Email] No SMTP configured. Would send to ${to}:\n${subject}`);
  }
}

// POST /api/auth/register  — trial / self-signup (creates org + admin user)
router.post('/register', async (req, res) => {
  const {
    organizationName, addressLn1, city, state, zipCd, country,
    contactName, contactEmail, contactPhone,
    password, confirmPassword
  } = req.body;

  if (!organizationName || !contactName || !contactEmail || !password) {
    return res.status(400).json({ error: 'Organization name, contact name, email and password are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Create organization
    const [orgResult] = await conn.execute(
      `INSERT INTO Organization
         (Organization_Name_Txt, Contact_Address_Multi_Line_Txt, Contact_City_Txt,
          Contact_State_Txt, Contact_Zip_Txt, Contact_Country_Txt,
          Contact_Name_Txt, Contact_Email_Txt, Contact_Phone_Txt,
          Created_At, Updated_At)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        organizationName, addressLn1 || '', city || '', state || '',
        zipCd || '', country || '',
        contactName, contactEmail.toLowerCase(), contactPhone || ''
      ]
    );
    const orgId = orgResult.insertId;

    // Create admin user
    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [userResult] = await conn.execute(
      `INSERT INTO User
         (Email, Password_Hash, Name_Txt, Parent_Organization_Id,
          Corporate_Admin_Fl, Email_Verified_Fl, Email_Verify_Token_Txt, Email_Verify_Expires_Dt)
       VALUES (?, ?, ?, ?, 'Y', 'N', ?, ?)`,
      [contactEmail.toLowerCase(), hash, contactName, orgId, verifyToken, verifyExpires]
    );

    await conn.commit();

    // Send verification email
    const clientUrl = process.env.CLIENT_URL || 'https://crowdview.tv';
    const verifyUrl = `${clientUrl}/verify-email?token=${verifyToken}`;
    try {
      await sendMail({
        to: contactEmail,
        subject: 'CrowdView – Verify your email address',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;">
            <h2 style="color:#0052ff;">Welcome to CrowdView, ${contactName}!</h2>
            <p>Your organisation <strong>${organizationName}</strong> has been created.</p>
            <p>Please verify your email address to activate your account:</p>
            <p style="margin:24px 0;">
              <a href="${verifyUrl}"
                 style="background:#0052ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
                Verify my email
              </a>
            </p>
            <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you did not sign up for CrowdView, you can safely ignore this email.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr.message);
    }

    res.status(201).json({ message: 'Account created. Please check your email to verify your address.' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('Organization_Name')) return res.status(409).json({ error: 'An organisation with that name already exists' });
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const [rows] = await pool.execute(
      'SELECT User_Id FROM User WHERE Email_Verify_Token_Txt = ? AND Email_Verify_Expires_Dt > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired verification link.' });
    await pool.execute(
      'UPDATE User SET Email_Verified_Fl = \'Y\', Email_Verify_Token_Txt = NULL, Email_Verify_Expires_Dt = NULL WHERE User_Id = ?',
      [rows[0].User_Id]
    );
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const [rows] = await pool.execute(
      "SELECT User_Id, Name_Txt FROM User WHERE Email = ? AND Email_Verified_Fl = 'N'",
      [email.toLowerCase()]
    );
    // Always respond with success to prevent enumeration
    if (!rows.length) return res.json({ message: 'If that email is awaiting verification, a new link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      'UPDATE User SET Email_Verify_Token_Txt = ?, Email_Verify_Expires_Dt = ? WHERE User_Id = ?',
      [token, expires, rows[0].User_Id]
    );

    const clientUrl = process.env.CLIENT_URL || 'https://crowdview.tv';
    const verifyUrl = `${clientUrl}/verify-email?token=${token}`;
    try {
      await sendMail({
        to: email,
        subject: 'CrowdView – Verify your email address',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;">
            <h2 style="color:#0052ff;">Verify your email</h2>
            <p>Hi ${rows[0].Name_Txt || ''},</p>
            <p>Here is your new verification link:</p>
            <p style="margin:24px 0;">
              <a href="${verifyUrl}"
                 style="background:#0052ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
                Verify my email
              </a>
            </p>
            <p style="color:#666;font-size:13px;">This link expires in 24 hours.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Resend verification email failed:', emailErr.message);
    }
    res.json({ message: 'If that email is awaiting verification, a new link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [result] = await pool.execute(
      "INSERT INTO User (Email, Password_Hash, Name_Txt, Email_Verified_Fl, Email_Verify_Token_Txt, Email_Verify_Expires_Dt) VALUES (?, ?, ?, 'N', ?, ?)",
      [email.toLowerCase(), hash, name || '', verifyToken, verifyExpires]
    );
    const clientUrl = process.env.CLIENT_URL || 'https://crowdview.tv';
    const verifyUrl = `${clientUrl}/verify-email?token=${verifyToken}`;
    try {
      await sendMail({
        to: email,
        subject: 'CrowdView – Verify your email address',
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;">
            <h2 style="color:#0052ff;">Welcome to CrowdView!</h2>
            <p>Hi ${name || ''},</p>
            <p>Please verify your email address to activate your account:</p>
            <p style="margin:24px 0;">
              <a href="${verifyUrl}"
                 style="background:#0052ff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
                Verify my email
              </a>
            </p>
            <p style="color:#666;font-size:13px;">This link expires in 24 hours.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Signup verification email failed:', emailErr.message);
    }
    // Provision 30-day trial subscription for new individual accounts
    await provisionTrial(result.insertId).catch(e =>
      console.error('provisionTrial failed:', e.message));
    res.status(201).json({ message: 'Account created. Please check your email to verify your address.' });
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

    // Block unverified self-signup accounts (Email_Verified_Fl = 'N' only set by /register)
    if (user.Email_Verified_Fl === 'N') {
      return res.status(403).json({ error: 'Please verify your email address before logging in. Check your inbox for a verification link.' });
    }

    // Fetch org country for spelling localisation (organisation vs organization)
    let orgCountry = null;
    if (user.Parent_Organization_Id) {
      const [orgRows] = await pool.execute(
        'SELECT Contact_Country_Txt FROM Organization WHERE Organization_Id = ?',
        [user.Parent_Organization_Id]
      );
      orgCountry = orgRows[0]?.Contact_Country_Txt || null;
    }

    const payload = {
      userId: user.User_Id,
      email: user.Email,
      parentOrganizationId: user.Parent_Organization_Id || null,
      corporateAdminFl: user.Corporate_Admin_Fl || 'N',
    };
    const expiresIn = payload.parentOrganizationId ? JWT_EXPIRES_CORPORATE : JWT_EXPIRES_INDIVIDUAL;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
    // Reset session detect count on every login
    sessionDetectCount.set(user.User_Id, 0);
    res.json({
      token,
      userId: user.User_Id,
      email: user.Email,
      name: user.Name_Txt,
      lastSourceDeviceId: user.Last_Source_Device_Id,
      connectLastDevice: user.Connect_Last_Used_Device_After_Login_Fl,
      parentOrganizationId: user.Parent_Organization_Id || null,
      corporateAdminFl: user.Corporate_Admin_Fl || 'N',
      orgCountry,
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
