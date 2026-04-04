import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendForm from '../components/FriendForm';
import FriendFormPopup from '../components/FriendFormPopup';
import {
  MovieCameraIcon, FriendsIcon, BroadcastIcon, DeleteIcon,
  XIcon, LiveScanIcon, DownloadIcon, UserProfileIcon,
} from '../components/Icons';
import { useApp } from '../context/AppContext';
import api from '../api/api';

const SERVER_ORIGIN = window.location.protocol === 'capacitor:'
  ? 'https://crowdview.tv'
  : `${window.location.protocol}//${window.location.hostname}`;
// Capacitor apps use the Express proxy so CORS is handled (capacitor://localhost
// is in Express allowedOrigins). Desktop uses the direct nginx /hls/ route.
const HLS_BASE = window.location.protocol === 'capacitor:'
  ? `${SERVER_ORIGIN}/api/stream/hls`
  : `${SERVER_ORIGIN}/hls`;

const STATUS_COLORS = { known: '#22c55e', identified: '#f97316', unknown: '#ef4444' };
const REJOIN_THRESHOLD = 30_000;

function FaceTile({ face, onView }) {
  const accent = face.status === 'known' ? 'border-green-500' : 'border-orange-500';
  return (
    <div className={`flex items-center gap-2 p-2 bg-gray-800 rounded-lg border-l-2 ${accent}`}>
      {face.cropDataUrl && (
        <img src={face.cropDataUrl} alt={face.friendName || 'Face'} className="w-10 h-10 rounded object-cover flex-shrink-0 border border-gray-600" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{face.friendName || 'Unknown'}</p>
        {face.note && <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{face.note}</p>}
      </div>
      <button onClick={onView} title="View" className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors">
        <UserProfileIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function duration(start, end) {
  const ms = new Date(end || Date.now()) - new Date(start);
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// ── Self-contained live-stream tile ──────────────────────────────────────────
function VideoTile({ stream, onClose, scanActive, onToggleScan }) {
  const videoRef          = useRef(null);
  const canvasRef         = useRef(null);
  const hlsRef            = useRef(null);
  const liveScanActiveRef = useRef(false);
  const scanInFlightRef   = useRef(false);
  const faceLastSeenRef   = useRef({});

  const [tileError, setTileError]               = useState(false);
  const [tileLoading, setTileLoading]           = useState(true);
  const [tapToPlay, setTapToPlay]               = useState(false);
  const [retryKey, setRetryKey]                 = useState(0);
  const [liveFaces, setLiveFaces]               = useState([]);
  const [scanInitializing, setScanInitializing] = useState(false);
  const [recognizedFaces, setRecognizedFaces]   = useState([]);
  const [selectedFace, setSelectedFace]         = useState(null);
  const [liveFacePopup, setLiveFacePopup]       = useState(null);

  const selectedFriendProp = useMemo(() => {
    if (!selectedFace?.friendId) return null;
    return {
      Friend_Id:           selectedFace.friendId,
      Name_Txt:            selectedFace.friendName  || '',
      Note_Multi_Line_Txt: selectedFace.note        || '',
      Friend_Group:        selectedFace.friendGroup || 'Friend',
      Linked_User_Name:    null,
      Linked_User_Email:   null,
    };
  }, [selectedFace]);

  // HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    setTileError(false);
    setTileLoading(true);
    setTapToPlay(false);

    const src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;
    let destroyed = false;

    const clearLoading = () => { if (!destroyed) setTileLoading(false); };
    video.addEventListener('playing',    clearLoading, { once: true });
    video.addEventListener('loadeddata', clearLoading, { once: true });

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (window.location.protocol === 'capacitor:') {
          // iOS WKWebView silently blocks MSE autoplay (play() resolves but
          // immediately pauses after the first frame). Skip the attempt and
          // show a tap-to-play overlay so the user gesture triggers play().
          if (!destroyed) { setTileLoading(false); setTapToPlay(true); }
          return;
        }
        video.play().catch(() => {
          if (!destroyed) { setTileLoading(false); setTapToPlay(true); }
        });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (!destroyed) { setTileError(true); setTileLoading(false); }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.load();
      video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
      video.addEventListener('error', () => { if (!destroyed) { setTileError(true); setTileLoading(false); } });
    } else {
      setTileError(true);
      setTileLoading(false);
    }

    return () => {
      destroyed = true;
      video.removeEventListener('playing',    clearLoading);
      video.removeEventListener('loadeddata', clearLoading);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scan interval
  useEffect(() => {
    liveScanActiveRef.current = scanActive;
    if (!scanActive) {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveFaces([]);
      setScanInitializing(false);
      return;
    }
    setScanInitializing(true);

    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !videoRef.current || !canvasRef.current || !liveScanActiveRef.current) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video.videoWidth || video.readyState < 3) return;

      // Use getBoundingClientRect for reliable CSS pixel dimensions
      const bcr = canvas.getBoundingClientRect();
      const containerW = bcr.width;
      const containerH = bcr.height;
      if (!containerW || !containerH) return;
      if (canvas.width  !== containerW) canvas.width  = containerW;
      if (canvas.height !== containerH) canvas.height = containerH;

      // Calculate where the video content sits inside the container
      // (object-contain letterboxes with black bars on the narrow axis)
      const vAR = video.videoWidth / video.videoHeight;
      const cAR = containerW / containerH;
      let displayW, displayH, offsetX = 0, offsetY = 0;
      if (vAR > cAR) {
        displayW = containerW; displayH = containerW / vAR;
        offsetY = (containerH - displayH) / 2;
      } else {
        displayH = containerH; displayW = containerH * vAR;
        offsetX = (containerW - displayW) / 2;
      }

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

        const facesWithCrops = faces.map(face => {
          const bb = face.boundingBox;
          const cx = Math.round(bb.left   * capture.width);
          const cy = Math.round(bb.top    * capture.height);
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

        // Accumulate face tiles — only re-render for new or returning faces
        const now = Date.now();
        const toAdd = [], toMove = [];
        facesWithCrops.forEach(f => {
          if ((f.status !== 'known' && f.status !== 'identified') || !f.friendId) return;
          const lastSeen = faceLastSeenRef.current[f.friendId] || 0;
          faceLastSeenRef.current[f.friendId] = now;
          if (lastSeen === 0) toAdd.push(f);
          else if (now - lastSeen > REJOIN_THRESHOLD) toMove.push(f);
        });
        if (toAdd.length > 0 || toMove.length > 0) {
          setRecognizedFaces(prev => {
            const movingIds = new Set(toMove.map(f => f.friendId));
            return [...toAdd, ...toMove, ...prev.filter(f => !movingIds.has(f.friendId))];
          });
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        facesWithCrops.forEach(face => {
          const { boundingBox, status, friendName } = face;
          const x = offsetX + boundingBox.left   * displayW;
          const y = offsetY + boundingBox.top    * displayH;
          const w =           boundingBox.width  * displayW;
          const h =           boundingBox.height * displayH;
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
        setScanInitializing(false);
      }
    }, 300);

    return () => {
      clearInterval(interval);
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [scanActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative bg-black rounded-lg overflow-hidden flex w-full h-full group">

      {/* Video — fixed left 60% */}
      <div className="relative w-[60%] flex-shrink-0 min-h-0">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" />

        {/* Detect button — float top-left on video */}
        <button
          onClick={e => { e.stopPropagation(); onToggleScan(); }}
          title={scanActive ? 'Stop detect' : 'Detect faces'}
          className={`absolute left-2 top-2 z-20 flex flex-col items-center gap-0.5
            px-2 py-2 rounded-lg transition-colors backdrop-blur-sm
            ${scanActive ? 'bg-green-700/90 hover:bg-green-600/90 animate-pulse' : 'bg-black/50 hover:bg-black/70'}`}
        >
          <LiveScanIcon className="w-5 h-5 text-white" />
          <span className="text-white text-[9px] font-medium">Detect</span>
        </button>

        <canvas
          ref={canvasRef}
          onClick={e => {
            if (!scanActive || !canvasRef.current || !videoRef.current || liveFaces.length === 0) return;
            const canvas = canvasRef.current;
            const video  = videoRef.current;
            const rect   = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const vAR = video.videoWidth / video.videoHeight;
            const cAR = rect.width / rect.height;
            let displayW, displayH, offsetX = 0, offsetY = 0;
            if (vAR > cAR) {
              displayW = rect.width;  displayH = rect.width / vAR;
              offsetY = (rect.height - displayH) / 2;
            } else {
              displayH = rect.height; displayW = rect.height * vAR;
              offsetX = (rect.width - displayW) / 2;
            }
            const hit = liveFaces.find(face => {
              const x = offsetX + face.boundingBox.left  * displayW;
              const y = offsetY + face.boundingBox.top   * displayH;
              const w =           face.boundingBox.width * displayW;
              const h =           face.boundingBox.height * displayH;
              return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
            });
            if (hit) setLiveFacePopup(hit);
          }}
          className={`absolute inset-0 w-full h-full ${scanActive && liveFaces.length > 0 ? 'cursor-pointer' : 'pointer-events-none'}`}
        />

        {/* Spinner */}
        {(scanInitializing || (tileLoading && !tileError)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 pointer-events-none">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${scanInitializing ? 'border-green-400' : 'border-blue-400'}`} />
            <p className="text-gray-300 text-xs">{scanInitializing ? 'Initializing detect…' : 'Initializing…'}</p>
          </div>
        )}

        {/* Tap-to-play overlay */}
        {tapToPlay && !tileError && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer z-10"
            onClick={e => { e.stopPropagation(); videoRef.current?.play().then(() => setTapToPlay(false)).catch(() => {}); }}
          >
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Streamer name — bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 pointer-events-none">
          <p className="text-white text-xs font-medium truncate">{stream.Streamer_Name}</p>
          {stream.Title_Txt && <p className="text-gray-300 text-[10px] truncate">{stream.Title_Txt}</p>}
        </div>

        {/* LIVE dot */}
        <div className="absolute top-1.5 left-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse block" />
        </div>

        {/* Close button */}
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          title="Remove stream"
          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XIcon className="w-3 h-3" />
        </button>

        {tileError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-gray-400 text-xs text-center px-2">
            <p>Stream unavailable</p>
            <button
              onClick={e => { e.stopPropagation(); setTileError(false); setTileLoading(true); setRetryKey(k => k + 1); }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {liveFacePopup && (
        <FriendFormPopup
          friend={liveFacePopup.friendId ? { Friend_Id: liveFacePopup.friendId, Name_Txt: liveFacePopup.friendName } : null}
          capturedPhotoUrl={liveFacePopup.cropDataUrl || null}
          onClose={() => setLiveFacePopup(null)}
          onSave={(saved) => {
            if (saved?.friendId) {
              faceLastSeenRef.current[saved.friendId] = Date.now();
              setRecognizedFaces(prev => prev.map(f =>
                f.faceId === liveFacePopup.faceId
                  ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId }
                  : f
              ));
            }
            setLiveFacePopup(null);
          }}
        />
      )}

      {/* Right panel — FriendForm when viewing, face tiles otherwise */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        {selectedFace ? (
          <FriendForm
            friend={selectedFriendProp}
            capturedPhotoUrl={!selectedFace.friendId ? selectedFace.cropDataUrl : null}
            onClose={() => setSelectedFace(null)}
            onSave={() => setSelectedFace(null)}
            onDelete={() => setSelectedFace(null)}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {recognizedFaces.length === 0 ? (
              <p className="text-gray-400 text-[10px] text-center mt-4">
                {scanActive ? 'Scanning…' : 'Press Detect'}
              </p>
            ) : (
              recognizedFaces.map((face, i) => (
                <FaceTile key={face.friendId || i} face={face} onView={() => setSelectedFace(face)} />
              ))
            )}
          </div>
        )}
      </div>
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function StreamsScreen() {
  const navigate = useNavigate();
  const { user, isCorporate, isBackOffice } = useApp();
  const [liveStreams, setLiveStreams]            = useState([]);
  const [pastStreams, setPastStreams]            = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [tab, setTab]                           = useState('live');
  const [deletingStream, setDeletingStream]     = useState(null);
  const [showDeletedToast, setShowDeletedToast] = useState(false);
  const [tiles, setTiles]                       = useState([null, null, null, null]);
  const [activeScanIdx, setActiveScanIdx]       = useState(null);
  const scanTimerRef                            = useRef(null);

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

  // Refresh past streams whenever the user switches to the Past tab
  useEffect(() => {
    if (tab === 'past') {
      api.get('/api/stream/past').then(r => setPastStreams(r.data)).catch(() => {});
    }
  }, [tab]);

  // While any past stream is still encoding, poll every 5s to pick up when it finishes
  useEffect(() => {
    if (tab !== 'past') return;
    const anyEncoding = pastStreams.some(s => s.Encoding_Fl === 'Y');
    if (!anyEncoding) return;
    const id = setInterval(() => {
      api.get('/api/stream/past').then(r => setPastStreams(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [tab, pastStreams]);

  // Poll live streams every 5s when the live tab is active, 30s otherwise
  useEffect(() => {
    const interval = tab === 'live' ? 5000 : 30000;
    const id = setInterval(() => {
      api.get('/api/stream/live').then(r => setLiveStreams(r.data)).catch(() => {});
    }, interval);
    return () => clearInterval(id);
  }, [tab]);

  // Remove tiles whose streams went offline
  useEffect(() => {
    setTiles(prev => prev.map(t =>
      t && !liveStreams.find(s => s.Stream_Id === t.Stream_Id) ? null : t
    ));
  }, [liveStreams]);

  // Heartbeat while watching any stream — keeps the user "Active" in the dashboard
  const watching = tiles.some(t => t !== null);
  useEffect(() => {
    if (!watching) return;
    const beat = () => api.post('/api/users/heartbeat').catch(() => {});
    beat();
    const id = setInterval(beat, 15000);
    return () => clearInterval(id);
  }, [watching]);

  // Only one detect active at a time; auto-off after 15 s
  function stopScan() {
    clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    setActiveScanIdx(null);
  }

  function handleToggleScan(idx) {
    setActiveScanIdx(prev => {
      if (prev === idx) {
        // manual off
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
        return null;
      }
      // turning on — start 15 s auto-off timer
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(stopScan, 15000);
      return idx;
    });
  }

  function toggleStream(stream) {
    const existingIdx = tiles.findIndex(t => t?.Stream_Id === stream.Stream_Id);
    if (existingIdx !== -1) {
      if (activeScanIdx === existingIdx) stopScan();
      setTiles(prev => prev.map((t, i) => i === existingIdx ? null : t));
    } else {
      const emptyIdx = tiles.findIndex(t => t === null);
      if (emptyIdx !== -1) setTiles(prev => prev.map((t, i) => i === emptyIdx ? stream : t));
    }
  }

  function clearTile(idx) {
    if (activeScanIdx === idx) stopScan();
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
          !isBackOffice && (
            <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
              <MovieCameraIcon className="w-[30px] h-[30px]" />
            </button>
          )
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight">{isCorporate ? <><div>CrowdView</div><div>Corporate</div></> : 'CrowdView'}</span>}
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
              tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'
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
            <div className="flex flex-1 min-h-0 overflow-y-auto md:overflow-hidden">

              {/* Left sidebar — stream list */}
              <div className="w-28 md:w-36 flex-shrink-0 bg-gray-800/40 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
                {liveStreams.map(stream => {
                  const inTile   = tiles.some(t => t?.Stream_Id === stream.Stream_Id);
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
                      {inTile && <p className="text-blue-400 text-[10px] pl-3 mt-0.5">● Showing</p>}
                    </button>
                  );
                })}
              </div>

              {/* Tiles — single scrollable column on mobile, 2×2 grid on desktop */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-2 p-2 md:min-h-0 md:overflow-hidden">
                {tiles.map((tile, i) =>
                  tile ? (
                    <div key={tile.Stream_Id} className="h-64 md:h-auto">
                      <VideoTile
                        stream={tile}
                        onClose={() => clearTile(i)}
                        scanActive={activeScanIdx === i}
                        onToggleScan={() => handleToggleScan(i)}
                      />
                    </div>
                  ) : (
                    <div key={i} className="h-64 md:h-auto">
                      <EmptyTile />
                    </div>
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
                    {s.Encoding_Fl === 'Y'
                      ? <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-amber-400" />
                      : <BroadcastIcon className="w-7 h-7 text-gray-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium truncate">{s.Streamer_Name || 'Unknown'}</span>
                      {s.Encoding_Fl === 'Y' && (
                        <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400 border border-amber-600/40">encoding…</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate">{s.Title_Txt}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(s.Started_At).toLocaleString()} – {s.Ended_At ? new Date(s.Ended_At).toLocaleTimeString() : '?'}
                    </p>
                    <p className="text-gray-600 text-xs">{duration(s.Started_At, s.Ended_At)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.Encoding_Fl !== 'Y' && s.recordings?.length > 0 && (
                      <a
                        href={`${s.recordings[0].url}?download=1`}
                        download={s.recordings[0].filename}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                        title="Export MP4"
                      >
                        <DownloadIcon className="w-5 h-5" />
                      </a>
                    )}
                    <button
                      onClick={() => navigate('/streams/watch', { state: { stream: s, isLive: false } })}
                      disabled={s.Encoding_Fl === 'Y'}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
                    >
                      Watch
                    </button>
                    {(s.Streamer_User_Id === user?.userId || (isCorporate && (user?.corporateAdminFl === 'Y' || user?.corporateAdminFl === 'B'))) && (
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

      {showDeletedToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-700 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          Stream Deleted
        </div>
      )}

      {deletingStream && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete this stream?</p>
            <p className="text-gray-400 text-sm mb-1">{deletingStream.Title_Txt}</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the stream record and all recording files. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingStream(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={confirmDeleteStream} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
