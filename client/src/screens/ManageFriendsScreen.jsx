import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import FriendFormPopup from '../components/FriendFormPopup';
import { MovieCameraIcon, PlusIcon, DeleteIcon, XIcon, SettingsIcon } from '../components/Icons';
import AuthImage from '../components/AuthImage';
import api from '../api/api';

const GROUPS = ['All', 'Friend', 'Family', 'Friend of Friend', 'Friend of Family', 'Business'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function ManageFriendsScreen() {
  const navigate = useNavigate();
  const { isCorporate, isBackOffice } = useApp();
  const noun = isCorporate ? 'customer' : 'friend';
  const Noun = isCorporate ? 'Customer' : 'Friend';

  const [activeTab, setActiveTab] = useState('customers');

  // Customers tab
  const [friends, setFriends] = useState([]);
  const [group, setGroup] = useState('All');
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [deletingFriend, setDeletingFriend] = useState(null);
  const [capturedFaceUrl, setCapturedFaceUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Tiers
  const [tiers, setTiers]             = useState([]);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTierName, setEditingTierName] = useState({});
  const [tierSaving, setTierSaving]   = useState(null);

  // Dashboard tab
  const [dashData, setDashData]       = useState([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Drilldown level 1 — dates
  const [drilldownFriend, setDrilldownFriend]   = useState(null);
  const [drilldownDates, setDrilldownDates]     = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Drilldown level 2 — individual detections
  const [detectionDate, setDetectionDate]       = useState(null);
  const [detections, setDetections]             = useState([]);
  const [detectionLoading, setDetectionLoading] = useState(false);

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

  const loadTiers = useCallback(async () => {
    if (!isCorporate) return;
    try {
      const res = await api.get('/api/corporate/tiers');
      setTiers(res.data);
      setEditingTierName(Object.fromEntries(res.data.map(t => [t.tierId, t.name])));
    } catch (err) { console.error(err); }
  }, [isCorporate]);

  const loadDashboard = useCallback(async () => {
    if (!isCorporate) return;
    setDashLoading(true);
    try {
      const res = await api.get('/api/corporate/friends/dashboard');
      setDashData(res.data);
    } catch (err) { console.error(err); }
    finally { setDashLoading(false); }
  }, [isCorporate]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { if (activeTab === 'dashboard') loadDashboard(); }, [activeTab, loadDashboard]);
  useEffect(() => { loadTiers(); }, [loadTiers]);

  async function openDrilldown(friend) {
    setDrilldownFriend(friend); setDrilldownLoading(true);
    try {
      const res = await api.get(`/api/corporate/friends/${friend.friendId}/attendance`);
      setDrilldownDates(res.data);
    } catch (err) { console.error(err); }
    finally { setDrilldownLoading(false); }
  }

  async function openDetections(friendId, date, label) {
    setDetectionDate({ date, label }); setDetectionLoading(true);
    try {
      const res = await api.get(`/api/corporate/friends/${friendId}/attendance/${date}`);
      setDetections(res.data);
    } catch (err) { console.error(err); }
    finally { setDetectionLoading(false); }
  }

  async function saveTierName(tierId) {
    const name = editingTierName[tierId]?.trim();
    if (!name) return;
    setTierSaving(tierId);
    try {
      await api.put(`/api/corporate/tiers/${tierId}`, { name });
      await loadTiers();
    } catch (err) { console.error(err); }
    finally { setTierSaving(null); }
  }

  function handleAddNew() { fileInputRef.current?.click(); }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const imageDataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const maxW = 1280;
          const scale = Math.min(1, maxW / img.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    const blob = await fetch(imageDataUrl).then(r => r.blob());
    const formData = new FormData();
    formData.append('media', blob, 'photo.jpg');
    api.post('/api/media', formData).catch(() => {});
    navigate('/id', { state: { photoDataUrl: imageDataUrl } });
  }

  function handleFormClose() { setShowForm(false); setCapturedFaceUrl(null); }
  function handleFriendClick(friend) { setSelectedFriend(friend); setIsNew(false); setShowForm(true); }

  async function confirmDeleteFriend() {
    if (!deletingFriend) return;
    try {
      await api.delete(`/api/friends/${deletingFriend.Friend_Id}`);
      setDeletingFriend(null);
      loadFriends();
    } catch (err) { console.error('Delete failed', err); }
  }

  function scrollToLetter(letter) {
    const el = document.getElementById(`letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const grouped = ALPHABET.reduce((acc, letter) => {
    const matches = friends.filter(f => f.Name_Txt.toUpperCase().startsWith(letter));
    if (matches.length) acc[letter] = matches;
    return acc;
  }, {});

  return (
    <div className="bg-slate-700 min-h-screen flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

      <AppHeader
        left={
          !isBackOffice && (
            <button onClick={() => navigate('/hub')} title="Camera" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
              <MovieCameraIcon className="w-[30px] h-[30px]" />
            </button>
          )
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight">{isCorporate ? <><div>CrowdView</div><div>Corporate</div></> : 'CrowdView'}</span>}
        right={
          <div className="flex items-center gap-1">
            {isCorporate && (
              <button onClick={() => setShowTierModal(true)} title="Manage Tiers" className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
                <SettingsIcon className="w-[26px] h-[26px]" />
              </button>
            )}
            {activeTab === 'customers' && (
              <button onClick={handleAddNew} title={`Add ${Noun}`} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
                <PlusIcon className="w-[30px] h-[30px]" />
              </button>
            )}
          </div>
        }
      />

      {/* Full-width tab bar — corporate only */}
      {isCorporate && (
        <div className="flex border-b border-gray-700 bg-gray-800">
          {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'customers', label: `${Noun}s` }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${activeTab === t.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 flex flex-col items-center px-4 py-4 pb-32">

        {/* ── Dashboard tab ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="w-full max-w-2xl">
            {dashLoading ? (
              <div className="flex justify-center mt-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
            ) : dashData.length === 0 ? (
              <p className="text-center text-gray-500 text-sm mt-12">No detection data yet</p>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-gray-400 text-xs font-medium">Customer</span>
                  <span className="text-gray-400 text-xs font-medium text-center">Week</span>
                  <span className="text-gray-400 text-xs font-medium text-center">Month</span>
                  <span className="text-gray-400 text-xs font-medium text-center">Year</span>
                </div>
                {dashData.map(f => (
                  <button key={f.friendId} onClick={() => openDrilldown(f)}
                    className="w-full grid grid-cols-4 gap-2 px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-white text-sm">{f.friendName}</p>
                    </div>
                    <span className="text-gray-300 text-sm text-center self-center">{f.weekCount}</span>
                    <span className="text-gray-300 text-sm text-center self-center">{f.monthCount}</span>
                    <span className="text-gray-300 text-sm text-center self-center">{f.yearCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Customers tab ─────────────────────────────────────────────── */}
        {activeTab === 'customers' && (
          <div className="w-full max-w-2xl flex flex-col gap-3">
            {!isCorporate && (
              <select value={group} onChange={e => setGroup(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            <div className="flex gap-2">
              <div className="flex flex-col gap-0.5 py-1 text-xs text-gray-500">
                {ALPHABET.map(letter => (
                  <button key={letter} onClick={() => scrollToLetter(letter)}
                    className={`hover:text-white leading-none ${grouped[letter] ? 'text-gray-300' : ''}`}>
                    {letter}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-1 bg-gray-900 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                    <p>No {noun}s found</p>
                    <button onClick={handleAddNew} className="text-blue-400 hover:text-blue-300 text-sm underline">
                      Add your first {noun}
                    </button>
                  </div>
                ) : (
                  Object.entries(grouped).map(([letter, letterFriends]) => (
                    <div key={letter} id={`letter-${letter}`}>
                      <div className="bg-gray-900 text-blue-400 text-xs font-bold px-2 py-1">{letter}</div>
                      {letterFriends.map(friend => (
                        <div key={friend.Friend_Id} className="flex items-center gap-1 rounded-lg hover:bg-gray-800 transition-colors">
                          <button onClick={() => handleFriendClick(friend)}
                            className="flex-1 flex items-center gap-3 p-3 text-left">
                            <div className="w-[60px] h-[60px] rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {friend.Primary_Photo_Mime ? (
                                <AuthImage src={`/api/friends/${friend.Friend_Id}/photos/primary/data`}
                                  alt={friend.Name_Txt} className="w-full h-full object-cover"
                                  fallback={<span className="text-gray-500 text-[27px]">👤</span>} lazy maxPx={120} />
                              ) : (
                                <span className="text-gray-500 text-[27px]">👤</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white text-sm font-medium truncate">{friend.Name_Txt}</p>
                                {friend.Tier_Name && (
                                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{ backgroundColor: friend.Tier_Color + '33', color: friend.Tier_Color, border: `1px solid ${friend.Tier_Color}66` }}>
                                    {friend.Tier_Name}
                                  </span>
                                )}
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
                          <button onClick={() => setDeletingFriend(friend)}
                            className="p-3 text-red-400/50 hover:text-red-400 transition-colors flex-shrink-0"
                            title={`Delete ${noun}`}>
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
        )}
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
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the {noun} and all their photos. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingFriend(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={confirmDeleteFriend}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Drilldown level 1 — dates */}
      {drilldownFriend && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div>
                <p className="text-white font-semibold text-sm">{drilldownFriend.friendName}</p>
                <p className="text-gray-500 text-xs">Detection history — click a date for details</p>
              </div>
              <button onClick={() => setDrilldownFriend(null)} className="text-gray-400 hover:text-white">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-80 divide-y divide-gray-700">
              {drilldownLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" /></div>
              ) : drilldownDates.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No detections recorded yet</p>
              ) : (
                drilldownDates.map((row, i) => {
                  const label = new Date(row.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  return (
                    <button key={i} onClick={() => openDetections(drilldownFriend.friendId, row.date, label)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-700 text-left">
                      <p className="text-white text-sm">{label}</p>
                      <span className="text-gray-400 text-xs ml-3 shrink-0">{row.count} detection{row.count !== 1 ? 's' : ''} ›</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tier management modal */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <p className="text-white font-semibold text-sm">Customer Tiers</p>
              <button onClick={() => setShowTierModal(false)} className="text-gray-400 hover:text-white">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-gray-700 overflow-y-auto max-h-96">
              {tiers.map(t => (
                <div key={t.tierId} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <input
                    value={editingTierName[t.tierId] ?? t.name}
                    onChange={e => setEditingTierName(prev => ({ ...prev, [t.tierId]: e.target.value }))}
                    onBlur={() => saveTierName(t.tierId)}
                    onKeyDown={e => e.key === 'Enter' && saveTierName(t.tierId)}
                    className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 border border-gray-600"
                  />
                  {tierSaving === t.tierId && <span className="text-gray-500 text-xs">saving…</span>}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-700 text-gray-500 text-xs">
              Edit a tier name and press Enter or click away to save. Colors are fixed.
            </div>
          </div>
        </div>
      )}

      {/* Drilldown level 2 — individual detections */}
      {detectionDate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div>
                <p className="text-white font-semibold text-sm">{detectionDate.label}</p>
                <p className="text-gray-500 text-xs">Individual detections</p>
              </div>
              <button onClick={() => setDetectionDate(null)} className="text-gray-400 hover:text-white">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-80 divide-y divide-gray-700">
              {detectionLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" /></div>
              ) : detections.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No detail records found</p>
              ) : (
                detections.map((d, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between">
                    <p className="text-white text-sm">{new Date(d.detectedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                    <p className="text-gray-400 text-xs">{d.detectedBy}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
