import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { HomeIcon, FriendsIcon, LibraryIcon, BroadcastIcon, UserProfileIcon, LogoutIcon, UsersIcon } from './Icons';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSlideoutOpen, logout, isCorporate, isOAU, isBackOffice, isOperations } = useApp();

  const active = 'text-white';
  const inactive = 'text-white/60 hover:text-white';
  const tab = (path) => `flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors ${location.pathname === path ? active : inactive}`;

  // Operations users (CrowdView staff) see: Dashboard + Orgs + Logout
  if (isOperations) {
    return (
      <>
        <div className="flex-shrink-0" style={{ height: 'calc(env(safe-area-inset-bottom) + 56px)' }} />
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 flex bg-slate-700/95"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button onClick={() => navigate('/operations/dashboard')} className={tab('/operations/dashboard')}>
            <HomeIcon className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <button onClick={() => navigate('/operations/orgs')} className={tab('/operations/orgs')}>
            <UsersIcon className="w-5 h-5" />
            <span>Orgs</span>
          </button>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-white/60 hover:text-white"
          >
            <LogoutIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </>
    );
  }

  // Back office users see a restricted nav: Streams + Customers + Logout only
  if (isBackOffice) {
    return (
      <>
        <div className="flex-shrink-0" style={{ height: 'calc(env(safe-area-inset-bottom) + 56px)' }} />
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 flex bg-slate-700/95"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button onClick={() => navigate('/streams')} className={tab('/streams')}>
            <BroadcastIcon className="w-5 h-5" />
            <span>Streams</span>
          </button>
          <button onClick={() => navigate('/friends')} className={tab('/friends')}>
            <FriendsIcon className="w-5 h-5" />
            <span>Customers</span>
          </button>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-white/60 hover:text-white"
          >
            <LogoutIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </>
    );
  }

  return (
    <>
      {/* Spacer so content isn't hidden behind fixed nav */}
      <div className="flex-shrink-0" style={{ height: 'calc(env(safe-area-inset-bottom) + 56px)' }} />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex bg-slate-700/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button onClick={() => navigate('/hub')} className={tab('/hub')}>
          <HomeIcon className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button onClick={() => navigate('/friends')} className={tab('/friends')}>
          <FriendsIcon className="w-5 h-5" />
          <span>{isCorporate ? 'Customers' : 'Friends'}</span>
        </button>

        <button onClick={() => navigate('/library')} className={tab('/library')}>
          <LibraryIcon className="w-5 h-5" />
          <span>Library</span>
        </button>

        <button onClick={() => navigate('/streams')} className={tab('/streams')}>
          <BroadcastIcon className="w-5 h-5" />
          <span>Streams</span>
        </button>

        {isCorporate ? (
          <>
            {isOAU && (
              <button onClick={() => navigate('/corporate/users')} className={tab('/corporate/users')}>
                <UsersIcon className="w-5 h-5" />
                <span>Users</span>
              </button>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-white/60 hover:text-white"
            >
              <LogoutIcon className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setSlideoutOpen(true)}
            className="flex-1 flex flex-col items-center py-2 gap-1 text-xs transition-colors text-white/60 hover:text-white"
          >
            <UserProfileIcon className="w-5 h-5" />
            <span>User Menu</span>
          </button>
        )}
      </nav>
    </>
  );
}
