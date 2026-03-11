'use strict';

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { detectFaces, searchFace } = require('../rekognition');

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

    // Build friends-of-friends map: { friendUserId -> { name } }
    const [linkedFriends] = await pool.execute(
      'SELECT Friend_User_Id, Name_Txt FROM Friend WHERE User_Id = ? AND Friend_User_Id IS NOT NULL',
      [userId]
    );
    const friendUserMap = {};
    for (const row of linkedFriends) {
      friendUserMap[row.Friend_User_Id] = { name: row.Name_Txt };
    }

    const userPrefix = `u${userId}_`;

    // Crop all faces and search CompreFace in parallel
    const faces = await Promise.all(faceDetails.map(async (detail, i) => {
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

      console.log(`[identify] face ${i + 1} — userId=${userId} prefix=${userPrefix}`);
      console.log(`[identify] all matches:`, JSON.stringify(matches.map(m => ({ id: m.Face.ExternalImageId, sim: m.Similarity }))));

      const userMatches = matches.filter(m =>
        m.Face.ExternalImageId.startsWith(userPrefix) && m.Similarity >= 55
      );
      const fofMatches = matches.filter(m =>
        !m.Face.ExternalImageId.startsWith(userPrefix) && m.Similarity >= 65
      );
      console.log(`[identify] userMatches: ${userMatches.length}, fofMatches: ${fofMatches.length}`);

      let friendId = null;
      let friendName = null;
      let note = null;
      let friendGroup = null;
      let faceId = `face_${i + 1}`;
      let status = 'unknown';
      let matchedLabel = 'Unrecognized';

      if (userMatches.length > 0) {
        const best = userMatches[0]; // already sorted by similarity desc
        faceId = best.Face.FaceId;

        // Parse friendId from ExternalImageId: u{userId}_f{friendId}_p{photoId}
        const parts = best.Face.ExternalImageId.split('_');
        const fPart = parts.find(p => p.startsWith('f'));
        if (fPart) {
          friendId = parseInt(fPart.slice(1), 10);

          const [rows] = await pool.execute(
            'SELECT Name_Txt, Note_Multi_Line_Txt, Friend_Group FROM Friend WHERE Friend_Id = ? AND User_Id = ?',
            [friendId, userId]
          );
          if (rows.length) {
            friendName = rows[0].Name_Txt;
            note = rows[0].Note_Multi_Line_Txt || null;
            friendGroup = rows[0].Friend_Group || null;
            status = 'known';
            matchedLabel = `Friend: ${friendName}`;
          }
        }
      } else if (Object.keys(friendUserMap).length > 0) {
        // Friends-of-friends: only high-confidence matches not in user's own collection
        for (const match of fofMatches) {
          const extId = match.Face.ExternalImageId;
          const matchedFriendUserId = Object.keys(friendUserMap).find(fuid =>
            extId.startsWith(`u${fuid}_`)
          );
          if (!matchedFriendUserId) continue;

          faceId = match.Face.FaceId;
          const mutualFriend = friendUserMap[matchedFriendUserId];

          // Look up matched person's name from the friend's own Friend table
          const parts = extId.split('_');
          const fPart = parts.find(p => p.startsWith('f'));
          if (fPart) {
            const fofFriendId = parseInt(fPart.slice(1), 10);
            const [fofRows] = await pool.execute(
              'SELECT Name_Txt, Friend_Group FROM Friend WHERE Friend_Id = ? AND User_Id = ?',
              [fofFriendId, matchedFriendUserId]
            );
            if (fofRows.length) {
              friendName = fofRows[0].Name_Txt;
              friendGroup = fofRows[0].Friend_Group || null;
              status = 'identified';
              matchedLabel = `Friend of ${mutualFriend.name}: ${friendName}`;
              note = `Known by ${mutualFriend.name}`;
            }
          }
          break;
        }
      }

      // Extract top emotion
      const topEmotion = (detail.Emotions || [])
        .sort((a, b) => b.Confidence - a.Confidence)[0];

      const attributes = {
        ageRange: detail.AgeRange ? `${detail.AgeRange.Low}–${detail.AgeRange.High}` : null,
        gender:   detail.Gender?.Value || null,
        emotion:  topEmotion?.Type ? topEmotion.Type.charAt(0) + topEmotion.Type.slice(1).toLowerCase() : null,
        mask:       detail.Mask?.Value || false,
        smile:      detail.Smile?.Value || false,
        eyeglasses: detail.Eyeglasses?.Value || false,
        sunglasses: detail.Sunglasses?.Value || false,
        beard:      detail.Beard?.Value || false,
      };

      return {
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
        friendGroup,
        note,
        matchedLabel,
        attributes,
      };
    }));

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
