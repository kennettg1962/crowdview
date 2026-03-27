import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { BackIcon, BroadcastIcon, IdIcon, PlayIcon, LiveScanIcon } from '../components/Icons';
import api from '../api/api';

// Capacitor native apps use protocol 'capacitor:' — window.location.hostname is 'localhost'
// so we must use the real server origin instead
const SERVER_ORIGIN = window.location.protocol === 'capacitor:'
  ? 'https://crowdview.tv'
  : `${window.location.protocol}//${window.location.hostname}`;
const HLS_BASE = `${SERVER_ORIGIN}/hls`;

const STATUS_COLORS = {
  known:      '#22c55e',
  identified: '#f97316',
  unknown:    '#ef4444',
};

export default function StreamWatchScreen() {
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const stream     = state?.stream;
  const isLive     = state?.isLive ?? true;

  const videoRef          = useRef(null);
  const hlsRef            = useRef(null);
  const videoContainerRef = useRef(null);
  const overlayCanvasRef  = useRef(null);
  const liveScanActiveRef = useRef(false);
  const scanInFlightRef   = useRef(false);

  const [error, setError]                       = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [idFaces, setIdFaces]                   = useState([]);
  const [idLoading, setIdLoading]               = useState(false);
  const [idError, setIdError]                   = useState(null);
  const [videoRendered, setVideoRendered]       = useState(null);
  const [liveScan, setLiveScan]                 = useState(false);
  const [liveScanInitializing, setLiveScanInitializing] = useState(false);

  const calcVideoRendered = useCallback(() => {
    const video = videoRef.current;
    const container = videoContainerRef.current;
    if (!video || !container || !video.videoWidth) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
    setVideoRendered({
      width:  Math.round(video.videoWidth  * scale),
      height: Math.round(video.videoHeight * scale),
    });
  }, []);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(calcVideoRendered);
    ro.observe(container);
    return () => ro.disconnect();
  }, [calcVideoRendered]);

  // ── Video / HLS setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    if (!video) return;

    if (!isLive) {
      const rec = stream.recordings?.[0];
      if (!rec) { setError('No recording available for this stream.'); setLoading(false); return; }
      video.src = rec.url;
      let metadataLoaded = false;
      video.addEventListener('loadedmetadata', () => {
        metadataLoaded = true;
        setError(null); // clear any transient error that fired before metadata arrived
        setLoading(false);
        calcVideoRendered();
      });
      video.addEventListener('error', () => {
        // Ignore errors after metadata loaded — video is playable; these are
        // transient range-request cancellations from the browser's media engine.
        if (metadataLoaded) return;
        setError('Recording unavailable or could not be loaded.');
        setLoading(false);
      });
      return;
    }

    const src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setLoading(false); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) { setError('Stream unavailable. It may have ended or not started yet.'); setLoading(false); }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => {}); });
      video.addEventListener('error', () => { setError('Stream unavailable.'); setLoading(false); });
    } else {
      setError('Your browser does not support HLS streaming.');
      setLoading(false);
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [stream, isLive, calcVideoRendered]);

  // ── Live scan interval ─────────────────────────────────────────────────────
  useEffect(() => {
    liveScanActiveRef.current = liveScan;
    if (!liveScan) {
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveScanInitializing(false);
      return;
    }

    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !videoRef.current || !overlayCanvasRef.current || !liveScanActiveRef.current) return;
      const video = videoRef.current;
      if (!video.videoWidth || video.readyState < 3) return;

      const canvas = overlayCanvasRef.current;
      if (canvas.width !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const maxW = 640;
      const scale = Math.min(1, maxW / video.videoWidth);
      const capture = document.createElement('canvas');
      capture.width  = Math.round(video.videoWidth  * scale);
      capture.height = Math.round(video.videoHeight * scale);
      capture.getContext('2d').drawImage(video, 0, 0, capture.width, capture.height);
      const dataUrl = capture.toDataURL('image/jpeg', 0.8);

      scanInFlightRef.current = true;
      try {
        const res = await api.post('/api/rekognition/identify', { imageData: dataUrl });
        if (!liveScanActiveRef.current) return;
        const { faces } = res.data;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        faces.forEach(face => {
          const { boundingBox, status, friendName } = face;
          const x = boundingBox.left   * canvas.width;
          const y = boundingBox.top    * canvas.height;
          const w = boundingBox.width  * canvas.width;
          const h = boundingBox.height * canvas.height;
          const color = STATUS_COLORS[status] || '#ffffff';

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

  // ── VOD Id handlers ────────────────────────────────────────────────────────
  async function handleId() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIdFaces([]);
    setIdError(null);
    setIdLoading(true);
    const canvas = document.createElement('canvas');
    const maxW = 1280;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width  = Math.round(video.videoWidth  * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    try {
      const res = await api.post('/api/rekognition/identify', { imageData: dataUrl });
      setIdFaces(res.data.faces || []);
      if ((res.data.faces || []).length === 0) setIdError('No faces detected');
    } catch {
      setIdError('Identification failed — please try again');
    } finally {
      setIdLoading(false);
    }
  }

  function handleResume() {
    setIdFaces([]);
    setIdError(null);
    videoRef.current?.play().catch(() => {});
  }

  function toggleLiveScan() {
    if (!liveScan) setLiveScanInitializing(true);
    setLiveScan(v => !v);
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-slate-700 flex items-center justify-center text-gray-400">
        <p>No stream selected. <button onClick={() => navigate('/streams')} className="text-blue-400 underline">Go to Streams</button></p>
      </div>
    );
  }

  const showVodButtons = !isLive && !loading && !error;
  const hasFaces = idFaces.length > 0;

  return (
    <div className="h-screen bg-slate-700 flex flex-col overflow-hidden">
      <AppHeader
        left={
          <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <BackIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={<div className="w-[46px]" />}
      />

      <main className="flex-1 flex min-h-0 md:items-stretch md:px-2 md:pb-2 md:gap-0 overflow-hidden">

        {/* Desktop left sidebar */}
        <div className="hidden md:flex w-[15%] bg-slate-700 rounded-l-xl flex-col">
          {/* Live button (live streams only) */}
          {isLive && !loading && !error && (
            <button
              onClick={toggleLiveScan}
              title="Live"
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg transition-colors w-full text-white
                ${liveScan ? 'bg-green-700 hover:bg-green-600 animate-pulse' : 'hover:bg-slate-600'}`}
            >
              <LiveScanIcon className="w-[42px] h-[42px]" />
              <span className="text-xs font-medium">Detect</span>
            </button>
          )}
          {/* Id / Resume buttons (VOD only) */}
          {showVodButtons && !hasFaces && (
            <button
              onClick={handleId}
              disabled={idLoading}
              title="Id"
              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg transition-colors w-full text-white hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IdIcon className="w-[42px] h-[42px]" />
              <span className="text-xs font-medium">Id</span>
            </button>
          )}
          {showVodButtons && hasFaces && (
            <button
              onClick={handleResume}
              title="Resume"
              className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg transition-colors w-full text-white hover:bg-slate-600"
            >
              <PlayIcon className="w-[42px] h-[42px]" />
              <span className="text-xs font-medium">Resume</span>
            </button>
          )}
        </div>

        {/* Video column */}
        <div className="flex-1 min-w-0 relative bg-black md:bg-white md:flex md:flex-col md:items-center md:justify-center md:p-3 md:border-t md:border-b md:border-gray-200 overflow-hidden">
          <div
            ref={videoContainerRef}
            className="w-full h-full md:w-auto md:h-auto md:flex-1 bg-black md:border-2 md:border-white md:rounded-sm overflow-hidden relative flex items-center justify-center"
          >
            {/* Video + bounding box wrapper */}
            <div
              className="relative flex-shrink-0"
              style={videoRendered || { width: '100%', height: '100%' }}
            >
              <video
                ref={videoRef}
                controls={!hasFaces && !liveScan}
                playsInline
                className="block w-full h-full object-contain"
              />

              {/* Live scan canvas overlay */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* VOD face bounding boxes */}
              {hasFaces && videoRendered && idFaces.map((face, i) => {
                const { left, top, width, height } = face.boundingBox;
                const color = STATUS_COLORS[face.status] || '#ffffff';
                const labelAbove = top > 0.5;
                return (
                  <div
                    key={face.faceId || i}
                    style={{
                      position: 'absolute',
                      left:   `${left   * 100}%`,
                      top:    `${top    * 100}%`,
                      width:  `${width  * 100}%`,
                      height: `${height * 100}%`,
                      border: `2px solid ${color}`,
                      boxSizing: 'border-box',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      [labelAbove ? 'bottom' : 'top']: '100%',
                      left: 0,
                      background: color,
                      color: '#000',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '1px 4px',
                      whiteSpace: 'nowrap',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {face.friendName || 'Unknown'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
                <p className="text-white text-sm">Connecting to stream...</p>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <BroadcastIcon className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400 text-sm text-center px-8">{error}</p>
                <button onClick={() => navigate('/streams')} className="text-blue-400 underline text-sm">Back to Streams</button>
              </div>
            )}

            {/* Live scan initializing overlay */}
            {liveScanInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 pointer-events-none">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
                <p className="text-white text-sm">Initializing face detection...</p>
              </div>
            )}

            {/* VOD identifying overlay */}
            {idLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 pointer-events-none">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
                <p className="text-white text-sm">Identifying faces...</p>
              </div>
            )}

            {/* VOD Id result pill */}
            {!idLoading && (hasFaces || idError) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full pointer-events-none">
                {hasFaces ? (
                  <>
                    <span className="text-white text-xs font-semibold">{idFaces.length} face{idFaces.length !== 1 ? 's' : ''}</span>
                    <span className="text-white/40 text-xs">·</span>
                    <span className="text-green-400 text-xs">{idFaces.filter(f => f.status === 'known').length} friend{idFaces.filter(f => f.status === 'known').length !== 1 ? 's' : ''}</span>
                    <span className="text-white/40 text-xs">·</span>
                    <span className="text-red-400 text-xs">{idFaces.filter(f => f.status === 'unknown').length} unknown</span>
                  </>
                ) : (
                  <span className="text-gray-300 text-xs">{idError}</span>
                )}
              </div>
            )}

            {/* Stream info overlay */}
            {!loading && !error && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex items-center gap-2 pointer-events-none">
                <BroadcastIcon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="text-white text-sm font-medium truncate">{stream.Streamer_Name || 'Unknown'}</span>
                {stream.Title_Txt && <><span className="text-gray-500 text-sm">·</span><span className="text-gray-300 text-sm truncate">{stream.Title_Txt}</span></>}
                {isLive && (
                  <span className="ml-auto flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
            )}

            {/* Mobile overlays */}
            <div
              className="md:hidden absolute left-3 flex gap-2"
              style={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}
            >
              {/* Mobile Live button */}
              {isLive && !loading && !error && (
                <button
                  onClick={toggleLiveScan}
                  title="Live"
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg transition-colors text-white
                    ${liveScan ? 'bg-green-700 hover:bg-green-600 animate-pulse' : 'bg-black/35 hover:bg-white/20'}`}
                >
                  <LiveScanIcon className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Detect</span>
                </button>
              )}
              {/* Mobile Id / Resume buttons */}
              {showVodButtons && !hasFaces && (
                <button
                  onClick={handleId}
                  disabled={idLoading}
                  title="Id"
                  className="flex flex-col items-center gap-0.5 px-2.5 py-2 bg-black/35 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg transition-colors"
                >
                  <IdIcon className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Id</span>
                </button>
              )}
              {showVodButtons && hasFaces && (
                <button
                  onClick={handleResume}
                  title="Resume"
                  className="flex flex-col items-center gap-0.5 px-2.5 py-2 bg-black/35 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  <PlayIcon className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Resume</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop right sidebar spacer */}
        <div className="hidden md:block w-[15%] bg-slate-700 rounded-r-xl" />
      </main>

      <NavBar />
      <TrueFooter />
    </div>
  );
}
