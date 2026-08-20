import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export const PWAUpdateModal: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Periodically check for updates every 60 minutes
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('PWA service worker registration error:', error);
    },
  });

  if (!needRefresh) return null;

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '24px 20px 20px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Dismiss update"
        >
          <X size={18} />
        </button>

        {/* Icon Badge */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-full)',
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14
        }}>
          <Sparkles size={26} />
        </div>

        {/* Title & Description */}
        <h2 style={{
          fontSize: '1.2rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 8px 0',
          color: 'var(--text-primary)'
        }}>
          New Update Available
        </h2>

        <p style={{
          fontSize: '0.86rem',
          color: 'var(--text-secondary)',
          margin: '0 0 20px 0',
          lineHeight: 1.45
        }}>
          A new version of WhoPaid is ready with new features and improvements. Would you like to update now?
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            Later
          </button>

          <button
            onClick={handleUpdate}
            className="btn-primary"
            style={{
              flex: 1.4,
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={16} />
            <span>Update Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
