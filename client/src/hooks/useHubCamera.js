import { useState, useRef, useEffect } from 'react';
import api from '../api/api';

export default function useHubCamera({
  captureMode,
  cameraReconnectKey,
  mediaStream,
  currentSource,
  startStream,
  setCurrentSource,
  setCurrentAudioIn,
}) {
  const [permissionError, setPermissionError] = useState(null);
  const [inmoEnabled, setInmoEnabled]         = useState(false);
  const [metaEnabled, setMetaEnabled]         = useState(false);
  const [haloEnabled, setHaloEnabled]         = useState(false);
  const autoConnectAttempted = useRef(false);

  async function connectPhoneCamera() {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    try {
      let videoConstraint = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      try {
        const profile = await api.get('/api/users/profile');
        if (profile.data.Last_Source_Device_Id) {
          videoConstraint = { deviceId: { ideal: profile.data.Last_Source_Device_Id }, width: { ideal: 1920 }, height: { ideal: 1080 } };
        }
        setInmoEnabled(profile.data.Inmo_Air3_Enabled_Fl === 'Y');
        setMetaEnabled(profile.data.Meta_Glasses_Enabled_Fl === 'Y');
        setHaloEnabled(profile.data.Halo_Enabled_Fl === 'Y');
      } catch { /* non-fatal */ }

      // Probe audio first so we can request the built-in mic by exact deviceId.
      // Without this, Continuity Camera makes the iPhone mic the system default
      // and Chrome honours that.
      let audioConstraint = true;
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        probe.getAudioTracks().forEach(t => t.stop());
        const probeDevices = await navigator.mediaDevices.enumerateDevices();
        const builtIn = probeDevices.find(d => d.kind === 'audioinput' && /built.?in/i.test(d.label));
        if (builtIn) audioConstraint = { deviceId: { exact: builtIn.deviceId } };
      } catch { /* non-fatal */ }

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

  // Auto-connect on mount (skipped in glasses mode)
  useEffect(() => {
    if (captureMode === 'glasses') return;
    connectPhoneCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-connect after glasses disconnect
  useEffect(() => {
    if (cameraReconnectKey === 0) return;
    autoConnectAttempted.current = false;
    connectPhoneCamera();
  }, [cameraReconnectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetryAccess() {
    setPermissionError(null);
    autoConnectAttempted.current = false;
    connectPhoneCamera();
  }

  async function switchCamera(device) {
    try {
      const oldAudioTracks = mediaStream ? mediaStream.getAudioTracks() : [];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
      const connected = allDevices.find(d => d.kind === 'audioinput' && d.label === newTrack.label) ?? device;
      setCurrentAudioIn(connected);
    }
    try {
      await applyAudioTrack(device?.deviceId ? { deviceId: { exact: device.deviceId } } : true);
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

  return {
    permissionError,
    handleRetryAccess,
    switchCamera,
    switchMic,
    flipCamera,
    inmoEnabled,
    metaEnabled,
    haloEnabled,
  };
}
