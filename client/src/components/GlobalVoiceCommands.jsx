import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function GlobalVoiceCommands() {
  const { mediaStream, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const mediaStreamRef = useRef(mediaStream);
  const activeRef = useRef(false);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const startRecognition = () => {
      activeRef.current = true;
      try { recognition.start(); } catch (err) {
        console.warn('[GlobalVoice] Could not start:', err);
      }
    };

    // Chrome requires a user gesture before speech recognition is permitted.
    // Wait for the first interaction on the page before starting.
    const onFirstInteraction = () => {
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
      startRecognition();
    };
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('keydown', onFirstInteraction);

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const transcript = last[0].transcript.trim().toLowerCase();
      console.log('[GlobalVoice] heard:', transcript);

      if (transcript === 'scan' || transcript.includes('scan faces')) {
        const stream = mediaStreamRef.current;
        if (!stream) return; // no active camera — ignore

        // Capture frame from live stream via off-screen video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
          video.play();
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          video.pause();
          const dataUrl = canvas.toDataURL('image/jpeg');
          navigate('/id', { state: { photoDataUrl: dataUrl } });
        };
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        // Mic not yet granted — retry after a delay (will succeed once permission is given)
        retryTimerRef.current = setTimeout(() => {
          if (activeRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        }, 5000);
        return;
      }
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[GlobalVoice] Error:', event.error);
      }
    };

    recognition.onend = () => {
      if (activeRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    return () => {
      activeRef.current = false;
      clearTimeout(retryTimerRef.current);
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [navigate, isAuthenticated]);

  return null;
}
