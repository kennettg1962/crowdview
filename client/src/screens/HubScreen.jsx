import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import MenuSlideout from '../components/MenuSlideout';
import SelectSourcePopup from './SelectSourcePopup';
import StreamToPopup from './StreamToPopup';
import {
  FriendsIcon, LibraryIcon, SelectSourceIcon, StreamToIcon,
  IdIcon, ActionIcon, CameraIcon, ShareIcon, PostIcon,
  MovieCameraIcon, StreamIcon, StopCircleIcon
} from '../components/Icons';

function SideButton({ icon: Icon, label, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg transition-colors w-full
        disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      <Icon className="w-[42px] h-[42px]" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function HubScreen() {
  const navigate = useNavigate();
  const { isStreaming, mediaStream, currentSource, currentOutlet } = useApp();
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [showSource, setShowSource] = useState(false);
  const [showOutlet, setShowOutlet] = useState(false);
  const [isStreamingOut, setIsStreamingOut] = useState(false);

  // Attach live stream to video element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    } else if (videoRef.current && !mediaStream) {
      videoRef.current.srcObject = null;
    }
  }, [mediaStream]);

  // If source disconnects while streaming out: stop and save recording
  useEffect(() => {
    if (!isStreaming && isStreamingOut) {
      stopCapture(true);
      setIsStreamingOut(false);
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const canId = isStreaming;
  const canStream = isStreaming && !!currentOutlet;

  // Capture still frame → navigate to Id screen
  const handleId = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    navigate('/id', { state: { photoDataUrl: canvas.toDataURL('image/jpeg') } });
  }, [mediaStream, navigate]);

  function startCapture() {
    if (!mediaStream) return;
    recordedChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch {
      // MediaRecorder not supported — streaming to outlet only
    }
  }

  function stopCapture(save = false) {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (save) {
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crowdview-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        recordedChunksRef.current = [];
      };
    }
    recorder.stop();
    mediaRecorderRef.current = null;
  }

  function handleStream() {
    if (!canStream) return;
    startCapture();
    // TODO: connect to outlet RTMP API
    setIsStreamingOut(true);
  }

  function handleStopStream() {
    stopCapture(true);
    // TODO: disconnect from outlet RTMP API
    setIsStreamingOut(false);
  }

  const sourceName = currentSource?.label || currentSource?.name || null;
  const outletName = currentOutlet?.name || null;

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      <MenuSlideout />

      {/* Header */}
      <header className="bg-slate-700 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/friends')}
          className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
        >
          <FriendsIcon className="w-9 h-9" />
          <span className="text-xs font-medium">Friends</span>
        </button>

        <span className="text-white font-bold text-2xl tracking-wide">CrowdView</span>

        <button
          onClick={() => navigate('/library')}
          className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
        >
          <LibraryIcon className="w-9 h-9" />
          <span className="text-xs font-medium">Library</span>
        </button>
      </header>

      {/* Select Source / Select Outlet row */}
      <div className="bg-slate-700 px-4 pb-3 flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={() => setShowSource(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-slate-500"
        >
          <SelectSourceIcon className="w-4 h-4" />
          <span>Select Source</span>
        </button>

        {sourceName && (
          <span className="text-slate-200 text-sm font-medium bg-slate-600 px-3 py-1 rounded-lg border border-slate-500 truncate max-w-[160px]">
            {sourceName}
          </span>
        )}

        <button
          onClick={() => setShowOutlet(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-slate-500"
        >
          <StreamToIcon className="w-4 h-4" />
          <span>Select Outlet</span>
        </button>

        {outletName && (
          <span className="text-slate-200 text-sm font-medium bg-slate-600 px-3 py-1 rounded-lg border border-slate-500">
            {outletName}
          </span>
        )}
      </div>

      {/* Main 3-column layout */}
      <main className="flex-1 flex items-stretch px-2 pb-2 gap-0">

        {/* Left 15%: Id + action buttons */}
        <div className="w-[15%] bg-slate-700 rounded-l-xl flex flex-col border border-slate-600">
          <SideButton
            icon={IdIcon}
            label="Id"
            onClick={handleId}
            disabled={!canId}
            className="text-white hover:bg-slate-600"
          />
          <div className="mx-3 border-t border-slate-600" />
          <SideButton icon={ActionIcon} label="Action" onClick={() => {}} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          <SideButton icon={CameraIcon} label="Camera" onClick={() => {}} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          <SideButton icon={ShareIcon}  label="Share"  onClick={() => {}} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          <SideButton icon={PostIcon}   label="Post"   onClick={() => {}} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
        </div>

        {/* Center 70%: video container */}
        <div className="w-[70%] bg-white flex flex-col items-center justify-center p-3 border-t border-b border-gray-200">
          <div className="w-full video-container bg-black border-2 border-white rounded-sm overflow-hidden">
            {mediaStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                <MovieCameraIcon className="w-24 h-24 opacity-80" />
                <p className="text-base font-medium">Video Stream Container</p>
                <p className="text-sm text-gray-400">16:9 Aspect Ratio</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 15%: Stream / Stop Stream */}
        <div className="w-[15%] bg-slate-700 rounded-r-xl flex flex-col items-center border border-slate-600">
          {!isStreamingOut ? (
            <SideButton
              icon={StreamIcon}
              label="Stream"
              onClick={handleStream}
              disabled={!canStream}
              className="text-white hover:bg-slate-600"
            />
          ) : (
            <>
              <SideButton
                icon={StopCircleIcon}
                label="Stop Stream"
                onClick={handleStopStream}
                className="text-white bg-pink-800 hover:bg-pink-700 rounded-xl"
              />
              {outletName && (
                <span className="text-red-400 text-xs font-semibold text-center px-2 mt-1 leading-snug">
                  {outletName}
                </span>
              )}
            </>
          )}
        </div>
      </main>

      <NavBar />
      <TrueFooter />

      {showSource && <SelectSourcePopup onClose={() => setShowSource(false)} />}
      {showOutlet && <StreamToPopup onClose={() => setShowOutlet(false)} />}
    </div>
  );
}
