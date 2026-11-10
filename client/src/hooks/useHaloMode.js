import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HaloSDK from '../services/HaloSDK';
import api from '../api/api';

export default function useHaloMode() {
  const navigate = useNavigate();
  const [haloMode, setHaloMode]     = useState(false);
  const haloScanInFlightRef         = useRef(false);

  async function toggleHaloMode() {
    if (haloMode) {
      setHaloMode(false);
      try { HaloSDK.showStatus('Disconnected'); } catch (_) {}
      HaloSDK.disconnect().catch(() => {});
    } else {
      setHaloMode(true);
      try {
        await HaloSDK.connect();
        HaloSDK.showStatus('CrowdView Ready');
      } catch (err) {
        console.error('[Halo] connect failed:', err);
        setHaloMode(false);
      }
    }
  }

  async function identifyFromHaloPhoto(photoUrl) {
    if (haloScanInFlightRef.current) return;
    haloScanInFlightRef.current = true;
    HaloSDK.showStatus('Scanning...');
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = photoUrl; });
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(photoUrl);

      const result = await api.post('/api/rekognition/identify', { imageData: dataUrl, detectionType: 'snap' });
      const { faces } = result.data;
      if (faces.length > 0) {
        HaloSDK.displayFaceList(faces);
        const top = faces[0];
        try { speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(top.friendName || 'Unknown'), { volume: 1 })); } catch (_) {}
        navigate('/id', { state: { photoDataUrl: dataUrl, saveToLibrary: false, prefetchedFaces: faces } });
      } else {
        HaloSDK.showStatus('No faces found');
      }
    } catch (err) {
      console.error('[Halo] identify error:', err);
      HaloSDK.showStatus('Error');
    } finally {
      haloScanInFlightRef.current = false;
    }
  }

  // Register tap + photo handlers while Halo mode is active
  useEffect(() => {
    if (!haloMode) return;
    const onTap   = () => HaloSDK.triggerCapture();
    const onPhoto = (url) => identifyFromHaloPhoto(url);
    HaloSDK.onTap(onTap);
    HaloSDK.onPhoto(onPhoto);
    return () => { HaloSDK.offTap(onTap); HaloSDK.offPhoto(onPhoto); };
  }, [haloMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean disconnect on unmount
  useEffect(() => {
    return () => { if (HaloSDK.connected) HaloSDK.disconnect().catch(() => {}); };
  }, []);

  return { haloMode, toggleHaloMode };
}
