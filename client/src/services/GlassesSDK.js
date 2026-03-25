/**
 * GlassesSDK — interface for wearable display integration.
 *
 * Implement per platform by replacing these stubs:
 *   Brilliant Labs Halo  →  BLE via @brilliantlabs/frame-sdk
 *   Vuzix Blade 2        →  Android intent / WebSocket bridge
 *   Meta Ray-Ban Display →  Meta Wearables Device Access Toolkit (camera only)
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
   *   Halo:  frame.display.text(label)
   *   Vuzix: intent with JSON payload
   */
  sendResult(faces) {
    console.log('[GlassesSDK] sendResult stub — implement per platform:', faces);
  },
};

export default GlassesSDK;
