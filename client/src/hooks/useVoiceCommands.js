import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import GlassesSDK from '../services/GlassesSDK';

/**
 * Register screen-local voice commands with the single GlobalVoiceCommands session.
 * Does NOT start its own recognition — GlobalVoiceCommands owns the session.
 *
 * @param {string} options.screen   - 'hub' | 'id' | 'friends'
 * @param {Object} options.commands - map of command name → handler
 */
export default function useVoiceCommands({ screen, commands = {} }) {
  const { registerScreenVoice, unregisterScreenVoice, captureMode } = useApp();
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const speak = useCallback((text) => {
    // Glasses mode: route audio through the glasses speakers
    if (captureMode === 'glasses') {
      GlassesSDK.speak(text);
      return;
    }
    // WKWebView (iOS Capacitor) SpeechSynthesis conflicts with the active mic session.
    // Android Capacitor WebView handles it fine — only block on iOS.
    const isCapacitor = window.location.protocol === 'capacitor:';
    const isIOS = isCapacitor && window.Capacitor?.getPlatform() === 'ios';
    if (isIOS) return;
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = 1.1;
    utterance.volume = 0.7;
    window.speechSynthesis.speak(utterance);
  }, [captureMode]);

  const speakRef = useRef(speak);
  speakRef.current = speak;

  useEffect(() => {
    registerScreenVoice(screen, commandsRef, speakRef);
    return () => unregisterScreenVoice();
  }, [screen, registerScreenVoice, unregisterScreenVoice]);

  return { speak };
}
