import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import GlassesSDK from '../services/GlassesSDK';

/**
 * Drives the Halo glasses display + audio as the user steps through face results.
 *
 * Behaviour (glasses mode only — complete no-op when captureMode === 'phone'):
 *
 *  1. When faces first load:
 *     Audio → "3 faces. 1 friend, 1 identified, 1 unknown."
 *     Crops generated from photoDataUrl + boundingBoxes (12% padding, same as IdScreen)
 *     Display + audio → "Face 1: John Smith." on Halo
 *
 *  2. When selectedFaceIndex changes (next / prev voice command or tap):
 *     Display + audio → "Face N: <name or Unknown>." on Halo
 *
 * @param {Array}  faces             - face result array from /api/rekognition/identify
 * @param {string} photoDataUrl      - base64 JPEG of the snapped photo
 * @param {number} selectedFaceIndex - controlled by IdScreen (voice nav or tap)
 */
export default function useGlassesPresentation(faces, photoDataUrl, selectedFaceIndex) {
  const { captureMode } = useApp();
  const cropsRef    = useRef([]);   // dataUrls indexed by face position
  const readyRef    = useRef(false); // true once crops are generated for current faces
  const prevIdxRef  = useRef(-1);   // tracks last displayed index to skip redundant updates

  // ── When faces load: announce summary + generate crops + show face 0 ────────
  useEffect(() => {
    if (captureMode !== 'glasses' || !faces.length || !photoDataUrl) return;

    readyRef.current  = false;
    prevIdxRef.current = -1;

    // Announce summary immediately — no crops needed for audio
    const nFriend     = faces.filter(f => f.status === 'known').length;
    const nIdentified = faces.filter(f => f.status === 'identified').length;
    const nUnknown    = faces.filter(f => f.status === 'unknown').length;
    const parts = [
      nFriend     && `${nFriend} friend${nFriend > 1 ? 's' : ''}`,
      nIdentified && `${nIdentified} identified`,
      nUnknown    && `${nUnknown} unknown`,
    ].filter(Boolean).join(', ');
    GlassesSDK.speak(
      `${faces.length} face${faces.length !== 1 ? 's' : ''}. ${parts}.`
    );

    // Generate padded face crops then display first face
    Promise.all(faces.map(face => cropFace(photoDataUrl, face.boundingBox)))
      .then(crops => {
        cropsRef.current   = crops;
        readyRef.current   = true;
        prevIdxRef.current = 0;
        const face  = faces[0];
        const label = face.friendName || 'Unknown';
        GlassesSDK.displayFace(crops[0], label, face.status);
        GlassesSDK.speak(`Face 1: ${label}.`);
      });
  }, [faces, captureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── When selected index changes (next / prev): update display + audio ───────
  useEffect(() => {
    if (captureMode !== 'glasses') return;
    if (!readyRef.current) return;                  // crops not ready yet
    if (selectedFaceIndex === prevIdxRef.current) return; // no change
    prevIdxRef.current = selectedFaceIndex;

    const face  = faces[selectedFaceIndex];
    if (!face) return;
    const label = face.friendName || 'Unknown';
    GlassesSDK.displayFace(cropsRef.current[selectedFaceIndex], label, face.status);
    GlassesSDK.speak(`Face ${selectedFaceIndex + 1}: ${label}.`);
  }, [selectedFaceIndex, captureMode, faces]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cropFace(photoDataUrl, box) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w   = img.naturalWidth;
      const h   = img.naturalHeight;
      const pad = 0.12;
      const left   = Math.max(0, Math.floor((box.left  - box.width  * pad) * w));
      const top    = Math.max(0, Math.floor((box.top   - box.height * pad) * h));
      const width  = Math.min(w - left, Math.ceil(box.width  * (1 + 2 * pad) * w));
      const height = Math.min(h - top,  Math.ceil(box.height * (1 + 2 * pad) * h));
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, left, top, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.src = photoDataUrl;
  });
}
