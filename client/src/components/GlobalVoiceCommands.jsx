import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function GlobalVoiceCommands() {
  const { mediaStream } = useApp();
  const navigate = useNavigate();
  const mediaStreamRef = useRef(mediaStream);
  const activeRef = useRef(true);

  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    activeRef.current = true;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const transcript = last[0].transcript.trim().toLowerCase();

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
          video.srcObject = null;
          const dataUrl = canvas.toDataURL('image/jpeg');
          navigate('/id', { state: { photoDataUrl: dataUrl } });
        };
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[GlobalVoice] Error:', event.error);
      }
    };

    recognition.onend = () => {
      if (activeRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    try { recognition.start(); } catch (err) {
      console.warn('[GlobalVoice] Could not start:', err);
    }

    return () => {
      activeRef.current = false;
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [navigate]);

  return null;
}
