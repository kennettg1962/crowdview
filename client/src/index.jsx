import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Unregister any stale service workers (e.g. from old Capacitor/PWA builds)
// that may intercept media requests and break video playback.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
