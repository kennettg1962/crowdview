const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { indexFace, deleteFaces } = require('../rekognition/client');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET /api/friends
router.get('/', auth, async (req, res) => {
  try {
    const { group } = req.query;
    let query = 'SELECT f.*, (SELECT Photo_Mime_Type FROM Friend_Photo fp WHERE fp.Friend_Id = f.Friend_Id ORDER BY fp.Friend_Photo_Id ASC LIMIT 1) AS Primary_Photo_Mime FROM Friend f WHERE f.User_Id = ?';
    const params = [req.user.userId];
    if (group && group !== 'All') { query += ' AND f.Friend_Group = ?'; params.push(group); }
    query += ' ORDER BY f.Name_Txt ASC';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/friends
router.post('/', auth, async (req, res) => {
  const { name, note, group } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO Friend (User_Id, Name_Txt, Note_Multi_Line_Txt, Friend_Group) VALUES (?, ?, ?, ?)',
      [req.user.userId, name, note || '', group || 'Friend']
    );
    res.status(201).json({ friendId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/friends/:id
router.put('/:id', auth, async (req, res) => {
  const { name, note, group } = req.body;
  try {
    const [result] = await pool.execute(
      'UPDATE Friend SET Name_Txt = ?, Note_Multi_Line_Txt = ?, Friend_Group = ? WHERE Friend_Id = ? AND User_Id = ?',
      [name, note || '', group || 'Friend', req.params.id, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Friend not found' });
    res.json({ message: 'Friend updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/friends/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    // Collect all Rekognition face IDs for this friend's photos before deleting
    const [photos] = await pool.execute(
      'SELECT fp.Rekognition_Face_Id FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Id = ? AND f.User_Id = ?',
      [req.params.id, req.user.userId]
    );
    const faceIds = photos.map(r => r.Rekognition_Face_Id).filter(Boolean);
    if (faceIds.length > 0) {
      deleteFaces(faceIds).catch(err => console.error('Rekognition deleteFaces error:', err.message));
    }

    const [result] = await pool.execute(
      'DELETE FROM Friend WHERE Friend_Id = ? AND User_Id = ?',
      [req.params.id, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Friend not found' });
    res.json({ message: 'Friend deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/friends/:id/photos
router.get('/:id/photos', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT fp.Friend_Photo_Id, fp.Photo_Mime_Type FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Id = ? AND f.User_Id = ?',
      [req.params.id, req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/friends/:id/photos/:pid/data
// GET /api/friends/:id/photos/primary/data — returns first photo for the friend
router.get('/:id/photos/primary/data', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT fp.Photo_Data, fp.Photo_Mime_Type FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Id = ? AND f.User_Id = ? ORDER BY fp.Friend_Photo_Id ASC LIMIT 1',
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No photo found' });
    res.set('Content-Type', rows[0].Photo_Mime_Type);
    res.send(rows[0].Photo_Data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/photos/:pid/data', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT fp.Photo_Data, fp.Photo_Mime_Type FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND f.User_Id = ?',
      [req.params.pid, req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Photo not found' });
    res.set('Content-Type', rows[0].Photo_Mime_Type);
    res.send(rows[0].Photo_Data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/friends/:id/photos
router.post('/:id/photos', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Photo file required' });
  try {
    const [friend] = await pool.execute('SELECT Friend_Id FROM Friend WHERE Friend_Id = ? AND User_Id = ?', [req.params.id, req.user.userId]);
    if (!friend.length) return res.status(404).json({ error: 'Friend not found' });
    const [result] = await pool.execute(
      'INSERT INTO Friend_Photo (Friend_Id, Photo_Data, Photo_Mime_Type) VALUES (?, ?, ?)',
      [req.params.id, req.file.buffer, req.file.mimetype]
    );
    const photoId = result.insertId;

    // Index the face in Rekognition (non-fatal — log but don't fail the request)
    indexFace(req.file.buffer, req.user.userId, req.params.id, photoId)
      .then(faceId => {
        if (faceId) {
          return pool.execute(
            'UPDATE Friend_Photo SET Rekognition_Face_Id = ? WHERE Friend_Photo_Id = ?',
            [faceId, photoId]
          );
        }
      })
      .catch(err => console.error('Rekognition indexFace error:', err.message));

    res.status(201).json({ photoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/friends/:id/photos/:pid
router.delete('/:id/photos/:pid', auth, async (req, res) => {
  try {
    // Fetch Rekognition face ID before deleting the row
    const [photoRows] = await pool.execute(
      'SELECT fp.Rekognition_Face_Id FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND f.User_Id = ?',
      [req.params.pid, req.params.id, req.user.userId]
    );
    if (photoRows.length && photoRows[0].Rekognition_Face_Id) {
      deleteFaces([photoRows[0].Rekognition_Face_Id]).catch(err => console.error('Rekognition deleteFaces error:', err.message));
    }

    const [result] = await pool.execute(
      'DELETE fp FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND f.User_Id = ?',
      [req.params.pid, req.params.id, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Photo not found' });
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
