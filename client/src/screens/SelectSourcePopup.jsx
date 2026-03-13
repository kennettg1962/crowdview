import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { XIcon, CheckIcon } from '../components/Icons';
import api from '../api/api';

function DeviceList({ devices, selected, onSelect, onConnect, onDisconnect, connected }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-32 overflow-y-auto bg-gray-900 rounded-lg divide-y divide-gray-700">
        {devices.length === 0 ? (
          <p className="text-gray-500 text-sm p-3">No devices found</p>
        ) : devices.map(d => (
          <button
            key={d.deviceId}
            onClick={() => onSelect(d)}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
              selected?.deviceId === d.deviceId ? 'bg-blue-800 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="truncate">{d.label || `Device (${d.deviceId.slice(0, 8)}...)`}</span>
            {connected?.deviceId === d.deviceId && <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0" />}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onConnect(selected)}
          disabled={!selected}
          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm disabled:opacity-40"
        >
          Connect
        </button>
        <button
          onClick={() => onDisconnect()}
          disabled={!connected}
          className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function SelectSourcePopup({ onClose }) {
  const { currentSource, setCurrentSource, currentAudioIn, setCurrentAudioIn, startStream, stopStream, mediaStream } = useApp();
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudioIn, setSelectedAudioIn] = useState(null);
  const [selectedAudioOut, setSelectedAudioOut] = useState(null);
  const [connectedVideo, setConnectedVideo] = useState(currentSource);
  const [connectedAudioIn, setConnectedAudioIn] = useState(currentAudioIn);
  const [connectedAudioOut, setConnectedAudioOut] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    enumerateDevices();
  }, []);

  async function enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    } catch (err) {
      setError('Failed to enumerate devices: ' + err.message);
    }
  }

  async function handleConnectVideo(device) {
    if (!device) return;
    try {
      if (mediaStream) stopStream();
      const audioConstraint = connectedAudioIn ? { deviceId: { exact: connectedAudioIn.deviceId } } : true;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
          audio: audioConstraint,
        });
      } catch {
        // Audio may be blocked (OS mic permissions) — connect video-only
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: device.deviceId } },
        });
      }
      startStream(stream);
      setConnectedVideo(device);
      setCurrentSource(device);
      // Persist last used device so auto-connect can restore it
      api.put('/api/users/profile', { lastSourceDeviceId: device.deviceId }).catch(() => {});
    } catch (err) {
      setError('Could not connect to camera: ' + err.message);
    }
  }

  function handleDisconnectVideo() {
    stopStream();
    setConnectedVideo(null);
    setCurrentSource(null);
  }

  async function handleConnectAudioIn(device) {
    if (!device) return;
    try {
      // Use ideal (not exact) so empty/anonymised device IDs don't cause NotFoundError
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: device.deviceId ? { deviceId: { ideal: device.deviceId } } : true,
      });
      const [audioTrack] = audioStream.getAudioTracks();
      if (audioTrack && mediaStream) {
        // Replace any existing audio tracks on the live stream
        mediaStream.getAudioTracks().forEach(t => { t.stop(); mediaStream.removeTrack(t); });
        mediaStream.addTrack(audioTrack);
      }
      setConnectedAudioIn(device);
      setCurrentAudioIn(device);
      // Re-enumerate now that mic permission is granted — real labels/IDs will appear
      await enumerateDevices();
    } catch (err) {
      setError('Could not connect microphone: ' + err.message);
    }
  }

  function handleDisconnectAudioIn() {
    if (mediaStream) {
      mediaStream.getAudioTracks().forEach(t => { t.stop(); mediaStream.removeTrack(t); });
    }
    setConnectedAudioIn(null);
    setCurrentAudioIn(null);
  }

  function handleConnectAudioOut(device) {
    if (!device) return;
    setConnectedAudioOut(device);
  }

  function handleDisconnectAudioOut() {
    setConnectedAudioOut(null);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-lg">Select Source</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && <p className="text-red-400 text-sm bg-red-900/30 p-3 rounded-lg">{error}</p>}

          {/* Video Sources */}
          <div>
            <h3 className="text-blue-400 font-medium text-sm mb-2 uppercase tracking-wide">Video Sources</h3>
            <DeviceList
              devices={videoDevices}
              selected={selectedVideo}
              onSelect={setSelectedVideo}
              onConnect={handleConnectVideo}
              onDisconnect={handleDisconnectVideo}
              connected={connectedVideo}
            />
          </div>

          {/* Voice/Audio Inputs */}
          <div>
            <h3 className="text-blue-400 font-medium text-sm mb-2 uppercase tracking-wide">Voice Sources</h3>
            {audioInputDevices.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-3 flex flex-col gap-2">
                <p className="text-gray-500 text-sm">Microphone access required to list devices.</p>
                <button
                  onClick={async () => {
                    try {
                      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                      s.getTracks().forEach(t => t.stop());
                      await enumerateDevices();
                    } catch (err) {
                      setError(
                        err.name === 'NotFoundError'
                          ? 'No microphone found. Check System Settings → Privacy & Security → Microphone and ensure your browser is enabled.'
                          : 'Microphone access denied: ' + err.message
                      );
                    }
                  }}
                  className="py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                >
                  Grant Microphone Access
                </button>
              </div>
            ) : (
              <DeviceList
                devices={audioInputDevices}
                selected={selectedAudioIn}
                onSelect={setSelectedAudioIn}
                onConnect={handleConnectAudioIn}
                onDisconnect={handleDisconnectAudioIn}
                connected={connectedAudioIn}
              />
            )}
          </div>

          {/* Audio Outputs */}
          <div>
            <h3 className="text-blue-400 font-medium text-sm mb-2 uppercase tracking-wide">Audio Outputs</h3>
            <DeviceList
              devices={audioOutputDevices}
              selected={selectedAudioOut}
              onSelect={setSelectedAudioOut}
              onConnect={handleConnectAudioOut}
              onDisconnect={handleDisconnectAudioOut}
              connected={connectedAudioOut}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
