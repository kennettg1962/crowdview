import React, { useState, useEffect, useRef } from 'react';
import api from '../api/api';
import { UploadIcon, XIcon, DeleteIcon } from './Icons';
import AuthImage from './AuthImage';

const GROUPS = ['Friend', 'Family', 'Friend of Friend', 'Friend of Family', 'Business'];

/**
 * Friend form — renders inline (no modal wrapper).
 * Used directly by HubScreen panel and wrapped in FriendFormPopup for modal use.
 */
export default function FriendForm({ friend, capturedPhotoUrl, onClose, onSave, onDelete }) {
  const [name, setName] = useState(friend?.Name_Txt || '');
  const [note, setNote] = useState(friend?.Note_Multi_Line_Txt || '');
  const [group, setGroup] = useState(friend?.Friend_Group || 'Friend');
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [linkedUserName, setLinkedUserName] = useState(friend?.Linked_User_Name || null);
  const [linkedUserEmail, setLinkedUserEmail] = useState(friend?.Linked_User_Email || null);
  const fileInputRef = useRef(null);
  const isDirty = useRef(false);

  useEffect(() => {
    return () => { if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl); };
  }, [pendingPhotoUrl]);

  useEffect(() => { isDirty.current = true; }, [name, note, group]);

  useEffect(() => {
    if (friend?.Friend_Id) loadPhotos(friend.Friend_Id);
  }, [friend]);

  async function loadPhotos(friendId) {
    setLoading(true);
    try {
      const res = await api.get(`/api/friends/${friendId}/photos`);
      setPhotos(res.data);
    } catch (err) {
      console.error('Failed to load photos', err);
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (name.trim().length > 50) errs.name = 'Name must be 50 chars or less';
    if (!group) errs.group = 'Group is required';
    if (!friend && photos.length === 0 && !capturedPhotoUrl && !pendingPhoto) errs.photo = 'At least one photo is required';
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (friend?.Friend_Id) {
        await api.put(`/api/friends/${friend.Friend_Id}`, { name: name.trim(), note, group });
        onSave && onSave({ name: name.trim(), friendId: friend.Friend_Id });
      } else {
        const res = await api.post('/api/friends', { name: name.trim(), note, group });
        const newId = res.data?.friendId;
        if (newId) {
          if (pendingPhoto) {
            const formData = new FormData();
            formData.append('photo', pendingPhoto, 'photo.jpg');
            await api.post(`/api/friends/${newId}/photos`, formData);
          } else if (capturedPhotoUrl) {
            const blob = await fetch(capturedPhotoUrl).then(r => r.blob());
            const formData = new FormData();
            formData.append('photo', blob, 'face.jpg');
            await api.post(`/api/friends/${newId}/photos`, formData);
          }
        }
        onSave && onSave({ name: name.trim(), friendId: newId });
      }
      onClose();
    } catch (err) {
      setErrors({ general: err.response?.data?.error || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleLink() {
    if (!linkEmail.trim()) return;
    setLinking(true); setLinkError(null);
    try {
      const res = await api.patch(`/api/friends/${friend.Friend_Id}/link`, { email: linkEmail.trim() });
      setLinkedUserName(res.data.linkedUserName);
      setLinkedUserEmail(res.data.linkedUserEmail);
      setLinkEmail('');
    } catch (err) {
      setLinkError(err.response?.data?.error || 'Link failed');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setLinking(true); setLinkError(null);
    try {
      await api.patch(`/api/friends/${friend.Friend_Id}/unlink`);
      setLinkedUserName(null); setLinkedUserEmail(null);
    } catch (err) {
      setLinkError(err.response?.data?.error || 'Unlink failed');
    } finally {
      setLinking(false);
    }
  }

  function handleCloseRequest() {
    if (isDirty.current && (name !== (friend?.Name_Txt || '') || note !== (friend?.Note_Multi_Line_Txt || '') || group !== (friend?.Friend_Group || 'Friend'))) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }

  function resizeImage(file, maxW = 1280, quality = 0.82) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const blob = await resizeImage(file);
    if (!friend?.Friend_Id) {
      if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
      setPendingPhoto(blob);
      setPendingPhotoUrl(URL.createObjectURL(blob));
      setErrors(prev => ({ ...prev, photo: undefined }));
      return;
    }
    const formData = new FormData();
    formData.append('photo', blob, 'photo.jpg');
    try {
      await api.post(`/api/friends/${friend.Friend_Id}/photos`, formData);
      await loadPhotos(friend.Friend_Id);
    } catch {
      setErrors({ photo: 'Failed to upload photo' });
    }
  }

  async function handleDeletePhoto() {
    if (!friend?.Friend_Id || photos.length === 0) return;
    const photo = photos[photoIndex];
    try {
      await api.delete(`/api/friends/${friend.Friend_Id}/photos/${photo.Friend_Photo_Id}`);
      await loadPhotos(friend.Friend_Id);
      setPhotoIndex(Math.max(0, photoIndex - 1));
    } catch {
      setErrors({ photo: 'Failed to delete photo' });
    }
  }

  async function handleDelete() {
    if (!friend?.Friend_Id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/friends/${friend.Friend_Id}`);
      onDelete && onDelete();
      onClose();
    } catch (err) {
      setErrors({ general: err.response?.data?.error || 'Delete failed' });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const storedPhotoUrl = friend?.Friend_Id && photos[photoIndex]
    ? `/api/friends/${friend.Friend_Id}/photos/${photos[photoIndex].Friend_Photo_Id}/data`
    : null;
  const photoUrl = storedPhotoUrl || pendingPhotoUrl || capturedPhotoUrl || null;

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl w-full flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-lg">
          {friend?.Friend_Id ? 'Edit Friend' : 'Add Friend'}
        </h2>
        <button onClick={handleCloseRequest} className="text-gray-400 hover:text-white">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Photo wallet */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-32 rounded-lg bg-gray-700 overflow-hidden border-2 border-gray-600 flex items-center justify-center">
            {loading ? (
              <span className="text-gray-400 text-sm">Loading...</span>
            ) : photoUrl ? (
              <AuthImage src={photoUrl} alt="Friend" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 text-4xl">👤</span>
            )}
          </div>

          {photos.length > 1 && (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <button onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))} disabled={photoIndex === 0} className="disabled:opacity-40 hover:text-white">◀</button>
              <span>{photoIndex + 1} / {photos.length}</span>
              <button onClick={() => setPhotoIndex(Math.min(photos.length - 1, photoIndex + 1))} disabled={photoIndex === photos.length - 1} className="disabled:opacity-40 hover:text-white">▶</button>
            </div>
          )}

          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
              <UploadIcon className="w-4 h-4" /> Upload
            </button>
            {(photos.length > 0 || pendingPhoto) && (
              <button
                onClick={() => {
                  if (pendingPhoto) { URL.revokeObjectURL(pendingPhotoUrl); setPendingPhoto(null); setPendingPhotoUrl(null); }
                  else handleDeletePhoto();
                }}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
              >
                <XIcon className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
          {errors.photo && <p className="text-red-400 text-xs">{errors.photo}</p>}
        </div>

        {/* Name */}
        <div>
          <label className="text-gray-300 text-sm block mb-1">Name <span className="text-red-400">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={50}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Friend's name (max 50 chars)" />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Note */}
        <div>
          <label className="text-gray-300 text-sm block mb-1">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Optional notes about this friend" />
        </div>

        {/* Group */}
        <div>
          <label className="text-gray-300 text-sm block mb-1">Group <span className="text-red-400">*</span></label>
          <select value={group} onChange={e => setGroup(e.target.value)}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.group && <p className="text-red-400 text-xs mt-1">{errors.group}</p>}
        </div>

        {/* CrowdView Account Link */}
        {friend?.Friend_Id && (
          <div>
            <label className="text-gray-300 text-sm block mb-1">CrowdView Account</label>
            {linkedUserName ? (
              <div className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2">
                <div>
                  <p className="text-green-400 text-sm font-medium">{linkedUserName}</p>
                  <p className="text-gray-500 text-xs">{linkedUserEmail}</p>
                </div>
                <button onClick={handleUnlink} disabled={linking} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40">Unlink</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="email" value={linkEmail} onChange={e => { setLinkEmail(e.target.value); setLinkError(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleLink()}
                  placeholder="Their CrowdView email"
                  className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                <button onClick={handleLink} disabled={linking || !linkEmail.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
                  {linking ? '...' : 'Link'}
                </button>
              </div>
            )}
            {linkError && <p className="text-red-400 text-xs mt-1">{linkError}</p>}
          </div>
        )}

        {errors.general && <p className="text-red-400 text-sm">{errors.general}</p>}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
        {friend?.Friend_Id && (
          <button onClick={() => setConfirmDelete(true)}
            className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-colors" title="Delete friend">
            <DeleteIcon className="w-5 h-5" />
          </button>
        )}
        <button onClick={handleCloseRequest} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40">
          {saving ? 'Saving...' : friend?.Friend_Id ? 'Update' : 'Save'}
        </button>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete {friend?.Name_Txt}?</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the friend and all their photos.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm disabled:opacity-40">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dirty confirm */}
      {confirmClose && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white mb-4">You'll lose unsaved changes. Continue?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClose(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Keep Editing</button>
              <button onClick={() => { setConfirmClose(false); onClose(); }} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
