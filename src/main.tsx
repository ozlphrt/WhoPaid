import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Auto-register service worker for offline support
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New WhoPaid content available, reload to update.');
  },
  onOfflineReady() {
    console.log('WhoPaid is ready for offline usage.');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
