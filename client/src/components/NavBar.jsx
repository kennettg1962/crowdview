import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { HomeIcon, FriendsIcon, LibraryIcon, BroadcastIcon, UserProfileIcon } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSlideoutOpen } = useApp();

  return (
    <nav className="bg-white border-t border-gray-200 flex">
      <button
        onClick={() => navigate('/hub')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/hub' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        <HomeIcon className="w-5 h-5" />
        <span>Home</span>
      </button>

      <button
        onClick={() => navigate('/friends')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/friends' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        <FriendsIcon className="w-5 h-5" />
        <span>Friends</span>
      </button>

      <button
        onClick={() => navigate('/library')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/library' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        <LibraryIcon className="w-5 h-5" />
        <span>Library</span>
      </button>

      <button
        onClick={() => navigate('/streams')}
        className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
          location.pathname === '/streams' ? 'text-blue-600 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-800'
        }`}
      >
        <BroadcastIcon className="w-5 h-5" />
        <span>Streams</span>
      </button>

      <button
        onClick={() => setSlideoutOpen(true)}
        className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-gray-500 hover:text-gray-800"
      >
        <UserProfileIcon className="w-5 h-5" />
        <span>User Menu</span>
      </button>
    </nav>
  );
}
