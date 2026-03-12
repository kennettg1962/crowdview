import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function AuthGuard({ children }) {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
    <MenuSlideout />
    <GlobalVoiceCommands />
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/hub" element={<AuthGuard><HubScreen /></AuthGuard>} />
      <Route path="/friends" element={<AuthGuard><ManageFriendsScreen /></AuthGuard>} />
      <Route path="/profile" element={<AuthGuard><ProfileScreen /></AuthGuard>} />
      <Route path="/id" element={<AuthGuard><IdScreen /></AuthGuard>} />
      <Route path="/library" element={<AuthGuard><LibraryScreen /></AuthGuard>} />
      <Route path="/post" element={<AuthGuard><PostScreen /></AuthGuard>} />
      <Route path="/streams" element={<AuthGuard><StreamsScreen /></AuthGuard>} />
      <Route path="/streams/watch" element={<AuthGuard><StreamWatchScreen /></AuthGuard>} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
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
