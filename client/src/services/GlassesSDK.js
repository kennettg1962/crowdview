/**
 * GlassesSDK — interface for wearable display and audio integration.
 *
 * Implement per platform by replacing these stubs:
 *   Brilliant Labs Halo  →  BLE via @brilliantlabs/frame-sdk
 *                           display: frame.display.text(label)
 *                           audio:   frame.microphone / frame.audio TTS bridge
 *   Meta Ray-Ban Display →  Meta Wearables Device Access Toolkit
 *                           display: NOT accessible to third parties (audio only)
 *                           audio:   SDK audio output API via open-ear speakers
 *   Vuzix Blade 2        →  Android intent / WebSocket bridge
 *                           display + audio via Android TTS
 *
 * AppContext.captureMode === 'phone' never calls these methods.
 */

const _frameListeners = new Set();

const GlassesSDK = {
  /** Open connection to glasses hardware. Returns Promise<void>. */
  connect() {
    console.log('[GlassesSDK] connect — not yet implemented');
    return Promise.resolve();
  },

  /** Close connection. */
  disconnect() {
    console.log('[GlassesSDK] disconnect — not yet implemented');
    _frameListeners.clear();
  },

  /**
   * Subscribe to incoming camera frames from the glasses.
   * callback(dataUrl: string) is called for each frame.
   */
  onFrame(callback) {
    _frameListeners.add(callback);
  },

  offFrame(callback) {
    _frameListeners.delete(callback);
  },

  /**
   * Called internally when the glasses hardware delivers a frame.
   * In a real implementation this is triggered by the platform SDK callback.
   */
  _dispatchFrame(dataUrl) {
    _frameListeners.forEach(cb => cb(dataUrl));
  },

  /**
   * Send face identification results to the glasses display.
   * faces: array of { friendName, status, confidence }
   *
   * Display format is platform-specific — implement per SDK:
   *   Halo:        frame.display.text(label) — use displayFace() for per-face detail
   *   Ray-Ban:     display not available; audio-only via speak()
   *   Vuzix:       intent with JSON payload
   */
  sendResult(faces) {
    console.log('[GlassesSDK] sendResult stub — implement per platform:', faces);
  },

  /**
   * Display a single face on the glasses screen with its name and status.
   * Called sequentially as the user steps through results with next/prev.
   *
   * @param {string} cropDataUrl  - JPEG dataUrl of the face crop (padded, ~100–300px)
   * @param {string} name         - friend name or 'Unknown'
   * @param {string} status       - 'known' | 'identified' | 'unknown'
   *
   * Platform implementation:
   *   Halo (640×400 microOLED):
   *     Convert dataUrl → ArrayBuffer → frame.display.bitmap(buffer)
   *     Overlay text: frame.display.text(`${name}  ${statusIcon}`)
   *     Status icons: ✓ (known, green), ~ (identified, orange), ? (unknown, red)
   *   Ray-Ban:
   *     Display not accessible — speak() is the only output channel
   *   Vuzix:
   *     Android intent with crop + label JSON
   */
  displayFace(_cropDataUrl, name, status) {
    console.log('[GlassesSDK] displayFace stub — implement per platform:', name, status);
  },

  /**
   * Speak text through the glasses' open-ear speakers.
   * Called for voice command feedback and face ID result announcements.
   *
   * Platform implementation:
   *   Halo:    frame-sdk audio TTS bridge (BLE audio channel)
   *   Ray-Ban: Meta Wearables SDK audio output API
   *            (primary output channel — display not available to third parties)
   *   Vuzix:   Android TextToSpeech intent
   */
  speak(text) {
    console.log('[GlassesSDK] speak stub — implement per platform:', text);
  },
};

export default GlassesSDK;
