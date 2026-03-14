import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import StreamToPopup from './StreamToPopup';
import DevicePicker from '../components/DevicePicker';
import {
  FriendsIcon, LibraryIcon, StreamToIcon,
  IdIcon, ActionIcon, CameraIcon, CutIcon, MicIcon,
  MovieCameraIcon, StreamIcon, StopCircleIcon, VideoOffIcon
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
  const {
    isStreaming, mediaStream, currentSource, setCurrentSource,
    currentAudioIn, setCurrentAudioIn,
    currentOutlet, startStream, stopStream,
    isStreamingOut, startWhipStream, stopWhipStream,
  } = useApp();
  const videoRef = useRef(null);
  const actionRecorderRef = useRef(null);
  const autoConnectAttempted = useRef(false);
  const [showOutlet, setShowOutlet] = useState(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [isRecordingAction, setIsRecordingAction] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  // ── Auto-connect on mount ──────────────────────────────────────────────────
  // Always attempt camera + mic on load (like Zoom/Teams). Uses the last-used
  // camera as an ideal hint; falls back to system default if unavailable.
  useEffect(() => {
    if (isStreaming || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    (async () => {
      try {
        let videoConstraint = true;
        try {
          const profile = await api.get('/api/users/profile');
          if (profile.data.Last_Source_Device_Id) {
            videoConstraint = { deviceId: { ideal: profile.data.Last_Source_Device_Id } };
          }
        } catch { /* profile fetch failure is non-fatal */ }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: true,
        });

        startStream(stream);

        // Enumerate to resolve device names for picker labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        const [vTrack] = stream.getVideoTracks();
        const [aTrack] = stream.getAudioTracks();
        if (vTrack) {
          const dev = devices.find(d => d.kind === 'videoinput' && d.label === vTrack.label);
          if (dev) setCurrentSource(dev);
        }
        if (aTrack) {
          const dev = devices.find(d => d.kind === 'audioinput' && d.label === aTrack.label);
          if (dev) setCurrentAudioIn(dev);
        }
      } catch (err) {
        setPermissionError(err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Retry after user clicks "Try Again" in the permission error state
  async function handleRetryAccess() {
    setPermissionError(null);
    autoConnectAttempted.current = false;
    // Re-trigger the effect by forcing a re-evaluation isn't possible, so inline the logic:
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      startStream(stream);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const [vTrack] = stream.getVideoTracks();
      const [aTrack] = stream.getAudioTracks();
      if (vTrack) {
        const dev = devices.find(d => d.kind === 'videoinput' && d.label === vTrack.label);
        if (dev) setCurrentSource(dev);
      }
      if (aTrack) {
        const dev = devices.find(d => d.kind === 'audioinput' && d.label === aTrack.label);
        if (dev) setCurrentAudioIn(dev);
      }
    } catch (err) {
      setPermissionError(err);
    }
  }

  // ── Device switching ───────────────────────────────────────────────────────

  async function switchCamera(device) {
    try {
      // Carry existing audio tracks into the new stream
      const oldAudioTracks = mediaStream ? mediaStream.getAudioTracks() : [];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
      });
      oldAudioTracks.forEach(t => newStream.addTrack(t));
      if (mediaStream) mediaStream.getVideoTracks().forEach(t => t.stop());
      startStream(newStream);
      setCurrentSource(device);
      api.put('/api/users/profile', { lastSourceDeviceId: device.deviceId }).catch(() => {});
    } catch (err) {
      console.error('Camera switch failed:', err);
    }
  }

  async function switchMic(device) {
    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: device.deviceId ? { deviceId: { ideal: device.deviceId } } : true,
      });
      const [newTrack] = newAudioStream.getAudioTracks();
      if (!newTrack) return;
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach(t => { t.stop(); mediaStream.removeTrack(t); });
        mediaStream.addTrack(newTrack);
      }
      setCurrentAudioIn(device);
    } catch (err) {
      console.error('Mic switch failed:', err);
    }
  }

  // ── Fetch live friend streams ──────────────────────────────────────────────
  useEffect(() => {
    const fetchLive = () => {
      api.get('/api/stream/live').then(r => setLiveStreams(r.data)).catch(() => {});
    };
    fetchLive();
    const id = setInterval(fetchLive, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Attach stream to video element ────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream ?? null;
    }
  }, [mediaStream]);

  // ── Stop recordings/stream when source disconnects ────────────────────────
  useEffect(() => {
    if (!isStreaming) {
      if (isStreamingOut) stopWhipStream();
      const rec = actionRecorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Capture / record handlers ─────────────────────────────────────────────

  const handleCamera = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const fd = new FormData();
      fd.append('media', blob, 'photo.jpg');
      api.post('/api/media', fd).catch(console.error);
    }, 'image/jpeg');
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 400);
  }, [mediaStream]);

  function handleAction() {
    if (!isStreaming || !mediaStream) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = e => {
        if (e.data.size === 0) return;
        if (e.data.size > 50 * 1024 * 1024) {
          setSaveStatus('toobig');
          setTimeout(() => setSaveStatus(null), 4000);
          return;
        }
        setSaveStatus('saving');
        const fd = new FormData();
        fd.append('media', new Blob([e.data], { type: 'video/webm' }), 'action.webm');
        api.post('/api/media', fd, { timeout: 120000 })
          .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus(null), 2000); })
          .catch(() => { setSaveStatus('error'); setTimeout(() => setSaveStatus(null), 4000); });
      };
      recorder.onstop = () => { actionRecorderRef.current = null; setIsRecordingAction(false); };
      recorder.start();
      actionRecorderRef.current = recorder;
      setIsRecordingAction(true);
    } catch { /* MediaRecorder not supported */ }
  }

  function handleCut() {
    const rec = actionRecorderRef.current;
    if (!rec || rec.state === 'inactive') { setIsRecordingAction(false); return; }
    rec.stop();
  }

  const handleId = useCallback(() => {
    if (!videoRef.current || !mediaStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    canvas.toBlob(blob => {
      const fd = new FormData();
      fd.append('media', blob, 'photo.jpg');
      api.post('/api/media', fd).catch(console.error);
    }, 'image/jpeg');
    navigate('/id', { state: { photoDataUrl: dataUrl, saveToLibrary: true } });
  }, [mediaStream, navigate]);

  function handleStream() { if (canStream) startWhipStream(mediaStream); }
  function handleStopStream() { stopWhipStream(); }

  const canId = isStreaming;
  const canStream = isStreaming && !!currentOutlet;
  const outletName = currentOutlet?.name || null;

  // Permission error message
  function permissionMessage() {
    if (!permissionError) return null;
    if (permissionError.name === 'NotAllowedError') {
      return 'Camera or microphone access was denied. Click the camera icon in your browser\'s address bar to allow access, then try again.';
    }
    if (permissionError.name === 'NotFoundError') {
      return 'No camera found. Make sure your camera is connected and that your browser has permission in System Settings → Privacy & Security.';
    }
    return `Could not connect: ${permissionError.message}`;
  }

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

      {/* Device pickers + outlet row */}
      <div className="bg-slate-700 px-4 pb-3 flex items-center justify-center gap-2 flex-wrap">
        <DevicePicker
          icon={MovieCameraIcon}
          kind="videoinput"
          current={currentSource}
          placeholder="Camera"
          onSwitch={switchCamera}
        />

        <DevicePicker
          icon={MicIcon}
          kind="audioinput"
          current={currentAudioIn}
          placeholder="Microphone"
          onSwitch={switchMic}
          disabled={!isStreaming}
        />

        <div className="w-px h-5 bg-slate-500 mx-1" />

        <button
          onClick={() => setShowOutlet(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-slate-500"
        >
          <StreamToIcon className="w-4 h-4" />
          <span>Outlet</span>
        </button>

        {outletName && (
          <span className="text-white text-sm font-medium bg-blue-600 px-3 py-1 rounded-lg border border-blue-500 truncate max-w-[200px]">
            {outletName}
          </span>
        )}
      </div>

      {/* Main 3-column layout */}
      <main className="flex-1 flex items-stretch px-2 pb-2 gap-0">

        {/* Left 15%: Id + action buttons */}
        <div className="w-[15%] bg-slate-700 rounded-l-xl flex flex-col">
          <SideButton icon={IdIcon} label="Id" onClick={handleId} disabled={!canId} className="text-white hover:bg-slate-600" />
          <div className="mx-3 border-t border-slate-600" />
          {!isRecordingAction ? (
            <SideButton icon={ActionIcon} label="Action" onClick={handleAction} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          ) : (
            <SideButton icon={CutIcon} label="Cut" onClick={handleCut} className="text-white bg-red-700 hover:bg-red-600 rounded-xl animate-pulse" />
          )}
          <SideButton icon={CameraIcon} label="Camera" onClick={handleCamera} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
        </div>

        {/* Center 70%: video */}
        <div className="w-[70%] bg-white flex flex-col items-center justify-center p-3 border-t border-b border-gray-200">
          <div className="w-full video-container bg-black border-2 border-white rounded-sm overflow-hidden relative">
            {mediaStream ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : permissionError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
                  <VideoOffIcon className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-white font-semibold mb-2">Camera access needed</p>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{permissionMessage()}</p>
                </div>
                <button
                  onClick={handleRetryAccess}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                <p className="text-sm text-gray-400">Connecting camera...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 15%: Stream + live friends */}
        <div className="w-[15%] bg-slate-700 rounded-r-xl flex flex-col items-center">
          {!isStreamingOut ? (
            <SideButton icon={StreamIcon} label="Stream" onClick={handleStream} disabled={!canStream} className="text-white hover:bg-slate-600" />
          ) : (
            <>
              <SideButton icon={StopCircleIcon} label="Stop Stream" onClick={handleStopStream} className="text-white bg-pink-800 hover:bg-pink-700 rounded-xl" />
              {outletName && (
                <span className="text-red-400 text-xs font-semibold text-center px-2 mt-1 leading-snug">{outletName}</span>
              )}
            </>
          )}

          {liveStreams.filter(s => s.Friend_Id).length > 0 && (
            <div className="mt-3 w-full px-2 flex flex-col items-center gap-2">
              <span className="text-gray-400 text-xs font-medium">Live</span>
              {liveStreams.filter(s => s.Friend_Id).map(s => (
                <button
                  key={s.Stream_Id}
                  onClick={() => navigate('/streams/watch', { state: { stream: s, isLive: true } })}
                  className="flex flex-col items-center gap-1 group"
                  title={s.Streamer_Name}
                >
                  {s.Friend_Photo_Id ? (
                    <img src={`/api/friends/${s.Friend_Id}/photos/${s.Friend_Photo_Id}/data`} alt={s.Streamer_Name} className="w-10 h-10 rounded-full object-cover border-2 border-red-500 group-hover:border-red-400" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 border-2 border-red-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{s.Streamer_Name?.[0] || '?'}</span>
                    </div>
                  )}
                  <span className="text-gray-400 text-xs truncate w-full text-center">{s.Streamer_Name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <NavBar />
      <TrueFooter />

      {showOutlet && <StreamToPopup onClose={() => setShowOutlet(false)} />}

      {saveStatus && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium z-50 ${
          saveStatus === 'saving' ? 'bg-blue-600' : saveStatus === 'saved' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {saveStatus === 'saving' ? 'Saving clip...' : saveStatus === 'saved' ? 'Clip saved to library' : saveStatus === 'toobig' ? 'Clip too large to save (50MB limit)' : 'Save failed'}
        </div>
      )}

      {cameraFlash && (
        <div className="fixed inset-0 pointer-events-none z-50" style={{ background: 'white', animation: 'cameraFlash 0.4s ease-out forwards' }} />
      )}
    </div>
  );
}
