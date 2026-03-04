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
  MonitorPlayIcon, StopStreamIcon, MovieCameraIcon
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
      <Icon className="w-7 h-7" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function StreamingHubScreen() {
  const navigate = useNavigate();
  const { isStreaming, mediaStream, startStream, stopStream, currentSource, currentOutlet } = useApp();
  const videoRef = useRef(null);
  const [showSource, setShowSource] = useState(false);
  const [showStreamTo, setShowStreamTo] = useState(false);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleStream = useCallback(async () => {
    if (isStreaming) { stopStream(); return; }
    try {
      const constraints = currentSource
        ? { video: { deviceId: { exact: currentSource.deviceId } }, audio: true }
        : { video: true, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      startStream(stream);
    } catch (err) {
      alert('Could not access camera: ' + err.message);
    }
  }, [isStreaming, currentSource, startStream, stopStream]);

  const handleId = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    navigate('/id', { state: { photoDataUrl: canvas.toDataURL('image/jpeg') } });
  }, [mediaStream, navigate]);

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      <MenuSlideout />

      {/* Header */}
      <header className="bg-slate-700 px-6 py-3 flex items-center justify-between">
        {/* Left: Friends */}
        <button
          onClick={() => navigate('/friends')}
          className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
        >
          <FriendsIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Friends</span>
        </button>

        {/* Center: Title */}
        <span className="text-white font-bold text-2xl tracking-wide">CrowdView</span>

        {/* Right: Library */}
        <button
          onClick={() => navigate('/library')}
          className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
        >
          <LibraryIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Library</span>
        </button>
      </header>

      {/* Select Source / Stream To row */}
      <div className="bg-slate-700 px-4 pb-3 flex items-center justify-center gap-3">
        <button
          onClick={() => setShowSource(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-slate-500"
        >
          <SelectSourceIcon className="w-4 h-4" />
          <span>Select Source</span>
        </button>
        <button
          onClick={() => setShowStreamTo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-slate-500"
        >
          <StreamToIcon className="w-4 h-4" />
          <span>Stream To</span>
        </button>
      </div>

      {/* Main 3-column layout */}
      <main className="flex-1 flex items-stretch px-2 pb-2 gap-0">

        {/* Left 15%: white panel with Id + action buttons */}
        <div className="w-[15%] bg-white rounded-l-xl flex flex-col border border-gray-200">
          {/* Id button */}
          <SideButton
            icon={IdIcon}
            label="Id"
            onClick={handleId}
            disabled={!isStreaming}
            className="text-gray-700 hover:bg-gray-100"
          />

          {/* Divider */}
          <div className="mx-3 border-t border-gray-200" />

          {/* Secondary action buttons */}
          <SideButton
            icon={ActionIcon}
            label="Action"
            onClick={() => {}}
            className="text-gray-700 hover:bg-gray-100"
          />
          <SideButton
            icon={CameraIcon}
            label="Camera"
            onClick={() => {}}
            className="text-gray-700 hover:bg-gray-100"
          />
          <SideButton
            icon={ShareIcon}
            label="Share"
            onClick={() => {}}
            className="text-gray-700 hover:bg-gray-100"
          />
          <SideButton
            icon={PostIcon}
            label="Post"
            onClick={() => {}}
            className="text-gray-700 hover:bg-gray-100"
          />
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
                <MovieCameraIcon className="w-16 h-16 opacity-80" />
                <p className="text-base font-medium">Video Stream Container</p>
                <p className="text-sm text-gray-400">16:9 Aspect Ratio</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 15%: dark panel with Stream button */}
        <div className="w-[15%] bg-white rounded-r-xl flex flex-col border border-gray-200">
          {isStreaming ? (
            <SideButton
              icon={StopStreamIcon}
              label="Stop"
              onClick={handleStream}
              className="text-pink-700 hover:bg-pink-50"
            />
          ) : (
            <SideButton
              icon={MonitorPlayIcon}
              label="Stream"
              onClick={handleStream}
              className="text-gray-700 hover:bg-gray-100"
            />
          )}
        </div>
      </main>

      <NavBar />
      <TrueFooter />

      {showSource && <SelectSourcePopup onClose={() => setShowSource(false)} />}
      {showStreamTo && <StreamToPopup onClose={() => setShowStreamTo(false)} />}
    </div>
  );
}
