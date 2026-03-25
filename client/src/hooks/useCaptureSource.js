import { useCallback } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Abstracts frame capture from the active source.
 *
 * @param {React.RefObject} videoRef  - ref to the <video> element (phone mode only)
 * @returns {{ getCaptureFrame }}
 *
 * getCaptureFrame(maxW, quality) → Promise<HTMLCanvasElement>
 *   Phone mode  : draws the current video frame into a scaled canvas.
 *   Glasses mode: resolves with the next frame pushed via injectGlassesFrame().
 */
export default function useCaptureSource(videoRef) {
  const { captureMode, pendingGlassesFrameRef } = useApp();

  const getCaptureFrame = useCallback((maxW = 640, quality = 0.8) => {
    if (captureMode === 'glasses') {
      // Glasses push frames asynchronously — resolve when injectGlassesFrame fires.
      return new Promise(resolve => {
        pendingGlassesFrameRef.current = (dataUrl) => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, maxW / img.width);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas);
          };
          img.src = dataUrl;
        };
      });
    }

    // ── Phone mode: read from the live <video> element ───────────────
    const video = videoRef.current;
    if (!video || !video.videoWidth) return Promise.reject(new Error('No video source'));
    const scale = Math.min(1, maxW / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(video.videoWidth  * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return Promise.resolve(canvas);
  }, [captureMode, videoRef, pendingGlassesFrameRef]);

  return { getCaptureFrame };
}
