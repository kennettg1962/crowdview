/**
 * useSpeechRecognition
 *
 * Abstracts native Capacitor speech recognition (iOS/Android) vs
 * Web Speech API (Chrome desktop). Consumers get a uniform interface:
 *   const { start, stop, supported } = useSpeechRecognition(onResult);
 *
 * onResult(transcript: string) is called for every final result.
 */
import { useEffect, useRef } from 'react';

const isCapacitor = () => window.location.protocol === 'capacitor:';

export default function useSpeechRecognition(onResult, { enabled = true } = {}) {
  const onResultRef = useRef(onResult);
  const activeRef   = useRef(false);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    if (!enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // WKWebView (Capacitor iOS) cannot sustain a continuous session —
    // it fires onend immediately, causing a tight loop. Use single-shot
    // mode with a restart delay instead.
    const cap = isCapacitor();

    const recognition = new SpeechRecognition();
    recognition.continuous     = !cap;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';
    activeRef.current          = true;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const transcript = last[0].transcript.trim().toLowerCase();
      if (transcript) onResultRef.current(transcript);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[SpeechRecognition] error:', e.error);
      }
    };

    recognition.onend = () => {
      if (!activeRef.current) return;
      setTimeout(() => {
        if (activeRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
      }, cap ? 500 : 0); // delay on Capacitor prevents tight loop
    };

    const onInteraction = () => {
      document.removeEventListener('click',      onInteraction);
      document.removeEventListener('keydown',    onInteraction);
      document.removeEventListener('touchstart', onInteraction);
      try { recognition.start(); } catch { /* already started */ }
    };
    document.addEventListener('click',      onInteraction);
    document.addEventListener('keydown',    onInteraction);
    document.addEventListener('touchstart', onInteraction);

    return () => {
      activeRef.current = false;
      document.removeEventListener('click',      onInteraction);
      document.removeEventListener('keydown',    onInteraction);
      document.removeEventListener('touchstart', onInteraction);
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
