import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import { MovieCameraIcon, PlusIcon, DeleteIcon } from '../components/Icons';
import AuthImage from '../components/AuthImage';
import api from '../api/api';

const GROUPS = ['All', 'Friend', 'Family', 'Friend of Friend', 'Friend of Family', 'Business'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function ManageFriendsScreen() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [group, setGroup] = useState('All');
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deletingFriend, setDeletingFriend] = useState(null);
  const [capturedFaceUrl, setCapturedFaceUrl] = useState(null);
  const fileInputRef = useRef(null);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const params = group !== 'All' ? { group } : {};
      const res = await api.get('/api/friends', { params });
      setFriends(res.data);
    } catch (err) {
      console.error('Failed to load friends', err);
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  function handleAddNew() {
    // Trigger photo upload to identify faces
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const imageDataUrl = await new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = url;
    });

    // Save to library (non-blocking)
    const blob = await fetch(imageDataUrl).then(r => r.blob());
    const formData = new FormData();
    formData.append('media', blob, 'photo.jpg');
    api.post('/api/media', formData).catch(() => {});

    navigate('/id', { state: { photoDataUrl: imageDataUrl } });
  }

  function handleFormClose() {
    setShowForm(false);
    setCapturedFaceUrl(null);
  }

  function handleFriendClick(friend) {
    setSelectedFriend(friend);
    setIsNew(false);
    setShowForm(true);
  }

  async function confirmDeleteFriend() {
    if (!deletingFriend) return;
    try {
      await api.delete(`/api/friends/${deletingFriend.Friend_Id}`);
      setDeletingFriend(null);
      loadFriends();
    } catch (err) {
      console.error('Delete failed', err);
    }
  }

  function scrollToLetter(letter) {
    const el = document.getElementById(`letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Group friends by first letter
  const grouped = ALPHABET.reduce((acc, letter) => {
    const matches = friends.filter(f => f.Name_Txt.toUpperCase().startsWith(letter));
    if (matches.length) acc[letter] = matches;
    return acc;
  }, {});

  return (
    <div className="bg-slate-700 min-h-screen flex flex-col">
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} title="Camera" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={
          <button onClick={handleAddNew} title="Add Friend" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <PlusIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Main container */}
      <main className="flex-1 flex flex-col items-center px-4 py-4">
        <div className="w-full max-w-2xl flex flex-col gap-3 bg-gray-900 rounded-lg p-3">
          {/* Group filter */}
          <select
            value={group}
            onChange={e => setGroup(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* Friends list with A-Z index */}
          <div className="flex gap-2">
            {/* A-Z index */}
            <div className="flex flex-col gap-0.5 py-1 text-xs text-gray-500">
              {ALPHABET.map(letter => (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  className={`hover:text-white leading-none ${grouped[letter] ? 'text-gray-300' : ''}`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Friend list */}
            <div className="flex-1 space-y-1 bg-gray-900 rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                  <p>No friends found</p>
                  <button onClick={handleAddNew} className="text-blue-400 hover:text-blue-300 text-sm underline">
                    Add your first friend
                  </button>
                </div>
              ) : (
                Object.entries(grouped).map(([letter, letterFriends]) => (
                  <div key={letter} id={`letter-${letter}`}>
                    <div className="bg-gray-900 text-blue-400 text-xs font-bold px-2 py-1">
                      {letter}
                    </div>
                    {letterFriends.map(friend => (
                      <div key={friend.Friend_Id} className="flex items-center gap-1 rounded-lg hover:bg-gray-800 transition-colors">
                        <button
                          onClick={() => handleFriendClick(friend)}
                          className="flex-1 flex items-center gap-3 p-3 text-left"
                        >
                          <div className="w-[60px] h-[60px] rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {friend.Primary_Photo_Mime ? (
                              <AuthImage
                                src={`/api/friends/${friend.Friend_Id}/photos/primary/data`}
                                alt={friend.Name_Txt}
                                className="w-full h-full object-cover"
                                fallback={<span className="text-gray-500 text-[27px]">👤</span>}
                                lazy
                                maxPx={120}
                              />
                            ) : (
                              <span className="text-gray-500 text-[27px]">👤</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-medium truncate">{friend.Name_Txt}</p>
                              {friend.Linked_User_Name && (
                                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-600/40">linked</span>
                              )}
                            </div>
                            {friend.Note_Multi_Line_Txt && (
                              <p className="text-gray-500 text-xs truncate">{friend.Note_Multi_Line_Txt}</p>
                            )}
                          </div>
                          <span className="text-gray-600 text-xs flex-shrink-0">{friend.Friend_Group}</span>
                          <span className="text-gray-600">›</span>
                        </button>
                        <button
                          onClick={() => setDeletingFriend(friend)}
                          className="p-3 text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0"
                          title="Delete friend"
                        >
                          <DeleteIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <TrueFooter />
      <NavBar />

      {showForm && (
        <FriendFormPopup
          friend={isNew ? null : selectedFriend}
          capturedPhotoUrl={capturedFaceUrl}
          onClose={handleFormClose}
          onSave={loadFriends}
          onDelete={() => { setShowForm(false); setCapturedFaceUrl(null); loadFriends(); }}
        />
      )}

      {deletingFriend && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete {deletingFriend.Name_Txt}?</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the friend and all their photos. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingFriend(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFriend}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
