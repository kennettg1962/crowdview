import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { MovieCameraIcon, FriendsIcon, DeleteIcon } from '../components/Icons';
import api from '../api/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function groupMedia(items) {
  const groups = {};
  items.forEach(item => {
    const d = new Date(item.Created_At);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = { year: d.getFullYear(), month: d.getMonth(), items: [] };
    groups[key].items.push(item);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function LibraryScreen() {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | year | month
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/media');
      setMedia(res.data);
    } catch (err) {
      console.error('Failed to load media', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => api.delete(`/api/media/${id}`)));
      setSelectedIds(new Set());
      setConfirmDelete(false);
      await loadMedia();
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(false);
    }
  }

  // Get unique years for filter
  const years = [...new Set(media.map(m => new Date(m.Created_At).getFullYear()))].sort((a, b) => b - a);

  const filteredMedia = media.filter(m => {
    const d = new Date(m.Created_At);
    if (filter === 'all') return true;
    if (typeof filter === 'number') return d.getFullYear() === filter;
    return true;
  });

  const grouped = groupMedia(filteredMedia);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide">CrowdView</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Filter row */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All
          </button>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setFilter(year)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${filter === year ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {year}
            </button>
          ))}
        </div>
        <button
          onClick={() => selectedIds.size > 0 && setConfirmDelete(true)}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
        >
          <DeleteIcon className="w-6 h-6" />
          <span>Delete ({selectedIds.size})</span>
        </button>
      </div>

      {/* Media grid */}
      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center mt-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
            <p>No media in your library</p>
            <p className="text-sm">Capture photos or videos from the streaming hub</p>
          </div>
        ) : (
          grouped.map(([key, group]) => (
            <div key={key} className="mb-6">
              <h3 className="text-gray-400 text-sm font-medium mb-3 sticky top-0 bg-gray-900 py-1">
                {MONTHS[group.month]} {group.year}
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {group.items.map(item => {
                  const selected = selectedIds.has(item.User_Media_Id);
                  return (
                    <button
                      key={item.User_Media_Id}
                      onClick={() => toggleSelect(item.User_Media_Id)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        selected ? 'border-blue-500 scale-95' : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      {item.Media_Type === 'video' ? (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                          <span className="text-2xl">🎬</span>
                        </div>
                      ) : (
                        <img
                          src={`/api/media/${item.User_Media_Id}/data`}
                          alt="Media"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      <NavBar />
      <TrueFooter />

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white mb-2">Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?</p>
            <p className="text-gray-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
