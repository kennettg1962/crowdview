import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import {
  MovieCameraIcon, FriendsIcon, BroadcastIcon, DeleteIcon,
  BackIcon, LiveScanIcon, XIcon,
} from '../components/Icons';
import { useApp } from '../context/AppContext';
import api from '../api/api';

const SERVER_ORIGIN = window.location.protocol === 'capacitor:'
  ? 'https://crowdview.tv'
  : `${window.location.protocol}//${window.location.hostname}`;
const HLS_BASE = `${SERVER_ORIGIN}/hls`;

const STATUS_COLORS = { known: '#22c55e', identified: '#f97316', unknown: '#ef4444' };

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}

function duration(start, end) {
  const ms = new Date(end || Date.now()) - new Date(start);
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// ── Single live-stream tile in the 2×2 grid ──────────────────────────────────
function VideoTile({ stream, onClose, onExpand }) {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const [tileError, setTileError]     = useState(false);
  const [tileLoading, setTileLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    setTileError(false);
    setTileLoading(true);

    const src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { setTileError(true); setTileLoading(false); } });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {});
      video.addEventListener('error', () => { setTileError(true); setTileLoading(false); });
    } else {
      setTileError(true);
      setTileLoading(false);
    }

    video.addEventListener('playing', () => setTileLoading(false));

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [stream]);

  return (
    <div
      className="relative bg-black rounded-lg overflow-hidden cursor-pointer group w-full h-full"
      onClick={onExpand}
    >
      <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />

      {/* Initializing spinner */}
      {tileLoading && !tileError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 pointer-events-none">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          <p className="text-gray-300 text-xs">Initializing…</p>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Remove stream"
        className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <XIcon className="w-3 h-3" />
      </button>

      {/* Streamer name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 pointer-events-none">
        <p className="text-white text-xs font-medium truncate">{stream.Streamer_Name}</p>
        {stream.Title_Txt && (
          <p className="text-gray-300 text-[10px] truncate">{stream.Title_Txt}</p>
        )}
      </div>

      {/* LIVE dot */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      </div>

      {tileError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-400 text-xs text-center px-2">
          Stream unavailable
        </div>
      )}
    </div>
  );
}

// ── Empty tile placeholder ───────────────────────────────────────────────────
function EmptyTile() {
  return (
    <div className="bg-gray-800/30 rounded-lg w-full h-full flex flex-col items-center justify-center border border-dashed border-gray-700/60 pointer-events-none">
      <BroadcastIcon className="w-7 h-7 text-gray-600 opacity-40 mb-1" />
      <p className="text-gray-600 text-[11px]">Select a stream</p>
    </div>
  );
}

