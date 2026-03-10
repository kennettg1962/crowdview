import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import SelectSourcePopup from './SelectSourcePopup';
import StreamToPopup from './StreamToPopup';
import {
  FriendsIcon, LibraryIcon, SelectSourceIcon, StreamToIcon,
  IdIcon, ActionIcon, CameraIcon, CutIcon,
  MovieCameraIcon, StreamIcon, StopCircleIcon
} from '../components/Icons';
import api from '../api/api';

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
  const actionRecorderRef = useRef(null);
  const autoConnectAttempted = useRef(false);
  const [showSource, setShowSource] = useState(false);
  const [showOutlet, setShowOutlet] = useState(false);
  const [isStreamingOut, setIsStreamingOut] = useState(false);
  const [isRecordingAction, setIsRecordingAction] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | 'toobig'

  // Auto-connect to last used source if flag is set and not already streaming
  useEffect(() => {
    if (isStreaming || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    (async () => {
      try {
        const profile = await api.get('/api/users/profile');
        const { Connect_Last_Used_Device_After_Login_Fl, Last_Source_Device_Id } = profile.data;
        if (Connect_Last_Used_Device_After_Login_Fl !== 'Y' || !Last_Source_Device_Id) return;
        // Request permission then enumerate
        try { await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop())); } catch {}
        const devices = await navigator.mediaDevices.enumerateDevices();
        const device = devices.find(d => d.kind === 'videoinput' && d.deviceId === Last_Source_Device_Id);
        if (!device) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
          audio: true,
        });
        startStream(stream);
        setCurrentSource(device);
      } catch {
        // Auto-connect failed silently — user can connect manually
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach live stream to video element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    } else if (videoRef.current && !mediaStream) {
      videoRef.current.srcObject = null;
    }
  }, [mediaStream]);

  // If source disconnects: stop any active recordings
  useEffect(() => {
    if (!isStreaming) {
      if (isStreamingOut) {
        stopCapture(true);
        setIsStreamingOut(false);
      }
      // Action recorder: stop if still active — onstop handler saves and resets state
      const actionRecorder = actionRecorderRef.current;
      if (actionRecorder && actionRecorder.state !== 'inactive') {
        actionRecorder.stop();
      }
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const canId = isStreaming;
  const canStream = isStreaming && !!currentOutlet;

  // Capture still frame → navigate to Id screen
  const handleCamera = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const formData = new FormData();
      formData.append('media', blob, 'photo.jpg');
      api.post('/api/media', formData).catch(console.error);
    }, 'image/jpeg');
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 400);
  }, [mediaStream]);

  function handleAction() {
    if (!isStreaming || !mediaStream) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = e => {
        if (e.data.size === 0) return;
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (e.data.size > MAX_SIZE) {
          setSaveStatus('toobig');
          setTimeout(() => setSaveStatus(null), 4000);
          return;
        }
        setSaveStatus('saving');
        const videoBlob = new Blob([e.data], { type: 'video/webm' });
        const formData = new FormData();
        formData.append('media', videoBlob, 'action.webm');
        api.post('/api/media', formData, { timeout: 120000 })
          .then(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 2000);
          })
          .catch(err => {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 4000);
          });
      };
      recorder.onstop = () => {
        actionRecorderRef.current = null;
        setIsRecordingAction(false);
      };
      recorder.start(); // No timeslice — all data delivered in single ondataavailable on stop()
      actionRecorderRef.current = recorder;
      setIsRecordingAction(true);
    } catch {
      // MediaRecorder not supported
    }
  }

  function handleCut() {
    const recorder = actionRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecordingAction(false);
      return;
    }
    recorder.stop(); // onstop handler saves the clip
  }

  const handleId = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    // Save to library (non-blocking)
    canvas.toBlob(blob => {
      const formData = new FormData();
      formData.append('media', blob, 'photo.jpg');
      api.post('/api/media', formData).catch(console.error);
    }, 'image/jpeg');
    navigate('/id', { state: { photoDataUrl: dataUrl } });
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
        // Save to library
        const formData = new FormData();
        formData.append('media', blob, 'video.webm');
        api.post('/api/media', formData).catch(console.error);
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
          <span className="text-white text-sm font-medium bg-blue-600 px-3 py-1 rounded-lg border border-blue-500 truncate max-w-[260px]">
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
          <span className="text-white text-sm font-medium bg-blue-600 px-3 py-1 rounded-lg border border-blue-500 truncate max-w-[260px]">
            {outletName}
          </span>
        )}
      </div>

      {/* Main 3-column layout */}
      <main className="flex-1 flex items-stretch px-2 pb-2 gap-0">

        {/* Left 15%: Id + action buttons */}
        <div className="w-[15%] bg-slate-700 rounded-l-xl flex flex-col">
          <SideButton
            icon={IdIcon}
            label="Id"
            onClick={handleId}
            disabled={!canId}
            className="text-white hover:bg-slate-600"
          />
          <div className="mx-3 border-t border-slate-600" />
          {!isRecordingAction ? (
            <SideButton icon={ActionIcon} label="Action" onClick={handleAction} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          ) : (
            <SideButton icon={CutIcon} label="Cut" onClick={handleCut} className="text-white bg-red-700 hover:bg-red-600 rounded-xl animate-pulse" />
          )}
          <SideButton icon={CameraIcon} label="Camera" onClick={handleCamera} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
        </div>

        {/* Center 70%: video container */}
        <div className="w-[70%] bg-white flex flex-col items-center justify-center p-3 border-t border-b border-gray-200">
          <div className="w-full video-container bg-black border-2 border-white rounded-sm overflow-hidden relative">
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
        <div className="w-[15%] bg-slate-700 rounded-r-xl flex flex-col items-center">
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

      {saveStatus && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium z-50 ${
          saveStatus === 'saving' ? 'bg-blue-600' :
          saveStatus === 'saved'  ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {saveStatus === 'saving' ? 'Saving clip...' :
           saveStatus === 'saved'  ? 'Clip saved to library' :
           saveStatus === 'toobig' ? 'Clip too large to save (50MB limit)' : 'Save failed'}
        </div>
      )}

      {cameraFlash && (
        <div
          className="fixed inset-0 pointer-events-none z-50"
          style={{ background: 'white', animation: 'cameraFlash 0.4s ease-out forwards' }}
        />
      )}
    </div>
  );
}
