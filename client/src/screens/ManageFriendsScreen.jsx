import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import { MovieCameraIcon, PlusIcon } from '../components/Icons';
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
    setSelectedFriend(null);
    setIsNew(true);
    setShowForm(true);
  }

  function handleFriendClick(friend) {
    setSelectedFriend(friend);
    setIsNew(false);
    setShowForm(true);
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} title="Camera" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-5 h-5" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={
          <button onClick={handleAddNew} title="Add Friend" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <PlusIcon className="w-5 h-5" />
          </button>
        }
      />

      {/* Main container */}
      <main className="flex-1 flex flex-col items-center px-4 py-4 overflow-hidden">
        <div className="w-full max-w-2xl flex flex-col flex-1 gap-3">
          {/* Group filter */}
          <select
            value={group}
            onChange={e => setGroup(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* Friends list with A-Z index */}
          <div className="flex gap-2 flex-1 overflow-hidden">
            {/* A-Z index */}
            <div className="flex flex-col justify-between py-1 text-xs text-gray-500">
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
            <div className="flex-1 overflow-y-auto space-y-1">
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
                    <div className="sticky top-0 bg-gray-900 text-blue-400 text-xs font-bold px-2 py-1">
                      {letter}
                    </div>
                    {letterFriends.map(friend => (
                      <button
                        key={friend.Friend_Id}
                        onClick={() => handleFriendClick(friend)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg text-left transition-colors"
                      >
                        {/* Photo wallet */}
                        <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {friend.Primary_Photo_Mime ? (
                            <img
                              src={`/api/friends/${friend.Friend_Id}/photos/primary/data`}
                              alt={friend.Name_Txt}
                              className="w-full h-full object-cover"
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-gray-500 text-lg">👤</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{friend.Name_Txt}</p>
                          {friend.Note_Multi_Line_Txt && (
                            <p className="text-gray-500 text-xs truncate">{friend.Note_Multi_Line_Txt}</p>
                          )}
                        </div>
                        <span className="text-gray-600 text-xs flex-shrink-0">{friend.Friend_Group}</span>
                        <span className="text-gray-600">›</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <NavBar />
      <TrueFooter />

      {showForm && (
        <FriendFormPopup
          friend={isNew ? null : selectedFriend}
          onClose={() => setShowForm(false)}
          onSave={loadFriends}
        />
      )}
    </div>
  );
}
