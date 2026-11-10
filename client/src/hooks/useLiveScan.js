import { useState, useRef, useEffect } from 'react';
import MetaGlassesDisplay from '../services/MetaGlassesDisplay';
import api from '../api/api';

const REJOIN_THRESHOLD = 30_000; // 30 s absence = treat as returning

export default function useLiveScan({
  overlayCanvasRef,
  videoRef,
  captureMode,
  isCorporate,
  isMetaMode,
  getCaptureFrame,
}) {
  const [liveScan, setLiveScan]                   = useState(false);
  const [liveScanInitializing, setLiveScanInitializing] = useState(false);
  const [liveFaces, setLiveFaces]                 = useState([]);
  const [liveFaceVoiceIdx, setLiveFaceVoiceIdx]   = useState(-1);
  const [recognizedFaces, setRecognizedFaces]     = useState([]);
  const [subscription, setSubscription]           = useState(null);

  const scanInFlightRef    = useRef(false);
  const liveScanActiveRef  = useRef(false);
  const liveSessionIdRef   = useRef(null);
  const faceLastSeenRef    = useRef({});

  // Use refs for values read inside the interval so they're never stale without
  // needing to restart the interval when they change.
  const isCorporateRef = useRef(isCorporate);
  useEffect(() => { isCorporateRef.current = isCorporate; }, [isCorporate]);
  const isMetaModeRef  = useRef(isMetaMode);
  useEffect(() => { isMetaModeRef.current = isMetaMode; }, [isMetaMode]);

  // ── Subscription fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isCorporate) return;
    api.get('/api/subscription/status').then(r => setSubscription(r.data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close open session on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      const sid = liveSessionIdRef.current;
      if (sid) {
        liveSessionIdRef.current = null;
        api.post('/api/subscription/live/end', { sessionId: sid }).catch(() => {});
      }
    };
  }, []);

  // ── Start / stop ────────────────────────────────────────────────────────────
  async function startLiveScan() {
    if (!isCorporateRef.current) {
      try {
        const r = await api.post('/api/subscription/live/start');
        liveSessionIdRef.current = r.data.sessionId;
        setSubscription(prev => ({
          ...prev,
          canUseLive: r.data.canUseLive,
          minutesRemaining: r.data.minutesRemaining,
          isUnlimited: r.data.isUnlimited,
        }));
      } catch (err) {
        if (err.response?.status === 403) return; // no live minutes — keep button off
      }
    }
    setLiveScan(true);
    setLiveScanInitializing(true);
  }

  function stopLiveScan() {
    setLiveScan(false);
    const sid = liveSessionIdRef.current;
    if (sid) {
      liveSessionIdRef.current = null;
      api.post('/api/subscription/live/end', { sessionId: sid })
        .then(r => {
          if (r.data.minutesRemaining !== undefined) {
            setSubscription(prev => ({ ...prev, minutesRemaining: r.data.minutesRemaining }));
          }
        })
        .catch(() => {});
    }
  }

  // Reset voice index when live stops
  useEffect(() => {
    if (!liveScan) setLiveFaceVoiceIdx(-1);
  }, [liveScan]);

  // ── Scan interval ───────────────────────────────────────────────────────────
  useEffect(() => {
    liveScanActiveRef.current = liveScan;
    if (!liveScan) {
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveFaces([]);
      setRecognizedFaces([]);
      faceLastSeenRef.current = {};
      setLiveScanInitializing(false);
      return;
    }

    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !overlayCanvasRef.current || !liveScanActiveRef.current) return;

      const canvas = overlayCanvasRef.current;

      // Sync overlay canvas to native video resolution before capturing
      if (captureMode === 'phone') {
        const video = videoRef.current;
        if (!video || !video.videoWidth || video.readyState < 3) return;
        if (canvas.width !== video.videoWidth)   canvas.width  = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      }

      const capture = await getCaptureFrame(1280, 0.82).catch(() => null);
      if (!capture || !liveScanActiveRef.current) return;
      const dataUrl = capture.toDataURL('image/jpeg', 0.8);

      scanInFlightRef.current = true;
      try {
        const res = await api.post('/api/rekognition/identify', { imageData: dataUrl, detectionType: 'live' });
        if (!liveScanActiveRef.current) return;
        const { faces } = res.data;

        const facesWithCrops = faces.map(face => {
          const bb = face.boundingBox;
          const cx = Math.round(bb.left * capture.width);
          const cy = Math.round(bb.top  * capture.height);
          const cw = Math.round(bb.width  * capture.width);
          const ch = Math.round(bb.height * capture.height);
          if (cw > 0 && ch > 0) {
            const crop = document.createElement('canvas');
            crop.width = cw; crop.height = ch;
            crop.getContext('2d').drawImage(capture, cx, cy, cw, ch, 0, 0, cw, ch);
            return { ...face, cropDataUrl: crop.toDataURL('image/jpeg', 0.9) };
          }
          return face;
        });
        setLiveFaces(facesWithCrops);

        if (isMetaModeRef.current) MetaGlassesDisplay.sendOverlay(facesWithCrops);

        // Corporate live mode: accumulate tiles without re-rendering on every cycle.
        // faceLastSeenRef tracks timestamps by key — only new/returning faces trigger state.
        if (isCorporateRef.current) {
          const now = Date.now();
          const toAdd = [];
          const toMove = [];
          facesWithCrops.forEach(f => {
            const key = f.friendId || f.employeeId || f.faceId;
            if (!key) return;
            const lastSeen = faceLastSeenRef.current[key] || 0;
            faceLastSeenRef.current[key] = now;
            if (lastSeen === 0) {
              toAdd.push(f);
            } else if (now - lastSeen > REJOIN_THRESHOLD) {
              toMove.push(f);
            }
          });
          if (toAdd.length > 0 || toMove.length > 0) {
            setRecognizedFaces(prev => {
              const movingKeys = new Set(toMove.map(f => f.friendId || f.employeeId || f.faceId));
              const filtered = prev.filter(f => !movingKeys.has(f.friendId || f.employeeId || f.faceId));
              return [...toAdd, ...toMove, ...filtered];
            });
          }
        }

        // Draw bounding boxes on overlay canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        facesWithCrops.forEach(face => {
          const { boundingBox, status, friendName } = face;
          const bx = boundingBox.left   * canvas.width;
          const by = boundingBox.top    * canvas.height;
          const bw = boundingBox.width  * canvas.width;
          const bh = boundingBox.height * canvas.height;
          const x = Math.max(0, bx - bw * 0.05);
          const y = Math.max(0, by - bh * 0.05);
          const w = Math.min(canvas.width  - x, bw * 1.1);
          const h = Math.min(canvas.height - y, bh * 1.1);

          const color = face.undesirable        ? '#ec4899'
                      : status === 'employee'   ? '#ffffff'
                      : status === 'known'      ? (face.tier?.color || '#22c55e')
                      : status === 'identified' ? '#f97316'
                      : '#ef4444';

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          const label = friendName || 'Unknown';
          ctx.font = 'bold 13px sans-serif';
          const textW = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x, y - 20, textW + 8, 20);
          ctx.fillStyle = color;
          ctx.fillText(label, x + 4, y - 5);
        });
      } catch (err) {
        console.error('[LiveScan] error:', err);
      } finally {
        scanInFlightRef.current = false;
        setLiveScanInitializing(false);
      }
    }, 300);

    return () => {
      clearInterval(interval);
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [liveScan]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    liveScan,
    liveScanInitializing,
    liveFaces,
    liveFaceVoiceIdx,
    setLiveFaceVoiceIdx,
    recognizedFaces,
    setRecognizedFaces,
    subscription,
    faceLastSeenRef,
    startLiveScan,
    stopLiveScan,
  };
}
