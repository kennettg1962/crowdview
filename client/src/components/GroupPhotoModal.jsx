import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from './Icons';
import api from '../api/api';

/**
 * Steps through unknown faces detected in a group photo.
 * For each unknown face: shows the cropped face, prompts for a name,
 * and creates a Friend record + uploads the crop as the photo on Save.
 * Known/identified/employee faces are skipped automatically.
 */
export default function GroupPhotoModal({ faces, imageDataUrl, onClose, onDone }) {
  const unknownFaces = faces.filter(f => f.status === 'unknown');
  const knownCount   = faces.length - unknownFaces.length;

  const [index, setIndex]       = useState(0);
  const [name, setName]         = useState('');
  const [cropUrl, setCropUrl]   = useState(null);
  const [cropBlob, setCropBlob] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [saved, setSaved]       = useState([]); // names saved so far
  const nameInputRef = useRef(null);

  const current = unknownFaces[index] ?? null;
  const done    = index >= unknownFaces.length;

  // Crop the current face from the source image
  useEffect(() => {
    if (!current || !imageDataUrl) return;
    let cancelled = false;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const bb  = current.boundingBox;
      const pad = 0.15;
      const sx  = Math.max(0, (bb.left   - bb.width  * pad) * img.naturalWidth);
      const sy  = Math.max(0, (bb.top    - bb.height * pad) * img.naturalHeight);
      const sw  = Math.min(img.naturalWidth  - sx, bb.width  * (1 + 2 * pad) * img.naturalWidth);
      const sh  = Math.min(img.naturalHeight - sy, bb.height * (1 + 2 * pad) * img.naturalHeight);

      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(sw);
      canvas.height = Math.round(sh);
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (cancelled) return;
        setCropBlob(blob);
        setCropUrl(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.9);
    };
    img.src = imageDataUrl;

    return () => {
      cancelled = true;
      setCropUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      setCropBlob(null);
    };
  }, [current, imageDataUrl]);

  // Focus name input when face changes
  useEffect(() => {
    if (!done) {
      setName('');
      setError(null);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [index, done]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (!cropBlob) return;
    setSaving(true); setError(null);
    try {
      const { data } = await api.post('/api/friends', { name: trimmed, note: '', group: 'Friend' });
      const friendId = data.friendId;
      const formData = new FormData();
      formData.append('photo', cropBlob, 'face.jpg');
      await api.post(`/api/friends/${friendId}/photos`, formData);
      setSaved(prev => [...prev, trimmed]);
      setIndex(i => i + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    setIndex(i => i + 1);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <p className="text-white font-semibold text-sm">
              {done ? 'All done!' : `Face ${index + 1} of ${unknownFaces.length}`}
            </p>
            <p className="text-gray-500 text-xs">
              {done
                ? `${saved.length} added · ${unknownFaces.length - saved.length} skipped · ${knownCount} already known`
                : `${knownCount} already recognised · ${unknownFaces.length - index - 1} remaining`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          /* Summary */
          <div className="px-5 py-8 flex flex-col items-center gap-4">
            <div className="text-4xl">✓</div>
            <div className="text-center">
              {saved.length > 0 ? (
                <>
                  <p className="text-white font-medium mb-1">
                    {saved.length} {saved.length === 1 ? 'person' : 'people'} added
                  </p>
                  <p className="text-gray-400 text-sm">{saved.join(', ')}</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">No new friends added</p>
              )}
            </div>
            <button onClick={onDone}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
              Done
            </button>
          </div>
        ) : (
          /* Face + name form */
          <div className="px-5 py-5 space-y-4">
            {/* Face crop */}
            <div className="flex justify-center">
              <div className="w-36 h-36 rounded-xl bg-gray-700 overflow-hidden border-2 border-gray-600 flex items-center justify-center">
                {cropUrl ? (
                  <img src={cropUrl} alt="Detected face" className="w-full h-full object-cover" />
                ) : (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                )}
              </div>
            </div>

            {/* Name input */}
            <div>
              <label className="text-gray-300 text-sm block mb-1">Who is this?</label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                maxLength={50}
                placeholder="Enter their name"
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button onClick={handleSkip} disabled={saving}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-40">
                Skip
              </button>
              <button onClick={handleSave} disabled={saving || !cropBlob}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
                {saving ? 'Saving…' : 'Add Friend'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
