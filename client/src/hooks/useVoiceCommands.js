import { useCallback, useRef } from 'react';
import { isMac } from '../utils/platform';
import useSpeechRecognition from './useSpeechRecognition';

/**
 * Screen-local voice command hook.
 * Pauses GlobalVoiceCommands while active (via voicePaused in AppContext).
 *
 * @param {string} options.screen   - 'hub' | 'id' | 'friends'
 * @param {Object} options.commands - map of command name → handler
 */
export default function useVoiceCommands({ screen, commands = {} }) {
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = 1.1;
    utterance.volume = 0.7;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speakRef = useRef(speak);
  speakRef.current = speak;

  const handleResult = useCallback((transcript) => {
    const cmds = commandsRef.current;

    if (screen === 'hub') {
      if (transcript.includes('snap') || transcript.includes('scan')) {
        speakRef.current('Scanning');
        cmds.scan?.();
      } else if (transcript.includes('stop stream') || transcript.includes('stop streaming')) {
        speakRef.current('Stopping stream');
        cmds.stopStream?.();
      } else if (transcript.includes('stream')) {
        speakRef.current('Streaming');
        cmds.stream?.();
      }

    } else if (screen === 'id') {
      if (transcript === 'prev' || transcript === 'previous') {
        speakRef.current('Previous');
        cmds.prev?.();
      } else if (transcript === 'next') {
        speakRef.current('Next');
        cmds.next?.();
      } else if (transcript === 'show') {
        speakRef.current('Show');
        cmds.show?.();
      } else if (transcript === 'cancel') {
        speakRef.current('Cancelled');
        cmds.cancel?.();
      } else if (transcript === 'back') {
        speakRef.current('Going back');
        cmds.back?.();
      }

    } else if (screen === 'friends') {
      if (transcript.startsWith('name ')) {
        const nameText = transcript.slice(5);
        speakRef.current(`Name: ${nameText}`);
        cmds.name?.(nameText);
      } else if (transcript.startsWith('note ')) {
        const noteText = transcript.slice(5);
        speakRef.current(`Note: ${noteText}`);
        cmds.note?.(noteText);
      } else if (transcript === 'update') {
        speakRef.current('Updating');
        cmds.update?.();
      } else if (transcript === 'cancel') {
        speakRef.current('Cancelling');
        cmds.cancel?.();
      }
    }
  }, [screen]);

  useSpeechRecognition(handleResult, {
    enabled: !isMac,
  });

  return { speak };
}
