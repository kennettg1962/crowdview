import { useState, useEffect } from 'react';
import api from '../api/api';

/**
 * Renders an image fetched with the JWT auth header.
 * Use this wherever an <img> points to a protected /api/* endpoint.
 * Falls through to a plain <img> for data: URLs (no auth needed).
 */
export default function AuthImage({ src, alt = '', className = '', fallback = null }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) return;
    // data: and blob: URLs don't need auth — use directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setBlobUrl(src);
      return;
    }
    let objectUrl;
    setFailed(false);
    api.get(src, { responseType: 'blob' })
      .then(res => {
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed || !src) return fallback;
  if (!blobUrl) return null;
  return <img src={blobUrl} alt={alt} className={className} />;
}
