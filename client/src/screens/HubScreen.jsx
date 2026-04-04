import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import useVoiceCommands from '../hooks/useVoiceCommands';
import useCaptureSource from '../hooks/useCaptureSource';
import useResultDisplay from '../hooks/useResultDisplay';
import GlassesSDK from '../services/GlassesSDK';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import DevicePicker from '../components/DevicePicker';
import FriendForm from '../components/FriendForm';
import FriendFormPopup from '../components/FriendFormPopup';
import {
  FriendsIcon, LibraryIcon,
  IdIcon, ActionIcon, CutIcon, MicIcon,
  MovieCameraIcon, StreamIcon, StopCircleIcon, VideoOffIcon, LiveScanIcon, FlipCameraIcon,
  HomeIcon, BroadcastIcon, UserProfileIcon, LogoutIcon, UsersIcon,
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

function FloatButton({ icon: Icon, label, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg transition-colors
        disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default function HubScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isStreaming, mediaStream, currentSource, setCurrentSource,
    currentAudioIn, setCurrentAudioIn,
    startStream, stopStream,
    isStreamingOut, isStreamingConnecting, startWhipStream, stopWhipStream, streamError, setStreamError,
    setSlideoutOpen, captureMode, isCorporate, isOAU, logout,
    injectGlassesFrame, cameraReconnectKey,
  } = useApp();
  const videoRef = useRef(null);
  const glassesCanvasRef = useRef(null);
  const { getCaptureFrame } = useCaptureSource(videoRef);
  const { showResult } = useResultDisplay();
  const overlayCanvasRef = useRef(null);
  const actionRecorderRef = useRef(null);
  const autoConnectAttempted = useRef(false);
  const scanInFlightRef = useRef(false);
  const liveScanActiveRef = useRef(false);
  const [liveStreams, setLiveStreams] = useState([]);
  const [isRecordingAction, setIsRecordingAction] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [liveScan, setLiveScan] = useState(false);
  const [liveScanInitializing, setLiveScanInitializing] = useState(false);
  const [liveFaces, setLiveFaces] = useState([]);
  const [selectedFace, setSelectedFace] = useState(null);
  const [liveFacePopup, setLiveFacePopup] = useState(null);

  // Stable friend object for FriendForm — only changes when selectedFace changes,
  // not on every scan cycle re-render (which would re-trigger photo loading)
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

  // ── Phone camera connect (shared by auto-connect + glasses disconnect) ─────
  async function connectPhoneCamera() {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    try {
      let videoConstraint = true;
      try {
        const profile = await api.get('/api/users/profile');
        if (profile.data.Last_Source_Device_Id) {
          videoConstraint = { deviceId: { ideal: profile.data.Last_Source_Device_Id } };
        }
      } catch { /* non-fatal */ }
      // Probe audio devices before requesting the full stream so we can ask for
      // the built-in mic by exact deviceId. Without this, Continuity Camera
      // makes the iPhone mic the system default and Chrome honours that.
      let audioConstraint = true;
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        probe.getAudioTracks().forEach(t => t.stop());
        const probeDevices = await navigator.mediaDevices.enumerateDevices();
        const builtIn = probeDevices.find(d => d.kind === 'audioinput' && /built.?in/i.test(d.label));
        if (builtIn) audioConstraint = { deviceId: { exact: builtIn.deviceId } };
      } catch { /* non-fatal — fall back to audio: true */ }

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: audioConstraint });
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

  // ── Glasses camera feed ───────────────────────────────────────────────────
  useEffect(() => {
    if (captureMode !== 'glasses') return;
    const handleFrame = (dataUrl) => {
      injectGlassesFrame(dataUrl);
      const canvas = glassesCanvasRef.current;
      if (!canvas) return;
      const img = new Image();
      img.onload = () => {
        if (canvas.width !== img.naturalWidth)   canvas.width  = img.naturalWidth;
        if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    };
    GlassesSDK.onFrame(handleFrame);
    return () => GlassesSDK.offFrame(handleFrame);
  }, [captureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-connect phone camera on mount ────────────────────────────────────
  useEffect(() => {
    if (captureMode === 'glasses') return;
    connectPhoneCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-connect phone camera after glasses disconnect ──────────────────────
  useEffect(() => {
    if (cameraReconnectKey === 0) return; // skip initial mount
    autoConnectAttempted.current = false;
    connectPhoneCamera();
  }, [cameraReconnectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retry after user clicks "Try Again" in the permission error state
  function handleRetryAccess() {
    setPermissionError(null);
    autoConnectAttempted.current = false;
    connectPhoneCamera();
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
    async function applyAudioTrack(constraint) {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({ audio: constraint });
      const [newTrack] = newAudioStream.getAudioTracks();
      if (!newTrack) return;
      if (mediaStream) {
        mediaStream.getAudioTracks().forEach(t => { t.stop(); mediaStream.removeTrack(t); });
        mediaStream.addTrack(newTrack);
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const connected = allDevices.find(d => d.kind === 'audioinput' && d.label === newTrack.label)
        ?? device;
      setCurrentAudioIn(connected);
    }
    try {
      const constraint = device?.deviceId ? { deviceId: { exact: device.deviceId } } : true;
      await applyAudioTrack(constraint);
    } catch (err) {
      console.error('Mic switch failed, falling back to default:', err);
      try {
        await applyAudioTrack({ deviceId: { ideal: 'default' } });
      } catch (fallbackErr) {
        console.error('Default mic fallback also failed:', fallbackErr);
      }
    }
  }

  async function flipCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      if (videoDevices.length < 2) return;
      const currentIdx = videoDevices.findIndex(d => d.deviceId === currentSource?.deviceId);
      const next = videoDevices[(currentIdx + 1) % videoDevices.length];
      await switchCamera(next);
    } catch (err) {
      console.error('Flip camera failed:', err);
    }
  }

  // ── Heartbeat while camera active — feeds the corporate dashboard ─────────
  useEffect(() => {
    if (!isStreaming) return;
    const beat = () => api.post('/api/users/heartbeat').catch(() => {});
    beat();
    const id = setInterval(beat, 15000);
    return () => clearInterval(id);
  }, [isStreaming]);

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

  // ── Live scan interval ─────────────────────────────────────────────────────
  useEffect(() => {
    liveScanActiveRef.current = liveScan;
    if (!liveScan) {
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveFaces([]);
      setSelectedFace(null);
      setLiveFacePopup(null);
      setLiveScanInitializing(false);
      return;
    }
    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !overlayCanvasRef.current || !liveScanActiveRef.current) return;

      const canvas = overlayCanvasRef.current;

      // Phone: sync overlay canvas to native video resolution before capturing
      if (captureMode === 'phone') {
        const video = videoRef.current;
        if (!video || !video.videoWidth || video.readyState < 3) return;
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      }

      // Capture frame from active source (phone camera or glasses)
      const capture = await getCaptureFrame(640, 0.8).catch(() => null);
      if (!capture || !liveScanActiveRef.current) return;
      const dataUrl = capture.toDataURL('image/jpeg', 0.8);

      scanInFlightRef.current = true;
      try {
        const res = await api.post('/api/rekognition/identify', { imageData: dataUrl });
        if (!liveScanActiveRef.current) return; // toggled off while in flight
        const { faces } = res.data;

        // Generate face crops from capture canvas and store in state
        const facesWithCrops = faces.map(face => {
          const bb = face.boundingBox;
          const cx = Math.round(bb.left * capture.width);
          const cy = Math.round(bb.top * capture.height);
          const cw = Math.round(bb.width * capture.width);
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

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        facesWithCrops.forEach(face => {
          const { boundingBox, status, friendName } = face;
          const x = boundingBox.left   * canvas.width;
          const y = boundingBox.top    * canvas.height;
          const w = boundingBox.width  * canvas.width;
          const h = boundingBox.height * canvas.height;

          const color = status === 'known' ? '#22c55e'
                      : status === 'identified' ? '#f97316'
                      : '#ef4444';

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

  // ── Stop recordings/stream when source disconnects ────────────────────────
  useEffect(() => {
    if (!isStreaming) {
      if (isStreamingOut) stopWhipStream();
      const rec = actionRecorderRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
      setLiveScan(false);
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

  const handleId = useCallback(async () => {
    if (captureMode === 'phone' && (!videoRef.current || !mediaStream)) return;
    const capture = await getCaptureFrame(1280, 0.82).catch(() => null);
    if (!capture) return;
    const dataUrl = capture.toDataURL('image/jpeg', 0.82);
    capture.toBlob(blob => {
      const fd = new FormData();
      fd.append('media', blob, 'photo.jpg');
      api.post('/api/media', fd).catch(console.error);
    }, 'image/jpeg', 0.82);
    showResult(dataUrl, { saveToLibrary: true });
  }, [captureMode, mediaStream, getCaptureFrame, showResult]);

  function handleStream() { if (isStreaming) startWhipStream(mediaStream); }
  function handleStopStream() { stopWhipStream(); }

  useVoiceCommands({
    screen: 'hub',
    commands: {
      scan: handleId,
    },
  });

  const canId = isStreaming;

  // On native Capacitor the viewport width can exceed 768px in landscape,
  // which would trigger Tailwind's md: breakpoint and show the desktop layout.
  // Lock to mobile layout on all native builds regardless of orientation.
  const isNative = window.location.protocol === 'capacitor:';
  const showMob   = isNative ? 'flex'   : 'flex md:hidden';
  const showDesk  = isNative ? 'hidden' : 'hidden md:flex';
  const showDeskB = isNative ? 'hidden' : 'hidden md:block';

  // ── Canvas click — hit-test bounding boxes ────────────────────────────────
  function handleCanvasClick(e) {
    if (!liveScan || !overlayCanvasRef.current || liveFaces.length === 0) return;
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top)  * scaleY;
    const hit = liveFaces.find(face => {
      const x = face.boundingBox.left  * canvas.width;
      const y = face.boundingBox.top   * canvas.height;
      const w = face.boundingBox.width * canvas.width;
      const h = face.boundingBox.height * canvas.height;
      return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
    });
    setSelectedFace(hit || null);
    // Popup only on mobile — desktop uses the right-panel FriendForm
    if (hit && window.innerWidth < 768) setLiveFacePopup(hit);
  }

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
    <div className={`relative h-screen overflow-hidden bg-black ${isNative ? '' : 'md:bg-slate-700 md:flex md:flex-col'}`}>

      {/* ── Mobile header — fixed overlay at top ── */}
      <header className={`${showMob} fixed top-0 left-0 right-0 z-50 items-center px-4 pb-3 bg-black/70`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => navigate('/friends')}
            className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
          >
            <FriendsIcon className="w-9 h-9" />
            <span className="text-xs font-medium">{isCorporate ? 'Customers' : 'Friends'}</span>
          </button>
        </div>

        <span className="text-white font-bold text-xl tracking-wide text-center leading-tight">
          {isCorporate ? <><div>CrowdView</div><div>Corporate</div></> : 'CrowdView'}
        </span>

        <div className="flex-1 flex justify-end">
          <button
            onClick={() => navigate('/library')}
            className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors"
          >
            <LibraryIcon className="w-9 h-9" />
            <span className="text-xs font-medium">Library</span>
          </button>
        </div>
      </header>

      {/* ── Desktop header — normal flow ── */}
      <header className={`${showDesk} bg-slate-700 px-6 py-3 items-center justify-between`}>
        <button onClick={() => navigate('/friends')} className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors">
          <FriendsIcon className="w-9 h-9" />
          <span className="text-xs font-medium">{isCorporate ? 'Customers' : 'Friends'}</span>
        </button>
        <span className="text-white font-bold text-2xl tracking-wide">{isCorporate ? 'CrowdView Corporate' : 'CrowdView'}</span>
        <button onClick={() => navigate('/library')} className="flex flex-col items-center gap-1 text-white hover:text-slate-300 transition-colors">
          <LibraryIcon className="w-9 h-9" />
          <span className="text-xs font-medium">Library</span>
        </button>
      </header>

      {/* Device pickers — desktop only */}
      <div className={`${showDesk} bg-slate-700 px-4 pb-3 items-center justify-center gap-2 flex-wrap`}>
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
        />

      </div>

      {/* Main layout — mobile: full-screen absolute; desktop: 3-column flex */}
      <main className={`absolute inset-0 z-0 flex ${isNative ? '' : 'md:relative md:inset-auto md:z-auto md:flex-1 md:items-stretch md:p-0 md:px-2 md:pb-2 md:gap-0'}`}>

        {/* Desktop left sidebar (hidden on mobile) */}
        <div className={`${showDesk} w-[15%] bg-slate-700 rounded-l-xl flex-col`}>
          {liveScan ? (
            <SideButton icon={LiveScanIcon} label="Live" onClick={() => setLiveScan(false)} className="text-white bg-green-700 hover:bg-green-600 rounded-xl animate-pulse" />
          ) : (
            <SideButton icon={LiveScanIcon} label="Live" onClick={() => { setLiveScan(true); setLiveScanInitializing(true); }} disabled={!canId} className="text-white hover:bg-slate-600" />
          )}
          <div className="mx-3 border-t border-slate-600" />
          <SideButton icon={IdIcon} label="Id" onClick={handleId} disabled={!canId} className="text-white hover:bg-slate-600" />
          {!isCorporate && (
            <>
              <div className="mx-3 border-t border-slate-600" />
              {!isRecordingAction ? (
                <SideButton icon={ActionIcon} label="Action" onClick={handleAction} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
              ) : (
                <SideButton icon={CutIcon} label="Cut" onClick={handleCut} className="text-white bg-red-700 hover:bg-red-600 rounded-xl animate-pulse" />
              )}
            </>
          )}
        </div>

        {/* Video column — full width on mobile, percentage on desktop */}
        <div
          className={`flex-1 min-w-0 overflow-hidden relative bg-black
            ${isNative ? '' : `md:flex-none md:bg-white md:flex md:flex-col md:items-center md:justify-center md:p-3
            md:border-t md:border-b md:border-gray-200
            md:[transition:width_0.3s_ease]
            ${selectedFace ? 'md:w-[42%]' : 'md:w-[70%]'}`}`}
        >
          <div className={`w-full video-container bg-black overflow-hidden relative ${isNative ? '' : 'border-0 md:border-2 md:border-white md:rounded-sm'}`}>
            {(captureMode === 'glasses' || mediaStream) ? (
              <>
                {captureMode === 'glasses'
                  ? <canvas ref={glassesCanvasRef} className="w-full h-full object-cover" />
                  : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                }
                <canvas
                  ref={overlayCanvasRef}
                  onClick={handleCanvasClick}
                  onTouchEnd={e => { e.preventDefault(); handleCanvasClick(e.changedTouches[0]); }}
                  className={`absolute inset-0 w-full h-full ${liveScan && liveFaces.length > 0 ? 'cursor-pointer' : 'pointer-events-none'}`}
                />
                {liveScanInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-3 pointer-events-none">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400" />
                    <p className="text-white text-sm font-medium">Initializing face detection...</p>
                  </div>
                )}
              </>
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

          {/* Mobile — top-left: Id + Live (horizontal) */}
          <div className={`${showMob} absolute left-3 z-20 bg-black/35 rounded-xl p-1.5 gap-0.5`}
               style={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}>
            <FloatButton icon={IdIcon} label="Id" onClick={handleId} disabled={!canId} className="text-white hover:bg-white/20" />
            <div className="border-l border-white/20 my-1" />
            {liveScan ? (
              <FloatButton icon={LiveScanIcon} label="Live" onClick={() => setLiveScan(false)} className="text-white bg-green-700 hover:bg-green-600 rounded-lg animate-pulse" />
            ) : (
              <FloatButton icon={LiveScanIcon} label="Live" onClick={() => { setLiveScan(true); setLiveScanInitializing(true); }} disabled={!canId} className="text-white hover:bg-white/20" />
            )}
          </div>

          {/* Mobile — top-right: Action/Cut + Stream (horizontal), friend bubbles below */}
          <div className={`${showMob} absolute right-3 z-20 flex-col items-end`}
               style={{ top: 'calc(env(safe-area-inset-top) + 76px)' }}>
            <div className="flex bg-black/35 rounded-xl p-1.5 gap-0.5">
              {!isCorporate && (
                <>
                  {!isRecordingAction ? (
                    <FloatButton icon={ActionIcon} label="Action" onClick={handleAction} disabled={!isStreaming} className="text-white hover:bg-white/20" />
                  ) : (
                    <FloatButton icon={CutIcon} label="Cut" onClick={handleCut} className="text-white bg-red-700 hover:bg-red-600 rounded-lg animate-pulse" />
                  )}
                  <div className="border-l border-white/20 my-1" />
                </>
              )}
              {!(isStreamingOut || isStreamingConnecting) ? (
                <FloatButton icon={StreamIcon} label="Stream" onClick={handleStream} disabled={!isStreaming} className="text-white hover:bg-white/20" />
              ) : (
                <FloatButton icon={StopCircleIcon} label="Stop" onClick={handleStopStream} className="text-white bg-pink-800 hover:bg-pink-700 rounded-lg" />
              )}
            </div>
            {(isStreamingOut || isStreamingConnecting) && (
              <span className="mt-1 text-red-400 text-[9px] font-semibold text-center leading-snug">{isStreamingConnecting ? 'Connecting…' : 'CrowdView Live'}</span>
            )}
            {liveStreams.filter(s => s.Friend_Id).length > 0 && (
              <div className="mt-1 flex flex-col items-center gap-1.5 bg-black/35 rounded-xl p-1.5">
                {liveStreams.filter(s => s.Friend_Id).map(s => (
                  <button key={s.Stream_Id} onClick={() => navigate('/streams/watch', { state: { stream: s, isLive: true } })} title={s.Streamer_Name}>
                    {s.Friend_Photo_Id ? (
                      <img src={`/api/friends/${s.Friend_Id}/photos/${s.Friend_Photo_Id}/data`} alt={s.Streamer_Name} className="w-8 h-8 rounded-full object-cover border-2 border-red-500" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-600/80 border-2 border-red-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{s.Streamer_Name?.[0] || '?'}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile — bottom-left: Flip */}
          <div className={`${showMob} absolute left-3 z-20 bg-black/35 rounded-xl p-1.5`}
               style={{ bottom: 'calc(env(safe-area-inset-bottom) + 68px)' }}>
            <FloatButton icon={FlipCameraIcon} label="Flip" onClick={flipCamera} disabled={!isStreaming} className="text-white hover:bg-white/20" />
          </div>
        </div>

        {/* Face detail panel — desktop only, slides in when a bounding box is clicked */}
        {selectedFace && (
          <div className={`${showDesk} w-[28%] flex-col overflow-hidden`} style={{ transition: 'width 0.3s ease' }}>
            <FriendForm
              friend={selectedFriendProp}
              capturedPhotoUrl={!selectedFace.friendId ? selectedFace.cropDataUrl : null}
              onClose={() => setSelectedFace(null)}
              onSave={() => setSelectedFace(null)}
              onDelete={() => setSelectedFace(null)}
            />
          </div>
        )}

        {/* Desktop right sidebar (hidden on mobile) */}
        <div className={`${showDesk} w-[15%] bg-slate-700 rounded-r-xl flex-col items-center`}>
          {!(isStreamingOut || isStreamingConnecting) ? (
            <SideButton icon={StreamIcon} label="Stream" onClick={handleStream} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          ) : (
            <>
              <SideButton icon={StopCircleIcon} label="Stop Stream" onClick={handleStopStream} className="text-white bg-pink-800 hover:bg-pink-700 rounded-xl" />
              <span className="text-red-400 text-xs font-semibold text-center px-2 mt-1 leading-snug">{isStreamingConnecting ? 'Connecting…' : 'CrowdView Live'}</span>
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

      {/* ── Mobile nav — fixed overlay at bottom ── */}
      <nav className={`${showMob} fixed bottom-0 left-0 right-0 z-50 bg-black/70`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex w-full px-2 pt-4 pb-2">
          {[
            { icon: HomeIcon,      label: 'Home',                    path: '/hub' },
            { icon: FriendsIcon,   label: isCorporate ? 'Customers' : 'Friends', path: '/friends' },
            { icon: LibraryIcon,   label: 'Library',                 path: '/library' },
            { icon: BroadcastIcon, label: 'Streams',                 path: '/streams' },
          ].map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center gap-1 text-xs transition-colors
                ${location.pathname === path ? 'text-white' : 'text-white/60 hover:text-white'}`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          ))}
          {isCorporate ? (
            <>
              {isOAU && (
                <button onClick={() => navigate('/corporate/users')}
                  className="flex-1 flex flex-col items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <UsersIcon className="w-5 h-5" />
                  <span>Users</span>
                </button>
              )}
              <button onClick={() => { logout(); navigate('/'); }}
                className="flex-1 flex flex-col items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
              >
                <LogoutIcon className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <button onClick={() => setSlideoutOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
            >
              <UserProfileIcon className="w-5 h-5" />
              <span>Menu</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Desktop nav — normal flow ── */}
      <div className={showDeskB}>
        <TrueFooter />
        <NavBar />
      </div>

      {saveStatus && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium z-50 ${
          saveStatus === 'saving' ? 'bg-blue-600' : saveStatus === 'saved' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {saveStatus === 'saving' ? 'Saving clip...' : saveStatus === 'saved' ? 'Clip saved to library' : saveStatus === 'toobig' ? 'Clip too large to save (50MB limit)' : 'Save failed'}
        </div>
      )}

      {streamError && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-red-600 text-white rounded-xl px-6 py-4 z-50 max-w-xs w-full mx-4 shadow-2xl text-center">
          <p className="text-red-400 font-semibold text-sm mb-1">Stream Blocked</p>
          <p className="text-gray-300 text-sm mb-4">{streamError}</p>
          <button
            onClick={() => setStreamError(null)}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            OK
          </button>
        </div>
      )}

      {cameraFlash && (
        <div className="fixed inset-0 pointer-events-none z-50" style={{ background: 'white', animation: 'cameraFlash 0.4s ease-out forwards' }} />
      )}

      {liveFacePopup && (
        <FriendFormPopup
          friend={liveFacePopup.friendId ? { Friend_Id: liveFacePopup.friendId, Name_Txt: liveFacePopup.friendName } : null}
          capturedPhotoUrl={liveFacePopup.cropDataUrl || null}
          onClose={() => { setLiveFacePopup(null); setSelectedFace(null); }}
          onSave={(saved) => {
            if (!saved || !liveFacePopup) return;
            setLiveFaces(prev => prev.map(f =>
              f.faceId === liveFacePopup.faceId
                ? { ...f, status: 'known', friendName: saved.name, friendId: saved.friendId }
                : f
            ));
            setLiveFacePopup(null);
            setSelectedFace(null);
          }}
        />
      )}
    </div>
  );
}
