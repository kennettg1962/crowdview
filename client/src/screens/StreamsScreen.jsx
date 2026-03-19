import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { MovieCameraIcon, FriendsIcon, BroadcastIcon, DeleteIcon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import api from '../api/api';

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}

function duration(start, end) {
  const ms = new Date(end || Date.now()) - new Date(start);
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function StreamsScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [liveStreams, setLiveStreams]   = useState([]);
  const [pastStreams, setPastStreams]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('live'); // 'live' | 'past'
  const [deletingStream, setDeletingStream] = useState(null);
  const [showDeletedToast, setShowDeletedToast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [live, past] = await Promise.all([
        api.get('/api/stream/live'),
        api.get('/api/stream/past'),
      ]);
      setLiveStreams(live.data);
      setPastStreams(past.data);
    } catch (err) {
      console.error('Failed to load streams', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh live list every 30 s
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/api/stream/live').then(r => setLiveStreams(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  async function confirmDeleteStream() {
    if (!deletingStream) return;
    try {
      await api.delete(`/api/stream/${deletingStream.Stream_Id}`);
      setDeletingStream(null);
      setPastStreams(prev => prev.filter(s => s.Stream_Id !== deletingStream.Stream_Id));
      setShowDeletedToast(true);
      setTimeout(() => setShowDeletedToast(false), 500);
    } catch (err) {
      console.error('Delete stream failed', err);
    }
  }

  const streams = tab === 'live' ? liveStreams : pastStreams;

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
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

      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        {['live', 'past'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'live' ? '🔴 Live Now' : '📼 Past Streams'}
            {t === 'live' && liveStreams.length > 0 && (
              <span className="ml-2 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {liveStreams.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center mt-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 text-gray-500 gap-3">
            <BroadcastIcon className="w-12 h-12 opacity-30" />
            <p>{tab === 'live' ? 'Nobody is streaming right now' : 'No past streams yet'}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {streams.map(s => (
              <div key={s.Stream_Id} className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
                {/* Thumbnail placeholder */}
                <div className="w-20 h-14 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <BroadcastIcon className="w-7 h-7 text-gray-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {tab === 'live' && <LiveBadge />}
                    <span className="text-white font-medium truncate">{s.Streamer_Name || 'Unknown'}</span>
                  </div>
                  <p className="text-gray-400 text-sm truncate">{s.Title_Txt}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {tab === 'live'
                      ? `Started ${duration(s.Started_At, null)} ago`
                      : `${new Date(s.Started_At).toLocaleDateString()} · ${duration(s.Started_At, s.Ended_At)}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate('/streams/watch', { state: { stream: s, isLive: tab === 'live' } })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                  >
                    Watch
                  </button>
                  {tab === 'past' && s.Streamer_User_Id === user?.userId && (
                    <button
                      onClick={() => setDeletingStream(s)}
                      className="p-2 text-red-400/50 hover:text-red-400 transition-colors"
                      title="Delete stream"
                    >
                      <DeleteIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <TrueFooter />
      <NavBar />

      {showDeletedToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          Stream Deleted
        </div>
      )}

      {deletingStream && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete this stream?</p>
            <p className="text-gray-400 text-sm mb-1">{deletingStream.Title_Txt}</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the stream record and all recording files. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingStream(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteStream}
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
