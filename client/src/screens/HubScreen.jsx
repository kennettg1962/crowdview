import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import DevicePicker from '../components/DevicePicker';
import FriendForm from '../components/FriendForm';
import {
  FriendsIcon, LibraryIcon,
  IdIcon, ActionIcon, CameraIcon, CutIcon, MicIcon,
  MovieCameraIcon, StreamIcon, StopCircleIcon, VideoOffIcon, LiveScanIcon
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
    startStream, stopStream,
    isStreamingOut, startWhipStream, stopWhipStream,
  } = useApp();
  const videoRef = useRef(null);
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
  const [liveFaces, setLiveFaces] = useState([]);
  const [selectedFace, setSelectedFace] = useState(null);

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

        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: true });
        startStream(stream);

        // Enumerate to resolve real device objects for both pickers
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
      const constraint = device?.deviceId ? { deviceId: { ideal: device.deviceId } } : true;
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

  // ── Live scan interval ─────────────────────────────────────────────────────
  useEffect(() => {
    liveScanActiveRef.current = liveScan;
    if (!liveScan) {
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      setLiveFaces([]);
      setSelectedFace(null);
      return;
    }
    const interval = setInterval(async () => {
      if (scanInFlightRef.current || !videoRef.current || !overlayCanvasRef.current || !liveScanActiveRef.current) return;
      const video = videoRef.current;
      if (!video.videoWidth || video.readyState < 3) return;

      // Sync overlay canvas resolution to video native resolution
      const canvas = overlayCanvasRef.current;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      // Capture frame — cap at 640px wide to keep payload size manageable for CompreFace
      const maxW = 640;
      const scale = Math.min(1, maxW / video.videoWidth);
      const capture = document.createElement('canvas');
      capture.width  = Math.round(video.videoWidth  * scale);
      capture.height = Math.round(video.videoHeight * scale);
      capture.getContext('2d').drawImage(video, 0, 0, capture.width, capture.height);
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

  function handleStream() { if (isStreaming) startWhipStream(mediaStream); }
  function handleStopStream() { stopWhipStream(); }

  const canId = isStreaming;

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
        />

      </div>

      {/* Main 3-column layout */}
      <main className="flex-1 flex items-stretch px-2 pb-2 gap-0">

        {/* Left 15%: Id + action buttons */}
        <div className="w-[15%] bg-slate-700 rounded-l-xl flex flex-col">
          {liveScan ? (
            <SideButton icon={LiveScanIcon} label="Live" onClick={() => setLiveScan(false)} className="text-white bg-green-700 hover:bg-green-600 rounded-xl animate-pulse" />
          ) : (
            <SideButton icon={LiveScanIcon} label="Live" onClick={() => setLiveScan(true)} disabled={!canId} className="text-white hover:bg-slate-600" />
          )}
          <div className="mx-3 border-t border-slate-600" />
          <SideButton icon={IdIcon} label="Id" onClick={handleId} disabled={!canId} className="text-white hover:bg-slate-600" />
          <div className="mx-3 border-t border-slate-600" />
          {!isRecordingAction ? (
            <SideButton icon={ActionIcon} label="Action" onClick={handleAction} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          ) : (
            <SideButton icon={CutIcon} label="Cut" onClick={handleCut} className="text-white bg-red-700 hover:bg-red-600 rounded-xl animate-pulse" />
          )}
          <SideButton icon={CameraIcon} label="Camera" onClick={handleCamera} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
        </div>

        {/* Center: video — shrinks when face panel is open */}
        <div style={{ width: selectedFace ? '42%' : '70%', transition: 'width 0.3s ease' }}
          className="bg-white flex flex-col items-center justify-center p-3 border-t border-b border-gray-200">
          <div className="w-full video-container bg-black border-2 border-white rounded-sm overflow-hidden relative">
            {mediaStream ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas
                  ref={overlayCanvasRef}
                  onClick={handleCanvasClick}
                  className={`absolute inset-0 w-full h-full ${liveScan && liveFaces.length > 0 ? 'cursor-pointer' : 'pointer-events-none'}`}
                />
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
        </div>

        {/* Face detail panel — slides in when a bounding box is clicked */}
        {selectedFace && (
          <div style={{ width: '28%', transition: 'width 0.3s ease' }} className="flex flex-col overflow-hidden">
            <FriendForm
              friend={selectedFriendProp}
              capturedPhotoUrl={!selectedFace.friendId ? selectedFace.cropDataUrl : null}
              onClose={() => setSelectedFace(null)}
              onSave={() => setSelectedFace(null)}
              onDelete={() => setSelectedFace(null)}
            />
          </div>
        )}

        {/* Right 15%: Stream + live friends */}
        <div className="w-[15%] bg-slate-700 rounded-r-xl flex flex-col items-center">
          {!isStreamingOut ? (
            <SideButton icon={StreamIcon} label="Stream" onClick={handleStream} disabled={!isStreaming} className="text-white hover:bg-slate-600" />
          ) : (
            <>
              <SideButton icon={StopCircleIcon} label="Stop Stream" onClick={handleStopStream} className="text-white bg-pink-800 hover:bg-pink-700 rounded-xl" />
              <span className="text-red-400 text-xs font-semibold text-center px-2 mt-1 leading-snug">CrowdView Live</span>
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
