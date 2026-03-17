import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { MovieCameraIcon, FriendsIcon, DeleteIcon } from '../components/Icons';
import AuthImage from '../components/AuthImage';
import api from '../api/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function VideoThumbnail({ mediaId, className }) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get(`/api/media/${mediaId}/data`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(res.data);
        blobUrlRef.current = blobUrl;
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = blobUrl;
        video.currentTime = 0.1;
        video.onseeked = () => {
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbUrl(canvas.toDataURL('image/jpeg'));
          video.src = '';
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [visible, mediaId]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {thumbUrl ? (
        <img src={thumbUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-800" />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-5xl opacity-80 drop-shadow">▶</span>
      </div>
    </div>
  );
}

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

function MediaViewer({ item, allItems, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [currentItem, setCurrentItem] = useState(item);
  const urlRef = useRef(null);

  useEffect(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    setBlobUrl(null);
    api.get(`/api/media/${currentItem.User_Media_Id}/data`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data);
        urlRef.current = url;
        setBlobUrl(url);
      })
      .catch(console.error);
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [currentItem.User_Media_Id]);

  const currentIndex = allItems.findIndex(i => i.User_Media_Id === currentItem.User_Media_Id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allItems.length - 1;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) setCurrentItem(allItems[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) setCurrentItem(allItems[currentIndex + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, hasPrev, hasNext, allItems, onClose]);

  const d = new Date(currentItem.Created_At);
  const dateStr = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50" onClick={onClose}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-gray-300 text-sm">{dateStr} · {currentItem.Media_Type === 'video' ? 'Video' : 'Photo'}</span>
        <button
          onClick={onClose}
          className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {/* Media */}
      <div className="relative w-full max-w-4xl px-4 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {/* Prev */}
        <button
          onClick={() => hasPrev && setCurrentItem(allItems[currentIndex - 1])}
          disabled={!hasPrev}
          className="absolute left-0 z-10 w-10 h-10 flex items-center justify-center text-white text-xl bg-black/40 hover:bg-black/70 rounded-full ml-2 disabled:opacity-20"
        >
          ◀
        </button>

        {!blobUrl ? (
          <div className="flex justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
          </div>
        ) : currentItem.Media_Type === 'video' ? (
          <video
            key={blobUrl}
            src={blobUrl}
            controls
            autoPlay
            className="w-full max-h-[80vh] rounded-xl"
          />
        ) : (
          <img src={blobUrl} alt="Media" className="w-full max-h-[80vh] object-contain rounded-xl" />
        )}

        {/* Next */}
        <button
          onClick={() => hasNext && setCurrentItem(allItems[currentIndex + 1])}
          disabled={!hasNext}
          className="absolute right-0 z-10 w-10 h-10 flex items-center justify-center text-white text-xl bg-black/40 hover:bg-black/70 rounded-full mr-2 disabled:opacity-20"
        >
          ▶
        </button>
      </div>

      {/* Counter */}
      <div className="absolute bottom-24 text-gray-400 text-sm">
        {currentIndex + 1} / {allItems.length}
      </div>
    </div>
  );
}

export default function LibraryScreen() {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
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

  function handleItemClick(item) {
    const id = item.User_Media_Id;
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

  function getItemFilename(item) {
    const ext = item.Media_Mime_Type === 'image/jpeg' ? 'jpg'
      : item.Media_Mime_Type === 'image/png' ? 'png'
      : item.Media_Mime_Type?.startsWith('video/') ? 'webm'
      : 'bin';
    const d = new Date(item.Created_At);
    return `crowdview-${item.Media_Type}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${item.User_Media_Id}.${ext}`;
  }

  async function handleExport() {
    const selectedItems = filteredMedia.filter(m => selectedIds.has(m.User_Media_Id));
    const supportsFilePicker = !!window.showSaveFilePicker;
    const supportsDirPicker  = !!window.showDirectoryPicker;

    try {
      if (supportsFilePicker) {
        // Prompt save dialog for each file
        for (const item of selectedItems) {
          const ext = getItemFilename(item).split('.').pop();
          const mimeType = item.Media_Mime_Type || (ext === 'webm' ? 'video/webm' : 'image/jpeg');
          const handle = await window.showSaveFilePicker({
            suggestedName: getItemFilename(item),
            types: [{ description: 'Media file', accept: { [mimeType]: [`.${ext}`] } }],
          });
          const res = await api.get(`/api/media/${item.User_Media_Id}/data`, { responseType: 'blob' });
          const writable = await handle.createWritable();
          await writable.write(res.data);
          await writable.close();
        }
      } else {
        // Fallback for browsers without File System Access API
        for (const item of selectedItems) {
          const res = await api.get(`/api/media/${item.User_Media_Id}/data`, { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          const a = document.createElement('a');
          a.href = url;
          a.download = getItemFilename(item);
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Export failed', err);
    }
  }

  const years = [...new Set(media.map(m => new Date(m.Created_At).getFullYear()))].sort((a, b) => b - a);

  const filteredMedia = media.filter(m => {
    if (filter === 'all') return true;
    if (typeof filter === 'number') return new Date(m.Created_At).getFullYear() === filter;
    return true;
  });

  const grouped = groupMedia(filteredMedia);
  const singleSelected = selectedIds.size === 1
    ? filteredMedia.find(m => m.User_Media_Id === [...selectedIds][0])
    : null;
  const singlePhotoSelected = singleSelected?.Media_Type === 'photo' ? singleSelected : null;

  async function handleId() {
    if (!singlePhotoSelected) return;
    try {
      const res = await api.get(`/api/media/${singlePhotoSelected.User_Media_Id}/data`, { responseType: 'blob' });
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(res.data);
      });
      navigate('/id', { state: { photoDataUrl: dataUrl } });
    } catch (err) {
      console.error('Failed to load photo for Id', err);
    }
  }

  return (
    <div className="bg-gray-900 min-h-screen">
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

      {/* Filter / action row — two rows on mobile, single row on desktop */}
      <div className="bg-gray-800 px-4 pt-2 pb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Year filters */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            All
          </button>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setFilter(year)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${filter === year ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {year}
            </button>
          ))}
        </div>

        {/* Action buttons — 4-col grid on mobile, inline flex on desktop */}
        <div className="grid grid-cols-4 md:flex md:items-center gap-2 md:flex-shrink-0">
          <button
            onClick={handleId}
            disabled={!singlePhotoSelected}
            className="flex items-center justify-center h-9 md:h-8 md:w-[110px] bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
          >
            Id
          </button>
          <button
            onClick={() => singleSelected && setViewingItem(singleSelected)}
            disabled={!singleSelected}
            className="flex items-center justify-center h-9 md:h-8 md:w-[110px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
          >
            View
          </button>
          <button
            onClick={handleExport}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center h-9 md:h-8 md:w-[110px] bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => selectedIds.size > 0 && setConfirmDelete(true)}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center gap-1 h-9 md:h-8 md:w-[110px] bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm disabled:opacity-40 transition-colors"
          >
            <DeleteIcon className="w-4 h-4" />
            <span className="md:hidden">({selectedIds.size})</span>
            <span className="hidden md:inline">Delete ({selectedIds.size})</span>
          </button>
        </div>
      </div>

      {/* Media grid */}
      <main className="p-4">
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
              <h3 className="text-gray-400 text-sm font-medium mb-3 bg-gray-900 py-1">
                {MONTHS[group.month]} {group.year}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {group.items.map(item => {
                  const selected = selectedIds.has(item.User_Media_Id);
                  return (
                    <button
                      key={item.User_Media_Id}
                      onClick={() => handleItemClick(item)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        selected ? 'border-blue-500 scale-95' : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      {item.Media_Type === 'video' ? (
                        <VideoThumbnail mediaId={item.User_Media_Id} className="w-full h-full" />
                      ) : (
                        <AuthImage
                          src={`/api/media/${item.User_Media_Id}/data`}
                          alt="Media"
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full bg-gray-700 flex items-center justify-center"><span className="text-gray-500 text-xs">Photo</span></div>}
                          lazy
                          maxPx={400}
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
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm disabled:opacity-40">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media viewer */}
      {viewingItem && (
        <MediaViewer
          item={viewingItem}
          allItems={filteredMedia}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  );
}
