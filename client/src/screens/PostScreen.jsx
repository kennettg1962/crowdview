import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import AuthImage from '../components/AuthImage';
import {
  MovieCameraIcon, FriendsIcon,
  FacebookIcon, InstagramIcon, YouTubeIcon, TikTokIcon,
} from '../components/Icons';
import api from '../api/api';

const PLATFORMS = [
  { id: 'facebook',  name: 'Facebook',  Icon: FacebookIcon },
  { id: 'instagram', name: 'Instagram', Icon: InstagramIcon },
  { id: 'youtube',   name: 'YouTube',   Icon: YouTubeIcon },
  { id: 'tiktok',    name: 'TikTok',    Icon: TikTokIcon },
];

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(u);
}

export default function PostScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const mediaItems = state?.mediaItems || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [blobUrls, setBlobUrls] = useState({});
  const blobUrlsRef = useRef({});

  const [identifying, setIdentifying] = useState(true);
  const [taggedFriends, setTaggedFriends] = useState([]);

  const [platforms, setPlatforms] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('cv_platforms') || '{}');
    return PLATFORMS.map(p => ({
      ...p,
      authorized: !!saved[p.id],
      chosen: !!saved[p.id],
    }));
  });
  const [authPrompt, setAuthPrompt] = useState(null);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);

  // Load blobs for carousel display
  useEffect(() => {
    mediaItems.forEach(item => {
      api.get(`/api/media/${item.User_Media_Id}/data`, { responseType: 'blob' })
        .then(res => {
          const url = URL.createObjectURL(res.data);
          blobUrlsRef.current[item.User_Media_Id] = url;
          setBlobUrls(prev => ({ ...prev, [item.User_Media_Id]: url }));
        })
        .catch(() => {});
    });
    return () => {
      Object.values(blobUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Run face identification on mount
  useEffect(() => {
    runIdentification();
  }, []);

  async function getImageDataUrl(item) {
    const res = await api.get(`/api/media/${item.User_Media_Id}/data`, { responseType: 'blob' });
    if (item.Media_Type === 'photo') {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(res.data);
      });
    }
    // Video: capture first frame
    return new Promise(resolve => {
      const blobUrl = URL.createObjectURL(res.data);
      const video = document.createElement('video');
      video.muted = true;
      video.src = blobUrl;
      video.currentTime = 0.1;
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        canvas.getContext('2d').drawImage(video, 0, 0);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      video.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
    });
  }

  async function runIdentification() {
    setIdentifying(true);
    speak('Working on identifying friends');
    const friendMap = new Map();

    for (const item of mediaItems) {
      try {
        const imageData = await getImageDataUrl(item);
        if (!imageData) continue;
        const res = await api.post('/api/rekognition/identify', { imageData });
        const known = (res.data.faces || []).filter(f => f.status === 'known' && f.friendId);
        for (const face of known) {
          if (!friendMap.has(face.friendId)) {
            friendMap.set(face.friendId, { friendId: face.friendId, friendName: face.friendName });
          }
        }
      } catch {}
    }

    const friends = Array.from(friendMap.values());
    setTaggedFriends(friends);
    setIdentifying(false);

    if (friends.length > 0) {
      speak(`Found ${friends.length} friend${friends.length !== 1 ? 's' : ''}: ${friends.map(f => f.friendName).join(', ')}`);
    } else {
      speak('No friends identified');
    }
  }

  function togglePlatform(platform) {
    if (!platform.authorized) {
      setAuthPrompt(platform.id);
      return;
    }
    setPlatforms(prev => prev.map(p =>
      p.id === platform.id ? { ...p, chosen: !p.chosen } : p
    ));
  }

  function authorizePlatform(id) {
    const saved = JSON.parse(localStorage.getItem('cv_platforms') || '{}');
    saved[id] = true;
    localStorage.setItem('cv_platforms', JSON.stringify(saved));
    setPlatforms(prev => prev.map(p =>
      p.id === id ? { ...p, authorized: true, chosen: true } : p
    ));
    setAuthPrompt(null);
    const p = PLATFORMS.find(p => p.id === id);
    if (p) speak(`${p.name} authorized and selected`);
  }

  async function handlePost() {
    const chosen = platforms.filter(p => p.chosen);
    setPosting(true);
    try {
      // Stub: simulate posting to each platform
      await new Promise(r => setTimeout(r, 1500));
      speak(`Successfully posted to ${chosen.map(p => p.name).join(', ')}`);
      setPostResult('success');
      setTimeout(() => navigate('/library'), 2500);
    } catch {
      setPostResult('error');
      speak('Post failed. Please try again.');
      setPosting(false);
    }
  }

  const currentItem = mediaItems[currentIndex];
  const currentBlobUrl = currentItem ? blobUrls[currentItem.User_Media_Id] : null;
  const chosenCount = platforms.filter(p => p.chosen).length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < mediaItems.length - 1;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <AppHeader
        left={
          <button onClick={() => navigate('/library')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
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

      <main className="flex-1 flex flex-col p-3 gap-3 items-center">

        {/* Two-column: carousel + tagged friends */}
        <div className="flex gap-3 items-start justify-center w-full max-w-4xl">

          {/* Carousel */}
          <div className="flex-1 relative rounded-xl overflow-hidden flex items-center justify-center">
            {currentBlobUrl ? (
              currentItem?.Media_Type === 'video' ? (
                <video src={currentBlobUrl} controls className="max-h-[42vh] w-full rounded-xl" />
              ) : (
                <img src={currentBlobUrl} alt="Media" className="max-h-[42vh] max-w-full rounded-xl object-contain" />
              )
            ) : (
              <div className="w-full h-40 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600">
                <MovieCameraIcon className="w-12 h-12 opacity-40" />
              </div>
            )}

            {/* Prev */}
            {hasPrev && (
              <button
                onClick={() => setCurrentIndex(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg"
              >◀</button>
            )}
            {/* Next */}
            {hasNext && (
              <button
                onClick={() => setCurrentIndex(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg"
              >▶</button>
            )}
            {/* Counter */}
            {mediaItems.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1} / {mediaItems.length}
              </div>
            )}
          </div>

          {/* Tagged Friends */}
          <div className="w-56 flex-shrink-0">
            <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Tagged Friends</h3>
            {identifying ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                <span>Identifying...</span>
              </div>
            ) : taggedFriends.length === 0 ? (
              <p className="text-gray-500 text-sm">No friends identified</p>
            ) : (
              <div className="space-y-3">
                {taggedFriends.map(f => (
                  <div key={f.friendId} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <AuthImage
                        src={`/api/friends/${f.friendId}/photos/primary/data`}
                        alt={f.friendName}
                        className="w-full h-full object-cover"
                        fallback={<span className="text-gray-500 text-lg">👤</span>}
                      />
                    </div>
                    <span className="text-white text-sm">{f.friendName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Select Platforms */}
        <div className="w-full max-w-4xl">
          <h3 className="text-white font-semibold text-sm mb-2">Select Platforms To Post To</h3>
          <div className="flex gap-2 flex-wrap">
            {platforms.map(platform => {
              const { Icon } = platform;
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl border-2 transition-all ${
                    platform.chosen
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : platform.authorized
                      ? 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500'
                      : 'border-gray-700 bg-gray-800 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{platform.name}</span>
                  {!platform.authorized && (
                    <span className="text-xs text-yellow-500">Authorize</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/library')}
            className="px-8 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={chosenCount === 0 || posting}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
          >
            {posting ? 'Posting...' : 'Confirm Post'}
          </button>
        </div>

        {/* Post result */}
        {postResult && (
          <div className={`text-center text-sm font-medium py-2 rounded-lg ${postResult === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {postResult === 'success' ? `Successfully posted to ${platforms.filter(p => p.chosen).map(p => p.name).join(', ')}` : 'Post failed. Please try again.'}
          </div>
        )}
      </main>

      <NavBar />
      <TrueFooter />

      {/* Identifying popup */}
      {identifying && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
            <p className="text-white font-medium text-center">Working On Identifying Friends</p>
            <p className="text-gray-400 text-sm text-center">Scanning photos for familiar faces...</p>
          </div>
        </div>
      )}

      {/* Authorize platform prompt */}
      {authPrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">
              Authorize {PLATFORMS.find(p => p.id === authPrompt)?.name}?
            </p>
            <p className="text-gray-400 text-sm mb-5">
              You need to authorize this platform before posting to it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAuthPrompt(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => authorizePlatform(authPrompt)}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
