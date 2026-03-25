import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isMac } from '../utils/platform';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

export default function GlobalVoiceCommands() {
  const { mediaStream, isAuthenticated, voicePaused } = useApp();
  const navigate = useNavigate();
  const mediaStreamRef = useRef(mediaStream);
  mediaStreamRef.current = mediaStream;

  const handleResult = useCallback((transcript) => {
    if (voicePaused) return; // screen-specific hook is active

    if (transcript.includes('snap') || transcript.includes('scan')) {
      const stream = mediaStreamRef.current;
      if (!stream) return;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        video.play();
        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        video.pause();
        const dataUrl = canvas.toDataURL('image/jpeg');
        navigate('/id', { state: { photoDataUrl: dataUrl, saveToLibrary: true } });
      };
    }
  }, [voicePaused, navigate]);

  useSpeechRecognition(handleResult, {
    enabled: !isMac && isAuthenticated,
  });

  return null;
}
