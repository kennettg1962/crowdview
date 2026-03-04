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

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('cv_token');
    const savedUser = localStorage.getItem('cv_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('cv_token');
        localStorage.removeItem('cv_user');
      }
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('cv_token', token);
    localStorage.setItem('cv_user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
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
