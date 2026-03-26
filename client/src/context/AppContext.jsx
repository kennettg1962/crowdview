import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/api';
import GlassesSDK from '../services/GlassesSDK';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSource, setCurrentSource] = useState(null);
  const [currentAudioIn, setCurrentAudioIn] = useState(null);
  const [currentOutlet, setCurrentOutlet] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [slideoutOpen, setSlideoutOpen] = useState(false);
  const [voicePaused, setVoicePaused] = useState(false);

  // ── Glasses integration ───────────────────────────────────────────────────
  const [captureMode, setCaptureMode]           = useState('phone');
  const [glassesConnected, setGlassesConnected] = useState(false);
  // Incremented by disconnectGlasses to signal HubScreen to re-connect phone camera
  const [cameraReconnectKey, setCameraReconnectKey] = useState(0);
  // Always holds the most recent frame dataUrl pushed by GlassesSDK.onFrame
  const latestGlassesFrameRef = useRef(null);

  const injectGlassesFrame = useCallback((dataUrl) => {
    latestGlassesFrameRef.current = dataUrl;
  }, []);

  /** Connect glasses — switches ALL I/O to the glasses device. */
  const connectGlasses = useCallback(async () => {
    try {
      await GlassesSDK.connect();
      setCaptureMode('glasses');
      setGlassesConnected(true);
      setIsStreaming(true);   // enables Id / Live / Action buttons immediately
      setMediaStream(null);   // no phone MediaStream in glasses mode
    } catch (err) {
      console.error('[Glasses] connect failed:', err);
      setGlassesConnected(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Disconnect glasses — restores ALL I/O to the phone. */
  const disconnectGlasses = useCallback(() => {
    GlassesSDK.disconnect();
    latestGlassesFrameRef.current = null;
    setCaptureMode('phone');
    setGlassesConnected(false);
    setIsStreaming(false);
    setMediaStream(null);
    setCameraReconnectKey(k => k + 1); // triggers HubScreen camera re-connect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Registry for screen-local voice commands — avoids multiple recognition sessions
  const screenVoiceRef = useRef({ screen: null, commands: {}, speak: () => {} });
  const registerScreenVoice = useCallback((screen, commands, speak) => {
    screenVoiceRef.current = { screen, commands, speak };
  }, []);
  const unregisterScreenVoice = useCallback(() => {
    screenVoiceRef.current = { screen: null, commands: {}, speak: () => {} };
  }, []);
  const [isStreamingOut, setIsStreamingOut] = useState(false);
  const [isStreamingConnecting, setIsStreamingConnecting] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const pcRef = useRef(null);
  // On native Capacitor the WebView origin is capacitor://localhost — use the
  // production server URL instead. Falls back to current origin on web.
  const WHIP_BASE = import.meta.env.VITE_APP_API_URL || `${window.location.protocol}//${window.location.hostname}`;

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('cv_token');
    const savedUser = sessionStorage.getItem('cv_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        sessionStorage.removeItem('cv_token');
        sessionStorage.removeItem('cv_user');
      }
    }
  }, []);

  const login = (userData, token) => {
    sessionStorage.setItem('cv_token', token);
    sessionStorage.setItem('cv_user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem('cv_token');
    sessionStorage.removeItem('cv_user');
    setUser(null);
    setIsAuthenticated(false);
    setIsStreaming(false);
    pcRef.current?.close();
    pcRef.current = null;
    setIsStreamingOut(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setCurrentSource(null);
    setCurrentAudioIn(null);
    setCurrentOutlet(null);
  };

  const startStream = (stream) => {
    setMediaStream(stream);
    setIsStreaming(true);
  };

  const stopStream = () => {
    // Stop WHIP stream if active
    pcRef.current?.close();
    pcRef.current = null;
    setIsStreamingOut(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setIsStreaming(false);
  };

  const startWhipStream = async (stream) => {
    setIsStreamingConnecting(true);
    try {
      const keyRes = await api.get('/api/stream/key');
      const { streamKey } = keyRes.data;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        // Force H.264 for video so MediaMTX can mux into HLS (VP8/VP9 not supported)
        if (track.kind === 'video') {
          const transceiver = pc.getTransceivers().find(t => t.sender === sender);
          if (transceiver && RTCRtpSender.getCapabilities) {
            const caps = RTCRtpSender.getCapabilities('video');
            if (caps) {
              const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
              const rest = caps.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
              transceiver.setCodecPreferences([...h264, ...rest]);
            }
          }
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const onchange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
        pc.addEventListener('icegatheringstatechange', onchange);
        setTimeout(resolve, 3000);
      });

      const res = await fetch(`${WHIP_BASE}/live/${streamKey}/whip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      });
      if (!res.ok) {
        const msg = (res.status === 403 || res.status === 400)
          ? 'This user is already streaming from a different device.'
          : `Stream failed (${res.status})`;
        throw new Error(msg);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setStreamError(null);
      setIsStreamingOut(true);
    } catch (err) {
      console.error('Stream failed:', err);
      setStreamError(err.message);
      pcRef.current?.close();
      pcRef.current = null;
    } finally {
      setIsStreamingConnecting(false);
    }
  };

  const stopWhipStream = () => {
    pcRef.current?.close();
    pcRef.current = null;
    setIsStreamingOut(false);
    setStreamError(null);
  };

  return (
    <AppContext.Provider value={{
      user, setUser,
      isAuthenticated,
      login, logout,
      currentSource, setCurrentSource,
      currentAudioIn, setCurrentAudioIn,
      currentOutlet, setCurrentOutlet,
      isStreaming, startStream, stopStream,
      mediaStream, setMediaStream,
      slideoutOpen, setSlideoutOpen,
      voicePaused, setVoicePaused,
      screenVoiceRef, registerScreenVoice, unregisterScreenVoice,
      isStreamingOut, isStreamingConnecting, startWhipStream, stopWhipStream, streamError, setStreamError,
      captureMode, glassesConnected, connectGlasses, disconnectGlasses,
      latestGlassesFrameRef, injectGlassesFrame, cameraReconnectKey
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export default AppContext;
