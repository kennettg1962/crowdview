import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSource, setCurrentSource] = useState(null);
  const [currentOutlet, setCurrentOutlet] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [slideoutOpen, setSlideoutOpen] = useState(false);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('cv_token');
    const savedUser = sessionStorage.getItem('cv_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        sessionStorage.removeItem('cv_token');
        sessionStorage.removeItem('cv_user');
      }
    }
  }, []);

  const login = (userData, token) => {
    sessionStorage.setItem('cv_token', token);
    sessionStorage.setItem('cv_user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem('cv_token');
    sessionStorage.removeItem('cv_user');
    setUser(null);
    setIsAuthenticated(false);
    setIsStreaming(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setCurrentSource(null);
    setCurrentOutlet(null);
  };

  const startStream = (stream) => {
    setMediaStream(stream);
    setIsStreaming(true);
  };

  const stopStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setIsStreaming(false);
  };

  return (
    <AppContext.Provider value={{
      user, setUser,
      isAuthenticated,
      login, logout,
      currentSource, setCurrentSource,
      currentOutlet, setCurrentOutlet,
      isStreaming, startStream, stopStream,
      mediaStream, setMediaStream,
      slideoutOpen, setSlideoutOpen
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export default AppContext;
