/**
 * MetaGlassesDisplay — stub for future Meta AI glasses display integration.
 *
 * Meta AI glasses (Ray-Ban Meta) currently have no third-party display API.
 * When Meta opens a display SDK, implement sendResult() and sendOverlay() here
 * to push face identification results and live-scan overlays to the lens.
 *
 * For now the glasses act as audio-only (mic + speakers via Bluetooth),
 * and all visual output remains on the phone screen.
 *
 * Usage:
 *   import MetaGlassesDisplay from '../services/MetaGlassesDisplay';
 *   MetaGlassesDisplay.sendResult(faces);   // called after Id/snap completes
 *   MetaGlassesDisplay.sendOverlay(faces);  // called each live-scan cycle
 */
const MetaGlassesDisplay = {
  /**
   * Send face identification results to the glasses display.
   * @param {Array} faces - face result array from /api/rekognition/identify
   */
  sendResult(faces) {
    // STUB — no display API available yet
    console.debug('[MetaGlassesDisplay] sendResult (stub):', faces.map(f => f.friendName || 'unknown'));
  },

  /**
   * Send live-scan overlay data (bounding boxes + labels) to the glasses display.
   * Called every scan cycle when live mode is active.
   * @param {Array} faces - face result array
   */
  sendOverlay(faces) {
    // STUB — no display API available yet
    // console.debug('[MetaGlassesDisplay] sendOverlay (stub):', faces.length, 'faces');
  },

  /**
   * Clear the glasses display (e.g. when live scan stops).
   */
  clearOverlay() {
    // STUB
    console.debug('[MetaGlassesDisplay] clearOverlay (stub)');
  },
};

export default MetaGlassesDisplay;
