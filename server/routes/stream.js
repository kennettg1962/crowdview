'use strict';

const express    = require('express');
const router     = express.Router();
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const pool       = require('../db/connection');
const auth       = require('../middleware/auth');

// Move moov atom to start of MP4 so browsers can stream without downloading the whole file.
// Silently skips if ffmpeg is not installed.
async function applyFaststart(filePath) {
  const tmp = filePath + '.fs.mp4';
  try {
    await execFileAsync('ffmpeg', ['-i', filePath, '-c', 'copy', '-movflags', 'faststart', '-y', tmp]);
    fs.renameSync(tmp, filePath);
    console.log(`[stream] faststart applied: ${path.basename(filePath)}`);
  } catch (err) {
    console.warn('[stream] ffmpeg faststart skipped:', err.message);
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

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
// POST /api/stream/auth  — MediaMTX externalAuthenticationURL hook
// Called before a publish or read is accepted. Return 200 to allow, 403 to reject.
// ---------------------------------------------------------------------------
router.post('/auth', async (req, res) => {
  const { action, path: streamPath } = req.body;

  // Only restrict publish actions
  if (action !== 'publish') return res.sendStatus(200);

  const streamKey = (streamPath || '').replace(/^live\//, '');
  if (!streamKey) return res.sendStatus(200);

  try {
    const [users] = await pool.execute(
      'SELECT User_Id FROM User WHERE Stream_Key_Txt = ?',
      [streamKey]
    );
    if (!users.length) return res.sendStatus(200); // unknown key — let on-publish handle it

    const [live] = await pool.execute(
      `SELECT Stream_Id FROM Stream
        WHERE User_Id = ? AND Status_Fl = 'live'
          AND Started_At > NOW() - INTERVAL 24 HOUR`,
      [users[0].User_Id]
    );

    if (live.length > 0) {
      console.log(`[stream/auth] rejected — user ${users[0].User_Id} already has active stream`);
      return res.sendStatus(403);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('stream/auth error:', err);
    res.sendStatus(200); // fail open — don't block on server error
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

    // Clean up any stale live rows for this user before inserting
    await pool.execute(
      `UPDATE Stream SET Status_Fl = 'ended', Ended_At = NOW()
        WHERE User_Id = ? AND Status_Fl = 'live'`,
      [users[0].User_Id]
    );

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
    const recDir = path.join(RECORDINGS_ROOT, 'live', streamKey);
    let recFile = null;

    if (fs.existsSync(recDir)) {
      // Find the most recently modified .mp4 in the directory — that's this session's recording
      const files = fs.readdirSync(recDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(recDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length) recFile = path.join(recDir, files[0].name);
    }

    // Rewrite the file with moov atom at the front so browsers can stream it
    // progressively without downloading the entire file first.
    if (recFile) await applyFaststart(recFile);

    await pool.execute(
      `UPDATE Stream
          SET Status_Fl = 'ended',
              Ended_At  = NOW(),
              Recording_Dir_Txt = ?,
              Recording_File_Txt = ?
        WHERE Stream_Key_Txt = ? AND Status_Fl = 'live'`,
      [recFile ? path.dirname(recFile) : null, recFile, streamKey]
    );

    console.log(`[stream] ${streamKey} ended — recording: ${recFile || 'none'}`);

    // Enforce 200 past-stream cap per organisation (corporate orgs only)
    const [userRows] = await pool.execute(
      'SELECT User_Id, Parent_Organization_Id FROM User WHERE Stream_Key_Txt = ?',
      [streamKey]
    );
    const orgId = userRows[0]?.Parent_Organization_Id;
    if (orgId) {
      const [excess] = await pool.execute(
        `SELECT s.Stream_Id, s.Recording_File_Txt
           FROM Stream s JOIN User u ON u.User_Id = s.User_Id
          WHERE u.Parent_Organization_Id = ? AND s.Status_Fl = 'ended'
          ORDER BY s.Started_At DESC
          LIMIT 18446744073709551615 OFFSET 200`,
        [orgId]
      );
      for (const old of excess) {
        if (old.Recording_File_Txt && fs.existsSync(old.Recording_File_Txt)) {
          try {
            fs.unlinkSync(old.Recording_File_Txt);
            const dir = path.dirname(old.Recording_File_Txt);
            if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
          } catch (_) {}
        }
        await pool.execute('DELETE FROM Stream WHERE Stream_Id = ?', [old.Stream_Id]);
      }
      if (excess.length) console.log(`[stream] pruned ${excess.length} old org streams for org ${orgId}`);
    }

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
    let query, params;
    if (req.user.parentOrganizationId) {
      // Corporate: all streams from users in the same organisation
      query = `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt, s.Started_At,
                      u.Name_Txt AS Streamer_Name, s.User_Id AS Streamer_User_Id
                 FROM Stream s
                 JOIN User u ON u.User_Id = s.User_Id
                WHERE s.Status_Fl = 'live'
                  AND u.Parent_Organization_Id = ?
                ORDER BY s.Started_At DESC`;
      params = [req.user.parentOrganizationId];
    } else {
      // Individual: own streams + linked friends' streams
      query = `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt, s.Started_At,
                      u.Name_Txt AS Streamer_Name, s.User_Id AS Streamer_User_Id
                 FROM Stream s
                 JOIN User u ON u.User_Id = s.User_Id
                WHERE s.Status_Fl = 'live'
                  AND (
                    s.User_Id = ?
                    OR s.User_Id IN (
                      SELECT f.Friend_User_Id FROM Friend f
                       WHERE f.User_Id = ? AND f.Friend_User_Id IS NOT NULL
                    )
                  )
                ORDER BY s.Started_At DESC`;
      params = [req.user.userId, req.user.userId];
    }
    const [rows] = await pool.execute(query, params);
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
    let query, params;
    if (req.user.parentOrganizationId) {
      query = `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt,
                      s.Started_At, s.Ended_At,
                      s.Recording_File_Txt,
                      s.User_Id AS Streamer_User_Id,
                      u.Name_Txt AS Streamer_Name
                 FROM Stream s
                 JOIN User u ON u.User_Id = s.User_Id
                WHERE s.Status_Fl = 'ended'
                  AND u.Parent_Organization_Id = ?
                ORDER BY s.Started_At DESC
                LIMIT 200`;
      params = [req.user.parentOrganizationId];
    } else {
      query = `SELECT s.Stream_Id, s.Stream_Key_Txt, s.Title_Txt,
                      s.Started_At, s.Ended_At,
                      s.Recording_File_Txt,
                      s.User_Id AS Streamer_User_Id,
                      u.Name_Txt AS Streamer_Name
                 FROM Stream s
                 JOIN User u ON u.User_Id = s.User_Id
                WHERE s.Status_Fl = 'ended'
                  AND (
                    s.User_Id = ?
                    OR s.User_Id IN (
                      SELECT f.Friend_User_Id FROM Friend f
                       WHERE f.User_Id = ? AND f.Friend_User_Id IS NOT NULL
                    )
                  )
                ORDER BY s.Started_At DESC
                LIMIT 100`;
      params = [req.user.userId, req.user.userId];
    }
    const [rows] = await pool.execute(query, params);

    // Build recording URL — served via Express API to avoid nginx static file config issues
    const base = process.env.CLIENT_URL || 'https://crowdview.tv';
    const result = rows.map(row => {
      let recordings = [];
      if (row.Recording_File_Txt && fs.existsSync(row.Recording_File_Txt)) {
        const filename = path.basename(row.Recording_File_Txt);
        recordings = [{
          filename,
          url: `${base}/api/stream/recording/${row.Stream_Key_Txt}/${encodeURIComponent(filename)}`,
        }];
      }
      return { ...row, recordings };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stream/recording/:streamKey/:filename  — serve recording file
// Bypasses nginx static file serving; works regardless of nginx /recordings/ config.
// ---------------------------------------------------------------------------
router.get('/recording/:streamKey/:filename', async (req, res) => {
  const { streamKey, filename } = req.params;
  const safeFilename = path.basename(decodeURIComponent(filename));
  // Reject anything that isn't an mp4 or contains path separators (path.basename already strips these)
  if (!safeFilename.toLowerCase().endsWith('.mp4') || safeFilename.includes('/') || safeFilename.includes('\\') || safeFilename.includes('\0')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(RECORDINGS_ROOT, 'live', streamKey, safeFilename);

  if (!fs.existsSync(filePath)) {
    console.error(`[recording] file not found: ${filePath}`);
    return res.status(404).json({ error: 'Recording not found' });
  }

  // Disable ETags and last-modified to prevent 304 responses — video elements
  // need a full 200/206 response with bytes, not an empty 304.
  res.sendFile(filePath, { etag: false, lastModified: false });
});

// ---------------------------------------------------------------------------
// DELETE /api/stream/:id  — delete own past stream + recordings from disk
// ---------------------------------------------------------------------------
router.delete('/:id', auth, async (req, res) => {
  const streamId = req.params.id;
  try {
    const [rows] = await pool.execute(
      'SELECT Stream_Id, User_Id, Recording_File_Txt FROM Stream WHERE Stream_Id = ?',
      [streamId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Stream not found' });

    const stream = rows[0];
    if (stream.User_Id !== req.user.userId) {
      return res.status(403).json({ error: 'Cannot delete another user\'s stream' });
    }

    // Delete only this stream's specific recording file
    if (stream.Recording_File_Txt && fs.existsSync(stream.Recording_File_Txt)) {
      fs.unlinkSync(stream.Recording_File_Txt);
      // Remove the parent directory only if it is now empty
      const dir = path.dirname(stream.Recording_File_Txt);
      try {
        const remaining = fs.readdirSync(dir);
        if (remaining.length === 0) fs.rmdirSync(dir);
      } catch (_) {}
    }

    await pool.execute('DELETE FROM Stream WHERE Stream_Id = ?', [streamId]);
    console.log(`[stream] deleted stream ${streamId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('stream delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
