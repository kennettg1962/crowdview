import { useState, useEffect, useRef } from 'react';
import api from '../api/api';

/**
 * Renders an image fetched with the JWT auth header.
 * - lazy={true}  — defers loading until near the viewport (IntersectionObserver)
 * - maxPx={N}    — resizes the decoded image to fit within N×N px before display.
 *                  This is critical for GPU memory: full-res camera photos are
 *                  12MP+ textures; without resizing they accumulate in the GPU
 *                  pipeline and cause sustained high CPU on subsequent screens.
 */
export default function AuthImage({ src, alt = '', className = '', fallback = null, lazy = false, maxPx = null }) {
  const [displaySrc, setDisplaySrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!lazy);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lazy) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!src || !visible) return;

    // data: and blob: URLs don't need auth — use directly (no resizing needed)
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setDisplaySrc(src);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let blobUrl;
    let imgEl = null;

    setFailed(false);

    api.get(src, { responseType: 'blob', signal: controller.signal })
      .then(res => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(res.data);

        if (!maxPx) {
          setDisplaySrc(blobUrl);
          return;
        }

        // Resize to maxPx × maxPx to keep GPU texture memory small.
        const img = new Image();
        imgEl = img;
        img.onload = () => {
          imgEl = null;
          if (cancelled) { URL.revokeObjectURL(blobUrl); blobUrl = null; return; }
          const scale = Math.min(1, maxPx / img.naturalWidth, maxPx / img.naturalHeight);
          const w = Math.round(img.naturalWidth  * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
          if (!cancelled) setDisplaySrc(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => { imgEl = null; if (!cancelled) setFailed(true); };
        img.src = blobUrl;
      })
      .catch(err => {
        if (!cancelled && err.name !== 'CanceledError' && err.name !== 'AbortError') setFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (imgEl) { imgEl.onload = null; imgEl.onerror = null; imgEl.src = ''; imgEl = null; }
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    };
  }, [src, visible, maxPx]);

  if (lazy && !visible) return <span ref={containerRef} className={className} />;
  if (failed || !src) return fallback;
  if (!displaySrc) return null;
  return <img src={displaySrc} alt={alt} className={className} />;
}
