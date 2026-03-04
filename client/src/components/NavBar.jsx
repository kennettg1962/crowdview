import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, FriendsIcon, UserProfileIcon } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: 'Home', icon: HomeIcon, path: '/hub' },
    { label: 'Friends', icon: FriendsIcon, path: '/friends' },
    { label: 'Profile', icon: UserProfileIcon, path: '/profile' },
  ];

  return (
    <nav className="bg-gray-900 border-t border-gray-700 flex">
      {tabs.map(({ label, icon: Icon, path }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${
              active ? 'text-blue-400 border-t-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
