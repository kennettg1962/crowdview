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
 *   Glasses mode: draws the latest frame stored in latestGlassesFrameRef
 *                 (populated continuously by HubScreen's GlassesSDK.onFrame subscription).
 */
export default function useCaptureSource(videoRef) {
  const { captureMode, latestGlassesFrameRef } = useApp();

  const getCaptureFrame = useCallback((maxW = 640) => {
    if (captureMode === 'glasses') {
      const dataUrl = latestGlassesFrameRef.current;
      if (!dataUrl) return Promise.reject(new Error('No glasses frame available'));
      return new Promise(resolve => {
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
  }, [captureMode, videoRef, latestGlassesFrameRef]);

  return { getCaptureFrame };
}
