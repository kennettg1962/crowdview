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
  const listenerRef = useRef(null); // native listener handle

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    console.log('[SR] effect running, enabled:', enabled, 'capacitor:', isCapacitor());
    if (!enabled) return;

    if (isCapacitor()) {
      // ── Native path ──────────────────────────────────────────────
      let mounted = true;

      async function startNative() {
        try {
          const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

          // Check / request permissions
          const perms = await SpeechRecognition.checkPermissions();
          if (perms.speechRecognition !== 'granted') {
            const req = await SpeechRecognition.requestPermissions();
            if (req.speechRecognition !== 'granted') {
              console.warn('[SpeechRecognition] Permission denied');
              return;
            }
          }

          // Listen for results
          listenerRef.current = await SpeechRecognition.addListener(
            'partialResults',
            (data) => {
              const transcript = (data.matches?.[0] || '').trim().toLowerCase();
              if (transcript) onResultRef.current(transcript);
            }
          );

          // Auto-restart when iOS stops listening
          const stateListener = await SpeechRecognition.addListener(
            'listeningState',
            async (state) => {
              if (state.status === 'stopped' && activeRef.current && mounted) {
                setTimeout(async () => {
                  if (activeRef.current && mounted) {
                    try { await SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false }); }
                    catch { /* already started */ }
                  }
                }, 300); // brief delay prevents tight loop if iOS ends immediately
              }
            }
          );

          // Store both listeners for cleanup
          const origHandle = listenerRef.current;
          listenerRef.current = {
            remove: () => { origHandle?.remove(); stateListener?.remove(); }
          };

          activeRef.current = true;
          console.log('[SR] native SpeechRecognition.start() called');
          await SpeechRecognition.start({ language: 'en-US', partialResults: true, popup: false });
        } catch (err) {
          console.warn('[SpeechRecognition] Native start failed:', err);
        }
      }

      // Wait for first user interaction before starting (iOS requirement)
      const onInteraction = () => {
        console.log('[SR] native interaction detected, starting...');
        document.removeEventListener('touchstart', onInteraction);
        document.removeEventListener('click',      onInteraction);
        startNative();
      };
      document.addEventListener('touchstart', onInteraction);
      document.addEventListener('click',      onInteraction);

      return () => {
        mounted = false;
        activeRef.current = false;
        document.removeEventListener('touchstart', onInteraction);
        document.removeEventListener('click',      onInteraction);
        listenerRef.current?.remove();
        listenerRef.current = null;
        import('@capacitor-community/speech-recognition')
          .then(({ SpeechRecognition }) => SpeechRecognition.stop())
          .catch(() => {});
      };

    } else {
      // ── Web Speech API path (Chrome desktop) ─────────────────────
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous    = true;
      recognition.interimResults = false;
      recognition.lang          = 'en-US';
      activeRef.current         = true;

      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (!last.isFinal) return;
        const transcript = last[0].transcript.trim().toLowerCase();
        if (transcript) onResultRef.current(transcript);
      };

      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[SpeechRecognition] Web error:', e.error);
        }
      };

      recognition.onend = () => {
        if (activeRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      const onInteraction = () => {
        console.log('[SR] web interaction detected, starting...');
        document.removeEventListener('click',   onInteraction);
        document.removeEventListener('keydown', onInteraction);
        try { recognition.start(); console.log('[SR] web recognition.start() called'); }
        catch (e) { console.warn('[SR] web start error:', e); }
      };
      document.addEventListener('click',   onInteraction);
      document.addEventListener('keydown', onInteraction);

      return () => {
        activeRef.current = false;
        document.removeEventListener('click',   onInteraction);
        document.removeEventListener('keydown', onInteraction);
        try { recognition.stop(); } catch { /* already stopped */ }
      };
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
