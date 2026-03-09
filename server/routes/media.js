const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/connection');
const auth = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// GET /api/media
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT User_Media_Id, Media_Mime_Type, Media_Type, Created_At FROM User_Media WHERE User_Id = ? ORDER BY Created_At DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/media/:id/data
router.get('/:id/data', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT Media_Data, Media_Mime_Type FROM User_Media WHERE User_Media_Id = ? AND User_Id = ?',
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Media not found' });
    res.set('Content-Type', rows[0].Media_Mime_Type);
    res.send(rows[0].Media_Data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/media
router.post('/', auth, upload.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Media file required' });
  const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'photo';
  try {
    const [result] = await pool.execute(
      'INSERT INTO User_Media (User_Id, Media_Data, Media_Mime_Type, Media_Type) VALUES (?, ?, ?, ?)',
      [req.user.userId, req.file.buffer, req.file.mimetype, mediaType]
    );
    // Keep only the 20 most recent items per user
    await pool.execute(
      `DELETE FROM User_Media WHERE User_Id = ? AND User_Media_Id NOT IN (
        SELECT id FROM (SELECT User_Media_Id AS id FROM User_Media WHERE User_Id = ? ORDER BY User_Media_Id DESC LIMIT 20) t
      )`,
      [req.user.userId, req.user.userId]
    );
    res.status(201).json({ mediaId: result.insertId, mediaType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/media/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM User_Media WHERE User_Media_Id = ? AND User_Id = ?',
      [req.params.id, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Media not found' });
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
