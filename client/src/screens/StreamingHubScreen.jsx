import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import MenuSlideout from '../components/MenuSlideout';
import SelectSourcePopup from './SelectSourcePopup';
import StreamToPopup from './StreamToPopup';
import {
  MovieCameraIcon, FriendsIcon, LibraryIcon,
  SelectSourceIcon, StreamToIcon, IdIcon,
  StreamIcon, StopStreamIcon
} from '../components/Icons';

export default function StreamingHubScreen() {
  const navigate = useNavigate();
  const { isStreaming, mediaStream, startStream, stopStream, currentSource, currentOutlet, setSlideoutOpen } = useApp();
  const videoRef = useRef(null);
  const [showSource, setShowSource] = useState(false);
  const [showStreamTo, setShowStreamTo] = useState(false);

  // Attach MediaStream to video element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleStream = useCallback(async () => {
    if (isStreaming) {
      stopStream();
      return;
    }
    // Auto-start with default camera if no source selected
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
    // Capture a still frame from the video
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const photoDataUrl = canvas.toDataURL('image/jpeg');
    navigate('/id', { state: { photoDataUrl } });
  }, [mediaStream, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <MenuSlideout />

      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/library')} title="Library" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <LibraryIcon className="w-5 h-5" />
          </button>
        }
        center={
          <span className="text-white font-bold text-xl tracking-wide">CrowdView</span>
        }
        right={
          <button onClick={() => navigate('/friends')} title="Friends" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-5 h-5" />
          </button>
        }
      />

      {/* Source / Outlet row */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-center gap-4">
        <button
          onClick={() => setShowSource(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
        >
          <SelectSourceIcon className="w-4 h-4" />
          <span>Source</span>
        </button>
        <span className="text-gray-400 text-sm truncate max-w-[120px]">
          {currentSource?.label || 'None'}
        </span>
        <span className="text-gray-600">|</span>
        <button
          onClick={() => setShowStreamTo(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
        >
          <StreamToIcon className="w-4 h-4" />
          <span>Stream To</span>
        </button>
        <span className="text-gray-400 text-sm truncate max-w-[120px]">
          {currentOutlet?.name || 'None'}
        </span>
      </div>

      {/* Main content: Id | Video | Stream */}
      <main className="flex-1 flex items-stretch p-2 gap-2">
        {/* Left 10%: Id button */}
        <div className="w-[10%] flex flex-col items-center justify-center">
          <button
            onClick={handleId}
            disabled={!isStreaming}
            title="Identify Faces"
            className="flex flex-col items-center gap-1 text-xs text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <IdIcon className="w-7 h-7" />
            <span>Id</span>
          </button>
        </div>

        {/* Center 80%: Video */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full video-container bg-black rounded-xl overflow-hidden border border-gray-700">
            {mediaStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 gap-3">
                <MovieCameraIcon className="w-16 h-16" />
                <p className="text-sm">No video source connected</p>
                <button
                  onClick={() => setShowSource(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Select Source
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 10%: Stream button */}
        <div className="w-[10%] flex flex-col items-center justify-center">
          {isStreaming ? (
            <button
              onClick={handleStream}
              title="Stop Streaming"
              className="flex flex-col items-center gap-1 text-xs text-white p-2 rounded-lg bg-pink-800 hover:bg-pink-700 transition-colors"
            >
              <StopStreamIcon className="w-7 h-7" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleStream}
              title="Start Streaming"
              className="flex flex-col items-center gap-1 text-xs text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <StreamIcon className="w-7 h-7" />
              <span>Stream</span>
            </button>
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