// ── Full-screen popup when a tile is tapped ──────────────────────────────────
function TilePopup({ stream, onClose }) {
  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const hlsRef           = useRef(null);
  const liveScanActiveRef = useRef(false);
  const scanInFlightRef  = useRef(false);

  const [popupError, setPopupError]               = useState(false);
  const [liveScan, setLiveScan]                   = useState(false);
  const [liveScanInitializing, setLiveScanInitializing] = useState(false);

  // HLS setup for popup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    setPopupError(false);

    const src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setPopupError(true); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {});
      video.addEventListener('error', () => setPopupError(true));
    } else {
      setPopupError(true);
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [stream]);

  // Live scan interval
  useEffect(() => {
    liveScanActiveRef.current = liveScan;
    if (!liveScan) {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveScanInitializing(false);
      return;
    }

    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !videoRef.current || !canvasRef.current || !liveScanActiveRef.current) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video.videoWidth || video.readyState < 3) return;

      if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const maxW    = 640;
      const scale   = Math.min(1, maxW / video.videoWidth);
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
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [liveScan]);

  function toggleLiveScan() {
    if (!liveScan) setLiveScanInitializing(true);
    setLiveScan(v => !v);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Popup header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-900 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-700"
        >
          <BackIcon className="w-6 h-6" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{stream.Streamer_Name}</p>
          {stream.Title_Txt && (
            <p className="text-gray-400 text-xs truncate">{stream.Title_Txt}</p>
          )}
        </div>

        <LiveBadge />

        <button
          onClick={toggleLiveScan}
          title="Detect faces"
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-colors text-white text-xs
            ${liveScan ? 'bg-green-700 hover:bg-green-600 animate-pulse' : 'hover:bg-gray-700'}`}
        >
          <LiveScanIcon className="w-6 h-6" />
          <span className="text-[10px]">Detect</span>
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 relative bg-black min-h-0">
        <video ref={videoRef} playsInline className="w-full h-full object-contain" />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {liveScanInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
            <p className="text-white text-sm">Initializing face detection...</p>
          </div>
        )}

        {popupError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <BroadcastIcon className="w-12 h-12 opacity-30" />
            <p className="text-sm">Stream unavailable</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StreamsScreen() {
  const navigate = useNavigate();
  const { user, isCorporate } = useApp();
  const [liveStreams, setLiveStreams]         = useState([]);
  const [pastStreams, setPastStreams]         = useState([]);
  const [loading, setLoading]                = useState(true);
  const [tab, setTab]                        = useState('live');
  const [deletingStream, setDeletingStream]  = useState(null);
  const [showDeletedToast, setShowDeletedToast] = useState(false);
  const [tiles, setTiles]                    = useState([null, null, null, null]);
  const [popupStream, setPopupStream]        = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [live, past] = await Promise.all([
        api.get('/api/stream/live'),
        api.get('/api/stream/past'),
      ]);
      setLiveStreams(live.data);
      setPastStreams(past.data);
    } catch (err) {
      console.error('Failed to load streams', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh live list every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/api/stream/live').then(r => setLiveStreams(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Remove any tile whose stream is no longer live
  useEffect(() => {
    setTiles(prev => prev.map(t =>
      t && !liveStreams.find(s => s.Stream_Id === t.Stream_Id) ? null : t
    ));
  }, [liveStreams]);

  function toggleStream(stream) {
    const existingIdx = tiles.findIndex(t => t?.Stream_Id === stream.Stream_Id);
    if (existingIdx !== -1) {
      // Already in a tile — remove it
      setTiles(prev => prev.map((t, i) => i === existingIdx ? null : t));
      if (popupStream?.Stream_Id === stream.Stream_Id) setPopupStream(null);
    } else {
      // Assign to the next empty tile
      const emptyIdx = tiles.findIndex(t => t === null);
      if (emptyIdx !== -1) {
        setTiles(prev => prev.map((t, i) => i === emptyIdx ? stream : t));
      }
    }
  }

  function clearTile(idx) {
    if (popupStream?.Stream_Id === tiles[idx]?.Stream_Id) setPopupStream(null);
    setTiles(prev => prev.map((t, i) => i === idx ? null : t));
  }

  async function confirmDeleteStream() {
    if (!deletingStream) return;
    try {
      await api.delete(`/api/stream/${deletingStream.Stream_Id}`);
      setDeletingStream(null);
      setPastStreams(prev => prev.filter(s => s.Stream_Id !== deletingStream.Stream_Id));
      setShowDeletedToast(true);
      setTimeout(() => setShowDeletedToast(false), 500);
    } catch (err) {
      console.error('Delete stream failed', err);
    }
  }

  const tilesFull = tiles.every(t => t !== null);

  return (
    <div className="h-screen bg-slate-700 flex flex-col overflow-hidden">
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">{isCorporate ? 'CrowdView Corporate' : 'CrowdView'}</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 flex-shrink-0">
        {['live', 'past'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'live' ? '🔴 Live Now' : '📼 Past Streams'}
            {t === 'live' && liveStreams.length > 0 && (
              <span className="ml-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {liveStreams.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Live Now tab ────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex justify-center mt-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : liveStreams.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-16 text-gray-500 gap-3">
              <BroadcastIcon className="w-12 h-12 opacity-30" />
              <p>Nobody is streaming right now</p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0">

              {/* Left sidebar — stream list */}
              <div className="w-28 md:w-36 flex-shrink-0 bg-gray-800/40 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
                {liveStreams.map(stream => {
                  const inTile = tiles.some(t => t?.Stream_Id === stream.Stream_Id);
                  const disabled = !inTile && tilesFull;
                  return (
                    <button
                      key={stream.Stream_Id}
                      onClick={() => toggleStream(stream)}
                      disabled={disabled}
                      title={disabled ? 'Remove a stream to add another' : undefined}
                      className={`w-full text-left p-2 rounded-lg transition-colors border
                        ${inTile
                          ? 'bg-blue-600/20 border-blue-500/60 hover:bg-blue-600/30'
                          : disabled
                            ? 'bg-gray-800 border-transparent opacity-40 cursor-not-allowed'
                            : 'bg-gray-800 border-transparent hover:bg-gray-700'
                        }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        <span className="text-white text-xs font-medium truncate">{stream.Streamer_Name}</span>
                      </div>
                      {stream.Title_Txt && (
                        <p className="text-gray-500 text-[10px] truncate pl-3">{stream.Title_Txt}</p>
                      )}
                      <p className="text-gray-600 text-[10px] pl-3">{duration(stream.Started_At, null)} ago</p>
                      {inTile && (
                        <p className="text-blue-400 text-[10px] pl-3 mt-0.5">● Showing</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 2×2 tile grid */}
              <div className="flex-1 min-w-0 min-h-0 grid grid-cols-2 grid-rows-2 gap-2 p-2">
                {tiles.map((tile, i) =>
                  tile ? (
                    <VideoTile
                      key={tile.Stream_Id}
                      stream={tile}
                      onClose={() => clearTile(i)}
                      onExpand={() => setPopupStream(tile)}
                    />
                  ) : (
                    <EmptyTile key={i} />
                  )
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── Past Streams tab ─────────────────────────────────────────────── */}
      {tab === 'past' && (
        <main className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center mt-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : pastStreams.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-16 text-gray-500 gap-3">
              <BroadcastIcon className="w-12 h-12 opacity-30" />
              <p>No past streams yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {pastStreams.map(s => (
                <div key={s.Stream_Id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-20 h-14 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <BroadcastIcon className="w-7 h-7 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium truncate">{s.Streamer_Name || 'Unknown'}</span>
                    </div>
                    <p className="text-gray-400 text-sm truncate">{s.Title_Txt}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {new Date(s.Started_At).toLocaleDateString()} · {duration(s.Started_At, s.Ended_At)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate('/streams/watch', { state: { stream: s, isLive: false } })}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                    >
                      Watch
                    </button>
                    {s.Streamer_User_Id === user?.userId && (
                      <button
                        onClick={() => setDeletingStream(s)}
                        className="p-2 text-red-400/50 hover:text-red-400 transition-colors"
                        title="Delete stream"
                      >
                        <DeleteIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      <TrueFooter />
      <NavBar />

      {/* Toast */}
      {showDeletedToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-700 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          Stream Deleted
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingStream && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete this stream?</p>
            <p className="text-gray-400 text-sm mb-1">{deletingStream.Title_Txt}</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the stream record and all recording files. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingStream(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteStream}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tile expand popup */}
      {popupStream && (
        <TilePopup stream={popupStream} onClose={() => setPopupStream(null)} />
      )}
    </div>
  );
}
