import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { BackIcon, BroadcastIcon } from '../components/Icons';

const HLS_BASE = `${window.location.protocol}//${window.location.hostname}/hls`;

export default function StreamWatchScreen() {
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const stream     = state?.stream;
  const isLive     = state?.isLive ?? true;

  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stream) return;

    let src;
    if (isLive) {
      // Live HLS stream from MediaMTX
      src = `${HLS_BASE}/live/${stream.Stream_Key_Txt}/index.m3u8`;
    } else {
      // VOD: use first recording file if available
      const rec = stream.recordings?.[0];
      if (!rec) { setError('No recording available for this stream.'); setLoading(false); return; }
      src = rec.url;
    }

    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: isLive,
        backBufferLength: isLive ? 0 : 30,
      });
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
  }, [stream, isLive]);

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        <p>No stream selected. <button onClick={() => navigate('/streams')} className="text-blue-400 underline">Go to Streams</button></p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
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
      <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full h-full object-contain"
        />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
            <p className="text-white text-sm">Connecting to stream...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <BroadcastIcon className="w-12 h-12 text-gray-600" />
            <p className="text-gray-400 text-sm text-center px-8">{error}</p>
            <button onClick={() => navigate('/streams')} className="text-blue-400 underline text-sm">
              Back to Streams
            </button>
          </div>
        )}
      </div>

      <NavBar />
      <TrueFooter />
    </div>
  );
}
