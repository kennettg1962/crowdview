const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { indexFace, deleteFaces } = require('../rekognition');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper: build the WHERE clause fragment and params for "accessible friends".
// Corporate users see all friends belonging to any user in their organisation.
// Individual users see only their own friends.
function friendsScope(user) {
  if (user.parentOrganizationId) {
    return {
      clause: 'f.User_Id IN (SELECT User_Id FROM User WHERE Parent_Organization_Id = ?)',
      params: [user.parentOrganizationId],
    };
  }
  return { clause: 'f.User_Id = ?', params: [user.userId] };
}

// GET /api/friends
router.get('/', auth, async (req, res) => {
  try {
    const { group } = req.query;
    const scope = friendsScope(req.user);
    let query = `SELECT f.*,
      (SELECT Photo_Mime_Type FROM Friend_Photo fp WHERE fp.Friend_Id = f.Friend_Id ORDER BY fp.Friend_Photo_Id ASC LIMIT 1) AS Primary_Photo_Mime,
      u2.Name_Txt AS Linked_User_Name,
      u2.Email   AS Linked_User_Email
      FROM Friend f
      LEFT JOIN User u2 ON u2.User_Id = f.Friend_User_Id
      WHERE ${scope.clause}`;
    const params = [...scope.params];
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
  const scope = friendsScope(req.user);
  try {
    const [result] = await pool.execute(
      `UPDATE Friend SET Name_Txt = ?, Note_Multi_Line_Txt = ?, Friend_Group = ?
        WHERE Friend_Id = ? AND ${scope.clause}`,
      [name, note || '', group || 'Friend', req.params.id, ...scope.params]
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
  const scope = friendsScope(req.user);
  try {
    // Collect all Rekognition face IDs for this friend's photos before deleting
    const [photos] = await pool.execute(
      `SELECT fp.Rekognition_Face_Id FROM Friend_Photo fp
         JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
    );
    const faceIds = photos.map(r => r.Rekognition_Face_Id).filter(Boolean);
    if (faceIds.length > 0) {
      deleteFaces(faceIds).catch(err => console.error('Rekognition deleteFaces error:', err.message));
    }

    const [result] = await pool.execute(
      `DELETE FROM Friend WHERE Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
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
  const scope = friendsScope(req.user);
  try {
    const [rows] = await pool.execute(
      `SELECT fp.Friend_Photo_Id, fp.Photo_Mime_Type
         FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
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
  const scope = friendsScope(req.user);
  try {
    const [rows] = await pool.execute(
      `SELECT fp.Photo_Data, fp.Photo_Mime_Type
         FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Id = ? AND ${scope.clause}
        ORDER BY fp.Friend_Photo_Id ASC LIMIT 1`,
      [req.params.id, ...scope.params]
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
  const scope = friendsScope(req.user);
  try {
    const [rows] = await pool.execute(
      `SELECT fp.Photo_Data, fp.Photo_Mime_Type
         FROM Friend_Photo fp JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND ${scope.clause}`,
      [req.params.pid, req.params.id, ...scope.params]
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
  const scope = friendsScope(req.user);
  try {
    const [friend] = await pool.execute(
      `SELECT Friend_Id FROM Friend WHERE Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
    );
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
  const scope = friendsScope(req.user);
  try {
    // Fetch Rekognition face ID before deleting the row
    const [photoRows] = await pool.execute(
      `SELECT fp.Rekognition_Face_Id FROM Friend_Photo fp
         JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND ${scope.clause}`,
      [req.params.pid, req.params.id, ...scope.params]
    );
    if (photoRows.length && photoRows[0].Rekognition_Face_Id) {
      deleteFaces([photoRows[0].Rekognition_Face_Id]).catch(err => console.error('Rekognition deleteFaces error:', err.message));
    }

    const [result] = await pool.execute(
      `DELETE fp FROM Friend_Photo fp
         JOIN Friend f ON fp.Friend_Id = f.Friend_Id
        WHERE fp.Friend_Photo_Id = ? AND fp.Friend_Id = ? AND ${scope.clause}`,
      [req.params.pid, req.params.id, ...scope.params]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Photo not found' });
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/friends/:id/link  — link friend to a CrowdView account by email
router.patch('/:id/link', auth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const scope = friendsScope(req.user);
  try {
    // Verify this friend is accessible to the caller
    const [friends] = await pool.execute(
      `SELECT Friend_Id FROM Friend WHERE Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
    );
    if (!friends.length) return res.status(404).json({ error: 'Friend not found' });

    // Look up the target user
    const [users] = await pool.execute(
      'SELECT User_Id, Name_Txt, Email FROM User WHERE Email = ?',
      [email.trim().toLowerCase()]
    );
    if (!users.length) return res.status(404).json({ error: 'No CrowdView account found for that email' });

    const target = users[0];
    if (target.User_Id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot link a friend to your own account' });
    }

    await pool.execute(
      'UPDATE Friend SET Friend_User_Id = ? WHERE Friend_Id = ? AND User_Id = ?',
      [target.User_Id, req.params.id, req.user.userId]
    );

    res.json({ linkedUserId: target.User_Id, linkedUserName: target.Name_Txt, linkedUserEmail: target.Email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/friends/:id/unlink  — remove link to CrowdView account
router.patch('/:id/unlink', auth, async (req, res) => {
  const scope = friendsScope(req.user);
  try {
    const [result] = await pool.execute(
      `UPDATE Friend SET Friend_User_Id = NULL WHERE Friend_Id = ? AND ${scope.clause}`,
      [req.params.id, ...scope.params]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Friend not found' });
    res.json({ message: 'Unlinked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
