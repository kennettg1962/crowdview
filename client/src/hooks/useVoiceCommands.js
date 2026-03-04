import { useEffect, useRef, useCallback } from 'react';

/**
 * Voice command hook using Web Speech API.
 * @param {Object} options
 * @param {string} options.screen - Current screen name ('hub' | 'id' | 'friends')
 * @param {Object} options.commands - Map of command name → handler function
 */
export default function useVoiceCommands({ screen, commands = {} }) {
  const recognitionRef = useRef(null);
  const activeRef = useRef(true);
  const commandsRef = useRef(commands);

  // Keep commands ref current
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.volume = 0.7;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    activeRef.current = true;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const transcript = last[0].transcript.trim().toLowerCase();
      console.log(`[VoiceCommand] Heard: "${transcript}" on screen: ${screen}`);

      // Match commands based on current screen
      const cmds = commandsRef.current;

      if (screen === 'hub') {
        if (transcript.includes('stream') && !transcript.includes('stop')) {
          speak('Streaming');
          cmds.stream?.();
        } else if (transcript.includes('stop stream') || transcript.includes('stop streaming')) {
          speak('Stopping stream');
          cmds.stopStream?.();
        }
      } else if (screen === 'id') {
        if (transcript === 'prev' || transcript === 'previous') {
          speak('Previous');
          cmds.prev?.();
        } else if (transcript === 'next') {
          speak('Next');
          cmds.next?.();
        } else if (transcript === 'show') {
          speak('Show');
          cmds.show?.();
        }
      } else if (screen === 'friends') {
        if (transcript.startsWith('name ')) {
          const nameText = transcript.slice(5);
          speak(`Name: ${nameText}`);
          cmds.name?.(nameText);
        } else if (transcript.startsWith('note ')) {
          const noteText = transcript.slice(5);
          speak(`Note: ${noteText}`);
          cmds.note?.(noteText);
        } else if (transcript === 'update') {
          speak('Updating');
          cmds.update?.();
        } else if (transcript === 'cancel') {
          speak('Cancelling');
          cmds.cancel?.();
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[VoiceCommand] Error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (activeRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('[VoiceCommand] Could not start recognition:', err);
    }

    return () => {
      activeRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Already stopped
      }
    };
  }, [screen, speak]);

  return { speak };
}
