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
    // WKWebView (Capacitor iOS) cannot sustain a continuous session —
    // it fires onend immediately, causing a tight loop. Use single-shot
    // mode with a restart delay instead.
    const cap = isCapacitor();
    console.log('[SR] SpeechRecognition available:', !!SpeechRecognition, 'cap:', cap);
    if (!SpeechRecognition) return;

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
      console.warn('[SR] error:', e.error);
    };

    recognition.onend = () => {
      console.log('[SR] ended, activeRef:', activeRef.current);
      if (!activeRef.current) return;
      setTimeout(() => {
        if (activeRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
      }, cap ? 500 : 0);
    };

    // Try to start immediately — WKWebView allows this without a gesture.
    try { recognition.start(); console.log('[SR] started'); }
    catch (e) { console.warn('[SR] start failed:', e.message); }

    return () => {
      activeRef.current = false;
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
