import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { BackIcon, BroadcastIcon, IdIcon } from '../components/Icons';
import api from '../api/api';

const HLS_BASE = `${window.location.protocol}//${window.location.hostname}/hls`;

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

  const [error, setError]               = useState(null);
  const [loading, setLoading]           = useState(true);
  const [idFaces, setIdFaces]           = useState([]);
  const [idLoading, setIdLoading]       = useState(false);
  const [idError, setIdError]           = useState(null);
  const [videoRendered, setVideoRendered] = useState(null); // {width, height} px

  // Calculate the rendered video dimensions inside the object-contain container
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

  // Keep rendered size in sync with container resize
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(calcVideoRendered);
    ro.observe(container);
    return () => ro.disconnect();
  }, [calcVideoRendered]);

  useEffect(() => {
    if (!stream) return;

    const video = videoRef.current;
    if (!video) return;

    if (!isLive) {
      // VOD: play the recorded .mp4 directly via the native video element
      const rec = stream.recordings?.[0];
      if (!rec) { setError('No recording available for this stream.'); setLoading(false); return; }
      video.src = rec.url;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        calcVideoRendered();
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setError('Recording unavailable or could not be loaded.');
        setLoading(false);
      });
      return;
    }

    // Live HLS stream from MediaMTX
    const src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError('Stream unavailable. It may have ended or not started yet.');
          setLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setError('Stream unavailable.');
        setLoading(false);
      });
    } else {
      setError('Your browser does not support HLS streaming.');
      setLoading(false);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream, isLive, calcVideoRendered]);

  async function handleId() {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIdFaces([]);
    setIdError(null);
    setIdLoading(true);

    // Capture current frame to canvas
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

  if (!stream) {
    return (
      <div className="min-h-screen bg-slate-700 flex items-center justify-center text-gray-400">
        <p>No stream selected. <button onClick={() => navigate('/streams')} className="text-blue-400 underline">Go to Streams</button></p>
      </div>
    );
  }

  const showIdOverlay = !isLive && !loading && !error;
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

      {/* Stream info bar */}
      <div className="bg-gray-800 px-4 py-2 flex items-center gap-3 border-b border-gray-700">
        <BroadcastIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-white font-medium text-sm">{stream.Streamer_Name || 'Unknown'}</span>
          <span className="text-gray-500 text-sm mx-2">·</span>
          <span className="text-gray-400 text-sm">{stream.Title_Txt}</span>
        </div>
        {isLive && (
          <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Video */}
      <div ref={videoContainerRef} className="flex-1 bg-black flex items-center justify-center relative min-h-0">

        {/* Video + bounding box wrapper */}
        <div
          className="relative flex-shrink-0"
          style={videoRendered || { width: '100%', height: '100%' }}
        >
          <video
            ref={videoRef}
            controls={!hasFaces}
            playsInline
            className="block w-full h-full object-contain"
          />

          {/* Face bounding boxes */}
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
            <button onClick={() => navigate('/streams')} className="text-blue-400 underline text-sm">
              Back to Streams
            </button>
          </div>
        )}

        {/* Id identifying overlay */}
        {idLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
            <p className="text-white text-sm">Identifying faces...</p>
          </div>
        )}

        {/* Id result message */}
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

        {/* Id + Resume buttons (VOD only) */}
        {showIdOverlay && (
          <div className="absolute top-3 left-3 flex gap-2">
            {!hasFaces ? (
              <button
                onClick={handleId}
                disabled={idLoading}
                className="flex flex-col items-center gap-0.5 px-3 py-2 bg-black/40 hover:bg-black/60 disabled:opacity-50 text-white rounded-xl backdrop-blur-sm"
                title="Identify faces"
              >
                <IdIcon className="w-7 h-7" />
                <span className="text-[10px] font-semibold leading-none">Id</span>
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="px-3 py-2 bg-black/40 hover:bg-black/60 text-white text-sm font-semibold rounded-xl backdrop-blur-sm"
              >
                Resume
              </button>
            )}
          </div>
        )}
      </div>

      <NavBar />
      <TrueFooter />
    </div>
  );
}
