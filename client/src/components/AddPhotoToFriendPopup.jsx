import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { XIcon } from './Icons';
import AuthImage from './AuthImage';

export default function AddPhotoToFriendPopup({ faceCrop, onClose, onSave }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/friends')
      .then(res => setFriends(res.data || []))
      .catch(() => setError('Failed to load friends'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = friends.filter(f =>
    f.Name_Txt.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSelect(friend) {
    setSaving(true);
    setError(null);
    try {
      const blob = await fetch(faceCrop).then(r => r.blob());
      const formData = new FormData();
      formData.append('photo', blob, 'face.jpg');
      await api.post(`/api/friends/${friend.Friend_Id}/photos`, formData);
      const tier = friend.Tier_Color ? { color: friend.Tier_Color, name: friend.Tier_Name } : null;
      onSave({ friendId: friend.Friend_Id, name: friend.Name_Txt, group: friend.Friend_Group, tier });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add photo');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-lg">Add photo to friend</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          {/* Face crop preview */}
          <div className="flex justify-center mb-3">
            <img src={faceCrop} alt="Face" className="w-20 h-20 rounded-lg object-cover border-2 border-gray-600" />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search friends..."
            autoFocus
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
          {loading && <p className="text-gray-400 text-sm text-center py-4">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No friends found</p>
          )}
          {filtered.map(friend => (
            <button
              key={friend.Friend_Id}
              onClick={() => handleSelect(friend)}
              disabled={saving}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden flex-shrink-0 flex items-center justify-center">
                <AuthImage
                  src={`/api/friends/${friend.Friend_Id}/photos/primary/data`}
                  alt={friend.Name_Txt}
                  className="w-full h-full object-cover"
                  fallback={<span className="text-gray-400 text-lg">👤</span>}
                />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{friend.Name_Txt}</p>
                {friend.Friend_Group && (
                  <p className="text-gray-400 text-xs truncate">{friend.Friend_Group}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-xs px-5 pb-3">{error}</p>}
      </div>
    </div>
  );
}
