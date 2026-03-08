'use strict';

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { detectFaces, searchFace } = require('../rekognition/client');

// POST /api/rekognition/identify
router.post('/identify', auth, async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: 'imageData required' });

  try {
    // Decode base64 → Buffer (strip optional data URI prefix)
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuf = Buffer.from(base64, 'base64');

    // 1. Detect all faces in the full image
    const faceDetails = await detectFaces(imageBuf);

    if (faceDetails.length === 0) {
      return res.json({ jobId: `job_${Date.now()}`, status: 'SUCCEEDED', faces: [], totalFacesDetected: 0 });
    }

    // Get image dimensions for cropping
    const meta = await sharp(imageBuf).metadata();
    const imgW = meta.width;
    const imgH = meta.height;

    const userId = req.user.userId;
    const faces = [];

    for (let i = 0; i < faceDetails.length; i++) {
      const detail = faceDetails[i];
      const bb = detail.BoundingBox; // left, top, width, height — all normalized 0-1

      // 2. Crop face region with 15% padding
      const pad = 0.15;
      const cropLeft   = Math.max(0, Math.floor((bb.Left   - bb.Width  * pad) * imgW));
      const cropTop    = Math.max(0, Math.floor((bb.Top    - bb.Height * pad) * imgH));
      const cropWidth  = Math.min(imgW - cropLeft, Math.ceil(bb.Width  * (1 + 2 * pad) * imgW));
      const cropHeight = Math.min(imgH - cropTop,  Math.ceil(bb.Height * (1 + 2 * pad) * imgH));

      const cropBuf = await sharp(imageBuf)
        .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
        .jpeg()
        .toBuffer();

      // 3. Search collection for this face crop
      const matches = await searchFace(cropBuf);

      // Filter matches belonging to this user (ExternalImageId starts with u{userId}_)
      const userPrefix = `u${userId}_`;
      const userMatches = matches.filter(m => m.Face.ExternalImageId.startsWith(userPrefix));

      let friendId = null;
      let friendName = null;
      let note = null;
      let faceId = `face_${i + 1}`;
      let status = 'unknown';
      let matchedLabel = 'Unrecognized';

      if (userMatches.length > 0) {
        const best = userMatches[0]; // already sorted by similarity desc
        faceId = best.Face.FaceId;

        // Parse friendId from ExternalImageId: u{userId}_f{friendId}_p{photoId}
        const parts = best.Face.ExternalImageId.split('_');
        // parts: ['u123', 'f45', 'p67']
        const fPart = parts.find(p => p.startsWith('f'));
        if (fPart) {
          friendId = parseInt(fPart.slice(1), 10);

          // DB lookup for friend name/note
          const [rows] = await pool.execute(
            'SELECT Name_Txt, Note_Multi_Line_Txt FROM Friend WHERE Friend_Id = ? AND User_Id = ?',
            [friendId, userId]
          );
          if (rows.length) {
            friendName = rows[0].Name_Txt;
            note = rows[0].Note_Multi_Line_Txt || null;
            status = 'known';
            matchedLabel = `Friend: ${friendName}`;
          }
        }
      }

      faces.push({
        faceId,
        boundingBox: {
          left:   bb.Left,
          top:    bb.Top,
          width:  bb.Width,
          height: bb.Height,
        },
        confidence: (detail.Confidence || 0) / 100,
        status,
        friendId,
        friendName,
        note,
        matchedLabel,
      });
    }

    res.json({
      jobId: `job_${Date.now()}`,
      status: 'SUCCEEDED',
      faces,
      totalFacesDetected: faces.length,
    });
  } catch (err) {
    console.error('Rekognition identify error:', err);
    res.status(500).json({ error: 'Face identification failed' });
  }
});

module.exports = router;
