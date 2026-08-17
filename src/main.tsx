import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

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
