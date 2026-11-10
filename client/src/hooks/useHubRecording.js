import { useState, useRef } from 'react';
import api from '../api/api';

export default function useHubRecording({ isStreaming, mediaStream }) {
  const [isRecordingAction, setIsRecordingAction] = useState(false);
  const [saveStatus, setSaveStatus]               = useState(null);
  const actionRecorderRef = useRef(null);

  function handleAction() {
    if (!isStreaming || !mediaStream) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = e => {
        if (e.data.size === 0) return;
        if (e.data.size > 50 * 1024 * 1024) {
          setSaveStatus('toobig');
          setTimeout(() => setSaveStatus(null), 4000);
          return;
        }
        setSaveStatus('saving');
        const fd = new FormData();
        fd.append('media', new Blob([e.data], { type: 'video/webm' }), 'action.webm');
        api.post('/api/media', fd, { timeout: 120000 })
          .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus(null), 2000); })
          .catch(() => { setSaveStatus('error'); setTimeout(() => setSaveStatus(null), 4000); });
      };
      recorder.onstop = () => { actionRecorderRef.current = null; setIsRecordingAction(false); };
      recorder.start();
      actionRecorderRef.current = recorder;
      setIsRecordingAction(true);
    } catch { /* MediaRecorder not supported */ }
  }

  function handleCut() {
    const rec = actionRecorderRef.current;
    if (!rec || rec.state === 'inactive') { setIsRecordingAction(false); return; }
    rec.stop();
  }

  return { isRecordingAction, saveStatus, handleAction, handleCut, actionRecorderRef };
}
