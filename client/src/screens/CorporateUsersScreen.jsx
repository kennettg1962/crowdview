import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import CorporateUserForm from '../components/CorporateUserForm';
import { HomeIcon, PlusIcon, DeleteIcon } from '../components/Icons';
import api from '../api/api';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function CorporateUsersScreen() {
  const navigate = useNavigate();
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [isNew, setIsNew]               = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/corporate/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load org users', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function handleAddNew() {
    setSelectedUser(null);
    setIsNew(true);
    setShowForm(true);
  }

  function handleUserClick(user) {
    setSelectedUser(user);
    setIsNew(false);
    setShowForm(true);
  }

  async function confirmDelete() {
    if (!deletingUser) return;
    try {
      await api.delete(`/api/corporate/users/${deletingUser.User_Id}`);
      setDeletingUser(null);
      loadUsers();
    } catch (err) {
      console.error('Delete failed', err);
    }
  }

  function scrollToLetter(letter) {
    const el = document.getElementById(`ul-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const grouped = ALPHABET.reduce((acc, letter) => {
    const matches = users.filter(u => (u.Name_Txt || u.Email).toUpperCase().startsWith(letter));
    if (matches.length) acc[letter] = matches;
    return acc;
  }, {});

  return (
    <div className="bg-slate-700 min-h-screen flex flex-col">
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} title="Hub" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <HomeIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight"><div>CrowdView</div><div>Corporate</div></span>}
        right={
          <button onClick={handleAddNew} title="Add User" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <PlusIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {[
          { label: 'Dashboard', path: '/corporate/dashboard' },
          { label: 'Users',     path: '/corporate/users'     },
        ].map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${t.path === '/corporate/users'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col items-center px-4 py-4">
        <div className="w-full max-w-2xl flex flex-col gap-3 bg-gray-900 rounded-lg p-3">

          {/* User list with A-Z index */}
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

            {/* User list */}
            <div className="flex-1 space-y-1 bg-gray-900 rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                  <p>No users found</p>
                  <button onClick={handleAddNew} className="text-blue-400 hover:text-blue-300 text-sm underline">
                    Add your first user
                  </button>
                </div>
              ) : (
                Object.entries(grouped).map(([letter, letterUsers]) => (
                  <div key={letter} id={`ul-${letter}`}>
                    <div className="bg-gray-900 text-blue-400 text-xs font-bold px-2 py-1">{letter}</div>
                    {letterUsers.map(u => (
                      <div key={u.User_Id} className="flex items-center gap-1 rounded-lg hover:bg-gray-800 transition-colors">
                        <button
                          onClick={() => handleUserClick(u)}
                          className="flex-1 flex items-center gap-3 p-3 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-medium truncate">{u.Name_Txt || '—'}</p>
                              {u.Corporate_Admin_Fl === 'Y' && (
                                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-400 border border-amber-600/40">admin</span>
                              )}
                              {u.Corporate_Admin_Fl === 'B' && (
                                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-400 border border-purple-600/40">back office</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs truncate">{u.Email}</p>
                          </div>
                          <span className="text-gray-600">›</span>
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="p-3 text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0"
                          title="Delete user"
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
        <CorporateUserForm
          user={isNew ? null : selectedUser}
          onClose={() => setShowForm(false)}
          onSave={loadUsers}
        />
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete {deletingUser.Name_Txt || deletingUser.Email}?</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the user and all their data. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingUser(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
