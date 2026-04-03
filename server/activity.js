'use strict';

// In-memory activity tracking for the real-time corporate dashboard.
// Resets on server restart — acceptable since this is live status only.

const detectActivity  = new Map(); // userId -> timestamp ms (updated on every /identify call)
const deviceHeartbeat = new Map(); // userId -> timestamp ms (updated by HubScreen every 15s)

const DETECT_TTL    = 10_000;  // 10 s  — live scan fires every 300 ms
const HEARTBEAT_TTL = 30_000;  // 30 s  — heartbeat fires every 15 s

module.exports = { detectActivity, deviceHeartbeat, DETECT_TTL, HEARTBEAT_TTL };
