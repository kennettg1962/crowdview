import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import GlassesSDK from '../services/GlassesSDK';

/**
 * Abstracts where identification results are sent.
 *
 * @returns {{ showResult }}
 *
 * showResult(photoDataUrl, options)
 *   Phone mode  : navigate to IdScreen (existing behaviour — IdScreen calls the API).
 *   Glasses mode: send face summary directly to the glasses display via GlassesSDK.
 *                 In glasses mode the caller is responsible for calling the API first
 *                 and passing the resulting faces array in options.
 *
 * options:
 *   saveToLibrary {boolean} - default true
 *   faces         {Array}   - required in glasses mode
 */
export default function useResultDisplay() {
  const { captureMode } = useApp();
  const navigate = useNavigate();

  const showResult = useCallback((photoDataUrl, { saveToLibrary = true, faces } = {}) => {
    if (captureMode === 'glasses' && faces) GlassesSDK.sendResult(faces);
    navigate('/id', { state: { photoDataUrl, saveToLibrary } });
  }, [captureMode, navigate]);

  return { showResult };
}
