/**
 * HaloSDK.js — CrowdView integration layer for the Brilliant Labs Frame (Halo) glasses.
 *
 * Wraps FrameHaloPlugin (Capacitor BLE bridge) and exposes a clean API used by
 * HubScreen and GlobalVoiceCommands.
 *
 * BLE protocol message codes must match crowdview_app.lua exactly.
 */

import FrameHalo from '../plugins/FrameHaloPlugin';
import crowdviewLua from '../halo/crowdview_app.lua?raw';

// ── Protocol constants (must match crowdview_app.lua) ─────────────────────────
const CMD_CAPTURE  = 0x10;
const CMD_TEXT     = 0x11;
const CMD_CLEAR    = 0x12;
const CMD_AUDIO_ON = 0x13;
// const CMD_AUDIO_OFF = 0x14;  // reserved

const RSP_PHOTO_DONE  = 0x02;
const RSP_AUDIO       = 0x03;
const RSP_TAP         = 0x09;

// ── Frame 16-colour palette indices ──────────────────────────────────────────
const COLOR_WHITE  = 15;
const COLOR_GREEN  = 10;
const COLOR_ORANGE = 7;
const COLOR_RED    = 3;
const COLOR_GRAY   = 6;

// ── Internal state ────────────────────────────────────────────────────────────
const _photoListeners      = new Set();
const _tapListeners        = new Set();
const _transcriptListeners = new Set();

let _connected      = false;
let _dataListener   = null;
let _recognizer     = null;
let _recognizing    = false;
let _audioCtx       = null;
let _audioBuf       = [];

// ── Public SDK ────────────────────────────────────────────────────────────────

const HaloSDK = {

  get connected() { return _connected; },

  // ── Connection ──────────────────────────────────────────────────────────────

  async connect() {
    if (_connected) return;
    await FrameHalo.connect();

    // Upload on-device Lua app
    await FrameHalo.uploadApp({ lua: crowdviewLua });

    // Subscribe to all incoming data
    _dataListener = await FrameHalo.addListener('frameData', ({ msgCode, data, str }) => {
      switch (msgCode) {
        case RSP_TAP:
          _tapListeners.forEach(cb => cb());
          break;

        case RSP_PHOTO_DONE:
          if (data?.length) {
            const jpeg = new Uint8Array(data);
            const blob = new Blob([jpeg], { type: 'image/jpeg' });
            const url  = URL.createObjectURL(blob);
            _photoListeners.forEach(cb => cb(url));
          }
          break;

        case RSP_AUDIO:
          if (data?.length) _handleAudioChunk(new Uint8Array(data));
          break;

        default:
          if (str) console.log('[Halo Lua]', str);
          break;
      }
    });

    _connected = true;
  },

  async disconnect() {
    if (!_connected) return;
    _connected = false;
    _dataListener?.remove();
    _dataListener = null;
    _stopAudio();
    _photoListeners.clear();
    _tapListeners.clear();
    await FrameHalo.disconnect();
  },

  // ── Camera ──────────────────────────────────────────────────────────────────

  /** Ask the glasses to capture a photo. Result arrives via onPhoto callback. */
  triggerCapture() {
    _sendCmd(CMD_CAPTURE, []);
  },

  onPhoto(cb)  { _photoListeners.add(cb); },
  offPhoto(cb) { _photoListeners.delete(cb); },

  // ── Touch ────────────────────────────────────────────────────────────────────

  /** Fired when user taps the glasses frame. */
  onTap(cb)  { _tapListeners.add(cb); },
  offTap(cb) { _tapListeners.delete(cb); },

  // ── Display ──────────────────────────────────────────────────────────────────

  clearDisplay() {
    _sendCmd(CMD_CLEAR, []);
  },

  /**
   * Show a text string on the Frame display.
   * @param {string}  text   — up to ~30 chars comfortably visible
   * @param {number}  x      — 1–640 horizontal position
   * @param {number}  y      — 1–400 vertical position
   * @param {number}  color  — Frame palette index (0–15)
   */
  showText(text, x = 10, y = 200, color = COLOR_WHITE) {
    const textBytes = Array.from(new TextEncoder().encode(text));
    const payload = [
      (x >> 8) & 0xFF, x & 0xFF,
      (y >> 8) & 0xFF, y & 0xFF,
      color,
      ...textBytes,
    ];
    _sendCmd(CMD_TEXT, payload);
  },

  /**
   * Display a face identification result on the glasses lens.
   * Called by HubScreen after rekognition returns.
   * @param {string} name    — friend name or 'Unknown'
   * @param {string} status  — 'known' | 'identified' | 'unknown'
   */
  displayFace(name, status) {
    const icon  = status === 'known' ? '\u2713'           // ✓
                : status === 'identified' ? '~'
                : '?';
    const color = status === 'known'      ? COLOR_GREEN
                : status === 'identified' ? COLOR_ORANGE
                : COLOR_RED;
    this.clearDisplay();
    // Name centred vertically on the 400px display
    this.showText(`${icon} ${name}`, 10, 180, color);
  },

  /**
   * Show multiple faces in a compact list (used after live scan cycle).
   * Only the top 3 are shown to keep it readable on the 640×400 display.
   */
  displayFaceList(faces) {
    this.clearDisplay();
    const top = faces.slice(0, 3);
    top.forEach((f, i) => {
      const icon  = f.status === 'known' ? '\u2713' : f.status === 'identified' ? '~' : '?';
      const color = f.status === 'known' ? COLOR_GREEN
                  : f.status === 'identified' ? COLOR_ORANGE
                  : COLOR_RED;
      const name  = f.friendName || 'Unknown';
      this.showText(`${icon} ${name}`, 10, 60 + i * 110, color);
    });
  },

  /** Show a short status message (scanning, no faces, etc.) */
  showStatus(msg) {
    this.clearDisplay();
    this.showText(msg, 10, 190, COLOR_GRAY);
  },

  // ── Audio / Voice commands ───────────────────────────────────────────────────

  /** Start streaming mic audio and activate speech recognition. */
  startAudio() {
    _audioBuf = [];
    _sendCmd(CMD_AUDIO_ON, []);
    _startRecognition();
  },

  onTranscript(cb)  { _transcriptListeners.add(cb); },
  offTranscript(cb) { _transcriptListeners.delete(cb); },
};

