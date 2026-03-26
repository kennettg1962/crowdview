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
   *   Halo:        frame.display.text(label)
   *   Ray-Ban:     display not available; call speak() instead
   *   Vuzix:       intent with JSON payload
   */
  sendResult(faces) {
    console.log('[GlassesSDK] sendResult stub — implement per platform:', faces);
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
