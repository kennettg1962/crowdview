import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { HomeIcon, FriendsIcon, LibraryIcon, BroadcastIcon, UserProfileIcon } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSlideoutOpen } = useApp();

  return (
    <>
      {/* Spacer so content isn't hidden behind fixed nav */}
      <div className="flex-shrink-0" style={{ height: 'calc(env(safe-area-inset-bottom) + 56px)' }} />
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex bg-gray-900/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        onClick={() => navigate('/hub')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/hub' ? 'text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <HomeIcon className="w-5 h-5" />
        <span>Home</span>
      </button>

      <button
        onClick={() => navigate('/friends')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/friends' ? 'text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <FriendsIcon className="w-5 h-5" />
        <span>Friends</span>
      </button>

      <button
        onClick={() => navigate('/library')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/library' ? 'text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <LibraryIcon className="w-5 h-5" />
        <span>Library</span>
      </button>

      <button
        onClick={() => navigate('/streams')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/streams' ? 'text-white' : 'text-white/60 hover:text-white'
        }`}
      >
        <BroadcastIcon className="w-5 h-5" />
        <span>Streams</span>
      </button>

      <button
        onClick={() => setSlideoutOpen(true)}
        className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-white/60 hover:text-white"
      >
        <UserProfileIcon className="w-5 h-5" />
        <span>User Menu</span>
      </button>
    </nav>
    </>
  );
}
