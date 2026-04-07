'use strict';

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const pool = require('../db/connection');
const auth = require('../middleware/auth');
const { detectFaces, searchFace } = require('../rekognition');
const { detectActivity, sessionDetectCount, pendingDetectFlush } = require('../activity');

// POST /api/rekognition/identify
router.post('/identify', auth, async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: 'imageData required' });

  // Record live-scan activity and increment counters for the corporate dashboard
  const uid = req.user.userId;
  detectActivity.set(uid, Date.now());
  sessionDetectCount.set(uid, (sessionDetectCount.get(uid) || 0) + 1);
  pendingDetectFlush.set(uid, (pendingDetectFlush.get(uid) || 0) + 1);

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

    // Build the set of user IDs whose faces we match against.
    // Corporate users: all users in the same organisation.
    // Individual users: just themselves.
    let orgUserIds = [userId];
    if (req.user.parentOrganizationId) {
      const [orgUsers] = await pool.execute(
        'SELECT User_Id FROM User WHERE Parent_Organization_Id = ?',
        [req.user.parentOrganizationId]
      );
      orgUserIds = orgUsers.map(r => r.User_Id);
    }
    const orgPrefixes = orgUserIds.map(id => `u${id}_`);

    // Build friends-of-friends map (individual users only — not needed for corporate).
    // Bi-directional: includes both users the current user has linked to (outgoing)
    // AND users who have linked to the current user (incoming).
    // Outgoing entries take precedence (they carry the user's own label for that person).
    const friendUserMap = {};
    if (!req.user.parentOrganizationId) {
      // Incoming: users who added the current user as a linked friend
      const [incomingLinks] = await pool.execute(
        `SELECT f.User_Id AS linked_uid, u.Name_Txt AS display_name
           FROM Friend f
           JOIN User u ON u.User_Id = f.User_Id
          WHERE f.Friend_User_Id = ?`,
        [userId]
      );
      for (const row of incomingLinks) {
        friendUserMap[row.linked_uid] = { name: row.display_name || 'a friend' };
      }

      // Outgoing: users the current user has explicitly linked to (overrides incoming if both)
      const [outgoingLinks] = await pool.execute(
        'SELECT Friend_User_Id, Name_Txt FROM Friend WHERE User_Id = ? AND Friend_User_Id IS NOT NULL',
        [userId]
      );
      for (const row of outgoingLinks) {
        friendUserMap[row.Friend_User_Id] = { name: row.Name_Txt };
      }
    }

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

      console.log(`[identify] face ${i + 1} — userId=${userId} orgPrefixes=${orgPrefixes}`);
      console.log(`[identify] all matches:`, JSON.stringify(matches.map(m => ({ id: m.Face.ExternalImageId, sim: m.Similarity }))));

      const empPrefix = req.user.parentOrganizationId ? `org${req.user.parentOrganizationId}_emp` : null;

      const userMatches = matches.filter(m =>
        orgPrefixes.some(p => m.Face.ExternalImageId.startsWith(p)) && m.Similarity >= 70
      );
      const employeeMatches = empPrefix
        ? matches.filter(m => m.Face.ExternalImageId.startsWith(empPrefix) && m.Similarity >= 70)
        : [];
      const fofMatches = matches.filter(m =>
        !orgPrefixes.some(p => m.Face.ExternalImageId.startsWith(p)) &&
        (!empPrefix || !m.Face.ExternalImageId.startsWith(empPrefix)) &&
        m.Similarity >= 72
      );
      console.log(`[identify] userMatches: ${userMatches.length}, employeeMatches: ${employeeMatches.length}, fofMatches: ${fofMatches.length}`);

      let friendId = null;
      let employeeId = null;
      let friendName = null;
      let note = null;
      let friendGroup = null;
      let tier = null;
      let faceId = `face_${i + 1}`;
      let status = 'unknown';
      let matchedLabel = 'Unrecognized';

      if (employeeMatches.length > 0) {
        // Employees take precedence over customers
        const best = employeeMatches[0];
        faceId = best.Face.FaceId;
        // ExternalImageId: org{orgId}_emp{employeeId}_p{photoId}
        const empMatch = best.Face.ExternalImageId.match(/org\d+_emp(\d+)_/);
        if (empMatch) {
          const matchedEmpId = parseInt(empMatch[1], 10);
          const [empRows] = await pool.execute(
            'SELECT Organization_Employee_Id, Employee_Nm FROM Organization_Employee WHERE Organization_Employee_Id = ? AND Organization_Id = ?',
            [matchedEmpId, req.user.parentOrganizationId]
          );
          if (empRows.length) {
            const emp = empRows[0];
            employeeId = emp.Organization_Employee_Id;
            friendName = emp.Employee_Nm;
            status = 'employee';
            matchedLabel = `Employee: ${emp.Employee_Nm}`;
            // Record attendance (one row per day) and individual detection event
            const today = new Date().toISOString().split('T')[0];
            pool.execute(
              `INSERT INTO Organization_Employee_Attendance (Organization_Employee_Id, Organization_Id, Attendance_Dt)
               VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE Organization_Employee_Id = Organization_Employee_Id`,
              [emp.Organization_Employee_Id, req.user.parentOrganizationId, today]
            ).catch(err => console.error('[attendance]', err.message));
            pool.execute(
              `INSERT INTO Organization_Employee_Detection (Organization_Employee_Id, Organization_Id, Detected_By_User_Id)
               SELECT ?, ?, ? WHERE NOT EXISTS (
                 SELECT 1 FROM Organization_Employee_Detection
                 WHERE Organization_Employee_Id = ? AND Detected_At >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
               )`,
              [emp.Organization_Employee_Id, req.user.parentOrganizationId, req.user.userId,
               emp.Organization_Employee_Id]
            ).catch(err => console.error('[detection]', err.message));
          }
        }
      } else if (userMatches.length > 0) {
        const best = userMatches[0]; // already sorted by similarity desc
        faceId = best.Face.FaceId;

        // Parse friendId and owning userId from ExternalImageId: u{userId}_f{friendId}_p{photoId}
        const parts = best.Face.ExternalImageId.split('_');
        const uPart = parts.find(p => p.startsWith('u'));
        const fPart = parts.find(p => p.startsWith('f'));
        if (fPart) {
          friendId = parseInt(fPart.slice(1), 10);
          const ownerUserId = uPart ? parseInt(uPart.slice(1), 10) : userId;

          const [rows] = await pool.execute(
            'SELECT Name_Txt, Note_Multi_Line_Txt, Friend_Group, Customer_Tier_Id FROM Friend WHERE Friend_Id = ? AND User_Id = ?',
            [friendId, ownerUserId]
          );
          if (rows.length) {
            friendName = rows[0].Name_Txt;
            note = rows[0].Note_Multi_Line_Txt || null;
            friendGroup = rows[0].Friend_Group || null;
            if (rows[0].Customer_Tier_Id) {
              const [tierRows] = await pool.execute(
                'SELECT Tier_Id, Tier_Name_Txt, Tier_Color_Txt FROM Organization_Customer_Tier WHERE Tier_Id = ?',
                [rows[0].Customer_Tier_Id]
              );
              if (tierRows.length) {
                tier = { id: tierRows[0].Tier_Id, name: tierRows[0].Tier_Name_Txt, color: tierRows[0].Tier_Color_Txt };
              }
            }
            status = 'known';
            matchedLabel = `Customer: ${friendName}`;
            // Corporate only: record friend attendance + detection (dedupe: 1 min same user)
            if (req.user.parentOrganizationId) {
              const today = new Date().toISOString().split('T')[0];
              pool.execute(
                `INSERT INTO Friend_Attendance (Friend_Id, Organization_Id, Attendance_Dt)
                 VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE Friend_Id = Friend_Id`,
                [friendId, req.user.parentOrganizationId, today]
              ).catch(err => console.error('[friend-attendance]', err.message));
              pool.execute(
                `INSERT INTO Friend_Detection (Friend_Id, Organization_Id, Detected_By_User_Id)
                 SELECT ?, ?, ? WHERE NOT EXISTS (
                   SELECT 1 FROM Friend_Detection
                   WHERE Friend_Id = ? AND Organization_Id = ?
                     AND Detected_At >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                     AND Detected_By_User_Id = ?
                 )`,
                [friendId, req.user.parentOrganizationId, req.user.userId,
                 friendId, req.user.parentOrganizationId, req.user.userId]
              ).catch(err => console.error('[friend-detection]', err.message));
            }
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

      console.log(`[identify] face ${i + 1} result — status=${status} name=${friendName || 'unknown'} attrs=${JSON.stringify(attributes)}`);

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
        employeeId,
        friendName,
        friendGroup,
        tier,
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
