const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// POST /api/rekognition/identify
// Stub: returns mock detected faces
router.post('/identify', auth, async (req, res) => {
  // In production, integrate with AWS Rekognition or similar service
  // For now, return mock data
  await new Promise(r => setTimeout(r, 1500)); // Simulate processing delay

  const mockFaces = [
    {
      faceId: 'face_001',
      boundingBox: { left: 0.15, top: 0.2, width: 0.18, height: 0.25 },
      confidence: 0.97,
      status: 'known', // known = green, identified = orange, unknown = red
      friendId: null,
      friendName: null,
      note: null,
      matchedLabel: 'Friend: John Doe'
    },
    {
      faceId: 'face_002',
      boundingBox: { left: 0.55, top: 0.15, width: 0.16, height: 0.22 },
      confidence: 0.82,
      status: 'identified',
      friendId: null,
      friendName: 'Jane Smith',
      note: 'Identified via facial recognition - not yet in friends list',
      matchedLabel: 'Identified: Jane Smith'
    },
    {
      faceId: 'face_003',
      boundingBox: { left: 0.72, top: 0.3, width: 0.14, height: 0.2 },
      confidence: 0.45,
      status: 'unknown',
      friendId: null,
      friendName: null,
      note: null,
      matchedLabel: 'Unrecognized'
    }
  ];

  res.json({
    jobId: `job_${Date.now()}`,
    status: 'SUCCEEDED',
    faces: mockFaces,
    totalFacesDetected: mockFaces.length
  });
});

module.exports = router;
