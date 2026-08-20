import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { capturePendingInviteFromBrowser } from './lib/invite';

// Persist QR/link invitations before authentication or React effects run.
// This survives OAuth round-trips and prevents a fresh PWA launch from
// dropping the token while Firebase restores its session.
capturePendingInviteFromBrowser();

// Auto-register and self-update service worker immediately
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatically claim new service worker and reload cleanly
    updateSW(true);
  },
  onRegistered(r) {
    if (r) {
      r.update();
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
