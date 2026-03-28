import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import MenuSlideout from './components/MenuSlideout';
import GlobalVoiceCommands from './components/GlobalVoiceCommands';
import SplashScreen from './screens/SplashScreen';
import HubScreen from './screens/HubScreen';
import ManageFriendsScreen from './screens/ManageFriendsScreen';
import ProfileScreen from './screens/ProfileScreen';
import IdScreen from './screens/IdScreen';
import LibraryScreen from './screens/LibraryScreen';
import PostScreen from './screens/PostScreen';
import StreamsScreen from './screens/StreamsScreen';
import StreamWatchScreen from './screens/StreamWatchScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import CorporateUsersScreen from './screens/CorporateUsersScreen';

function AuthGuard({ children }) {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function OAUGuard({ children }) {
  const { isAuthenticated, isOAU } = useApp();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isOAU) return <Navigate to="/hub" replace />;
  return children;
}

// Back office users may only access /streams and /friends
function NoBackOfficeGuard({ children }) {
  const { isAuthenticated, isBackOffice } = useApp();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isBackOffice) return <Navigate to="/streams" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppRoutes() {
  return (
    <>
    <ScrollToTop />
    <MenuSlideout />
    <GlobalVoiceCommands />
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/hub" element={<NoBackOfficeGuard><HubScreen /></NoBackOfficeGuard>} />
      <Route path="/friends" element={<AuthGuard><ManageFriendsScreen /></AuthGuard>} />
      <Route path="/profile" element={<NoBackOfficeGuard><ProfileScreen /></NoBackOfficeGuard>} />
      <Route path="/id" element={<NoBackOfficeGuard><IdScreen /></NoBackOfficeGuard>} />
      <Route path="/library" element={<NoBackOfficeGuard><LibraryScreen /></NoBackOfficeGuard>} />
      <Route path="/post" element={<NoBackOfficeGuard><PostScreen /></NoBackOfficeGuard>} />
      <Route path="/streams" element={<AuthGuard><StreamsScreen /></AuthGuard>} />
      <Route path="/streams/watch" element={<AuthGuard><StreamWatchScreen /></AuthGuard>} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route path="/corporate/users" element={<OAUGuard><CorporateUsersScreen /></OAUGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