export default HaloSDK;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _sendCmd(msgCode, payload) {
  FrameHalo.sendCommand({ msgCode, payload }).catch(err =>
    console.warn('[HaloSDK] sendCommand error:', err)
  );
}

// ── Audio: PCM 8 kHz 8-bit → phone speaker + SpeechRecognition ───────────────
// The raw PCM from the Frame glasses is played back through the phone speaker
// so the user can hear themselves via the glasses mic.  SpeechRecognition runs
// on the phone mic in parallel — this is the same approach used for Meta glasses.
// A full PCM→MediaStreamTrack bridge (piping glasses audio directly into the
// Web Speech API) is left as future work once hardware is validated.

function _handleAudioChunk(pcm) {
  _audioBuf.push(...pcm);
  // Flush in ~200 ms batches (1600 samples @ 8 kHz)
  if (_audioBuf.length >= 1600) {
    const samples = _audioBuf.splice(0, 1600);
    _playPcm(samples);
  }
}

function _playPcm(samples) {
  if (!_audioCtx) return;
  const float32 = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] > 127 ? samples[i] - 256 : samples[i];
    float32[i] = s / 128;
  }
  const buf = _audioCtx.createBuffer(1, float32.length, 8000);
  buf.copyToChannel(float32, 0);
  const src = _audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(_audioCtx.destination);
  src.start();
}

function _startRecognition() {
  _audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 8000 });

  if (_recognizing) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  const rec = new SR();
  rec.continuous     = true;
  rec.interimResults = false;
  rec.lang           = 'en-US';

  rec.onresult = (e) => {
    const t = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    _transcriptListeners.forEach(cb => cb(t));
  };
  rec.onend = () => { if (_recognizing) rec.start(); };
  rec.onerror = () => { if (_recognizing) { try { rec.start(); } catch (_) {} } };

  rec.start();
  _recognizing = true;
  _recognizer  = rec;
}

function _stopAudio() {
  _recognizing = false;
  try { _recognizer?.stop(); } catch (_) {}
  _recognizer = null;
  _audioCtx?.close().catch(() => {});
  _audioCtx = null;
  _audioBuf = [];
}
