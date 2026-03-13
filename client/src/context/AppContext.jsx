import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/api';

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
  const [isStreamingOut, setIsStreamingOut] = useState(false);
  const pcRef = useRef(null);
  const WHIP_BASE = `${window.location.protocol}//${window.location.hostname}`;

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
      if (!res.ok) throw new Error(`WHIP error ${res.status}`);

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setIsStreamingOut(true);
    } catch (err) {
      console.error('Stream failed:', err);
      pcRef.current?.close();
      pcRef.current = null;
    }
  };

  const stopWhipStream = () => {
    pcRef.current?.close();
    pcRef.current = null;
    setIsStreamingOut(false);
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
      isStreamingOut, startWhipStream, stopWhipStream
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
