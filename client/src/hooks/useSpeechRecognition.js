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

    // On Capacitor, track last error to choose an appropriate restart delay.
    const lastErrorRef = { current: null };

    recognition.onerror = (e) => {
      console.warn('[SR] error:', e.error);
      lastErrorRef.current = e.error;
      if (e.error === 'not-allowed') {
        // iOS revoked mic after backgrounding — stop the restart loop;
        // visibilitychange will re-arm when the app returns to foreground.
        activeRef.current = false;
      }
    };

    recognition.onend = () => {
      if (!activeRef.current) return;
      // After an audio/permission error use a longer pause to let iOS recover;
      // otherwise use a short delay to keep the listening window tight.
      const err = lastErrorRef.current;
      lastErrorRef.current = null;
      const delay = cap
        ? (err === 'audio-capture' || err === 'aborted' ? 1500 : 200)
        : 0;
      setTimeout(() => {
        if (activeRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
      }, delay);
    };

    // Restart recognition when the app returns to the foreground.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !activeRef.current) {
        console.log('[SR] resuming after foreground');
        activeRef.current = true;
        // Give iOS time to re-establish the audio session before starting.
        setTimeout(() => {
          if (activeRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        }, 1500);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Try to start immediately — WKWebView allows this without a gesture.
    try { recognition.start(); console.log('[SR] started'); }
    catch (e) { console.warn('[SR] start failed:', e.message); }

    return () => {
      activeRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
