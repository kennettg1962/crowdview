import { useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import GlassesSDK from '../services/GlassesSDK';

export default function GlobalVoiceCommands() {
  const {
    mediaStream, isAuthenticated, screenVoiceRef,
    isStreaming, isStreamingOut, isStreamingConnecting,
    startWhipStream, stopWhipStream, glassesConnected,
  } = useApp();

  const navigate = useNavigate();

  // Refs so the stable handleResult callback always sees current values.
  const mediaStreamRef         = useRef(mediaStream);
  const isStreamingRef         = useRef(isStreaming);
  const isStreamingOutRef      = useRef(isStreamingOut);
  const isStreamingConnRef     = useRef(isStreamingConnecting);
  const startWhipStreamRef     = useRef(startWhipStream);
  const stopWhipStreamRef      = useRef(stopWhipStream);
  mediaStreamRef.current       = mediaStream;
  isStreamingRef.current       = isStreaming;
  isStreamingOutRef.current    = isStreamingOut;
  isStreamingConnRef.current   = isStreamingConnecting;
  startWhipStreamRef.current   = startWhipStream;
  stopWhipStreamRef.current    = stopWhipStream;

  const handleResult = useCallback((transcript) => {
    const { screen, commands, speak } = screenVoiceRef.current;
    const cmds = commands?.current ?? commands ?? {};
    const sp   = speak?.current  ?? speak  ?? (() => {});

    // ── Screen-local commands ────────────────────────────────────────
    if (screen === 'hub') {
      if (transcript.includes('snap') || transcript.includes('scan')) {
        sp('Scanning'); cmds.scan?.(); return;
      }
      // Live scan on/off
      if (transcript === 'live' || transcript.includes('start live')) {
        cmds.live?.(); return;
      }
      if (transcript.includes('stop live') || transcript.includes('stop scan')) {
        cmds.stop?.(); return;
      }
      // Face cycling in live mode
      if (transcript === 'next') {
        cmds.next?.(); return;
      }
      if (transcript === 'previous' || transcript === 'prev') {
        cmds.prev?.(); return;
      }
      // "who" / "who's there" — speak detected face names
      if (transcript.includes('who')) {
        cmds.who?.(); return;
      }

    } else if (screen === 'id') {
      if (transcript === 'prev' || transcript === 'previous') {
        sp('Previous'); cmds.prev?.(); return;
      } else if (transcript === 'next') {
        sp('Next'); cmds.next?.(); return;
      } else if (transcript === 'show') {
        sp('Show'); cmds.show?.(); return;
      } else if (transcript === 'cancel') {
        sp('Cancelled'); cmds.cancel?.(); return;
      } else if (transcript === 'back') {
        sp('Going back'); cmds.back?.(); return;
      }

    } else if (screen === 'friends') {
      if (transcript.startsWith('name ')) {
        const t = transcript.slice(5); sp(`Name: ${t}`); cmds.name?.(t); return;
      } else if (transcript.startsWith('note ')) {
        const t = transcript.slice(5); sp(`Note: ${t}`); cmds.note?.(t); return;
      } else if (transcript === 'update') {
        sp('Updating'); cmds.update?.(); return;
      } else if (transcript === 'cancel') {
        sp('Cancelling'); cmds.cancel?.(); return;
      }
    }

    // ── Global commands — active from any screen ─────────────────────

    // snap/scan: only when the camera is live (Id button is enabled)
    if (transcript.includes('snap') || transcript.includes('scan')) {
      if (!isStreamingRef.current) return;
      const stream = mediaStreamRef.current;
      if (!stream) return;
      const video = document.createElement('video');
      video.srcObject   = stream;
      video.muted       = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        video.play();
        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        video.pause();
        navigate('/id', { state: { photoDataUrl: canvas.toDataURL('image/jpeg'), saveToLibrary: true } });
      };
      return;
    }

    // stream: only when camera is live and not already streaming out
    if (transcript === 'stream') {
      if (isStreamingRef.current && !isStreamingOutRef.current && !isStreamingConnRef.current) {
        startWhipStreamRef.current(mediaStreamRef.current);
      }
      return;
    }

    // end / stop stream: only when a stream is active or connecting
    if (transcript === 'end' || transcript.includes('stop stream')) {
      if (isStreamingOutRef.current || isStreamingConnRef.current) {
        stopWhipStreamRef.current();
      }
      return;
    }
  }, [navigate, screenVoiceRef]);

  // Phone mic — disabled when glasses are connected (glasses mic takes over)
  useSpeechRecognition(handleResult, {
    enabled: isAuthenticated && !glassesConnected,
  });

  // Glasses mic — subscribe to transcripts when glasses are connected
  useEffect(() => {
    if (!glassesConnected) return;
    GlassesSDK.onTranscript(handleResult);
    return () => GlassesSDK.offTranscript(handleResult);
  }, [glassesConnected, handleResult]);

  return null;
}
