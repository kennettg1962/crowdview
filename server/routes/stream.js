'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db/connection');
const auth    = require('../middleware/auth');

const RECORDINGS_ROOT = process.env.RECORDINGS_ROOT || '/var/www/crowdview-streams';

// ---------------------------------------------------------------------------
// GET /api/stream/key  — get (or generate) the caller's personal stream key
// ---------------------------------------------------------------------------
router.get('/key', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT Stream_Key_Txt FROM User WHERE User_Id = ?',
      [req.user.userId]
    );
    let key = rows[0]?.Stream_Key_Txt;
    if (!key) {
      key = crypto.randomUUID();
      await pool.execute(
        'UPDATE User SET Stream_Key_Txt = ? WHERE User_Id = ?',
        [key, req.user.userId]
      );
    }
    res.json({ streamKey: key });
  } catch (err) {
    console.error('stream/key error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stream/on-publish  — MediaMTX runOnPublish webhook
// Body: { "path": "live/<streamKey>" }
// ---------------------------------------------------------------------------
router.post('/on-publish', async (req, res) => {
  const streamKey = (req.body.path || '').replace(/^live\//, '');
  if (!streamKey) return res.status(400).json({ error: 'Invalid path' });

  try {
    const [users] = await pool.execute(
      'SELECT User_Id FROM User WHERE Stream_Key_Txt = ?',
      [streamKey]
    );
    if (!users.length) return res.status(404).json({ error: 'Unknown stream key' });

    await pool.execute(
      `INSERT INTO Stream (User_Id, Stream_Key_Txt, Status_Fl)
       VALUES (?, ?, 'live')`,
      [users[0].User_Id, streamKey]
    );

    console.log(`[stream] ${streamKey} went live`);
    res.json({ success: true });
  } catch (err) {
    console.error('on-publish error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stream/on-unpublish  — MediaMTX runOnUnpublish webhook
// ---------------------------------------------------------------------------
router.post('/on-unpublish', async (req, res) => {
  const streamKey = (req.body.path || '').replace(/^live\//, '');
  if (!streamKey) return res.status(400).json({ error: 'Invalid path' });

  try {
    // Determine recording directory for this stream key
    const recDir = path.join(RECORDINGS_ROOT, 'live', streamKey);
    const recDirExists = fs.existsSync(recDir);

    await pool.execute(
      `UPDATE Stream
          SET Status_Fl = 'ended',
              Ended_At  = NOW(),
              Recording_Dir_Txt = ?
        WHERE Stream_Key_Txt = ? AND Status_Fl = 'live'`,
      [recDirExists ? recDir : null, streamKey]
    );

    console.log(`[stream] ${streamKey} ended`);
    res.json({ success: true });
  } catch (err) {
    console.error('on-unpublish error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stream/live  — all currently live streams
// ---------------------------------------------------------------------------
router.get('/live', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt, s.Started_At,
              u.Name_Txt AS Streamer_Name
         FROM Stream s
         JOIN User u ON u.User_Id = s.User_Id
        WHERE s.Status_Fl = 'live'
        ORDER BY s.Started_At DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stream/past  — past (ended) streams with available recordings
// ---------------------------------------------------------------------------
router.get('/past', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt,
              s.Started_At, s.Ended_At, s.Recording_Dir_Txt,
              u.Name_Txt AS Streamer_Name
         FROM Stream s
         JOIN User u ON u.User_Id = s.User_Id
        WHERE s.Status_Fl = 'ended'
        ORDER BY s.Started_At DESC
        LIMIT 100`
    );

    // Attach recording file URLs for each past stream
    const base = process.env.CLIENT_URL || 'https://crowdview.tv';
    const result = rows.map(row => {
      let recordings = [];
      if (row.Recording_Dir_Txt && fs.existsSync(row.Recording_Dir_Txt)) {
        recordings = fs.readdirSync(row.Recording_Dir_Txt)
          .filter(f => f.endsWith('.mp4'))
          .sort()
          .map(f => ({
            filename: f,
            url: `${base}/recordings/live/${row.Stream_Key_Txt}/${f}`,
          }));
      }
      return { ...row, recordings };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
