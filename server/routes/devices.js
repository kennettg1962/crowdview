const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// GET /api/devices
// Note: Real device enumeration must happen on the client via MediaDevices.enumerateDevices()
// This endpoint exists as a proxy/stub for consistency
router.get('/', auth, (req, res) => {
  res.json({
    message: 'Device enumeration must be performed client-side via MediaDevices.enumerateDevices()',
    note: 'The client should call navigator.mediaDevices.enumerateDevices() directly'
  });
});

module.exports = router;
