import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { User, Mail, DollarSign, Database, LogOut, Check, Sparkles, Cloud, CloudOff, RefreshCw, LogIn, Bell, BellRing } from 'lucide-react';
import { getStoredFirebaseConfig, setStoredFirebaseConfig, FirebaseConfig, isFirebaseConfigured } from '../../lib/firebase';

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const ProfileScreen: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    isFirebaseActive, 
    cloudSyncStatus, 
    firebaseUser, 
    loginWithGoogleAuth, 
    loginAsGuest, 
    logoutUser,
    enableNotifications,
    isNotificationsEnabled
  } = useApp();

  const [notifGranted, setNotifGranted] = useState(isNotificationsEnabled);

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(currentUser.defaultCurrency);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Firebase Config state
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(() => {
    return getStoredFirebaseConfig() || {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    };
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      defaultCurrency
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbConfig.apiKey.trim() || !fbConfig.projectId.trim()) {
      setStoredFirebaseConfig(null);
      alert('Firebase credentials cleared. Switched to Local-First Dexie.js mode.');
    } else {
      setStoredFirebaseConfig(fbConfig);
      alert('Firebase configuration saved! Real-time synchronization active.');
    }
    setShowFirebaseModal(false);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await loginWithGoogleAuth();
    } catch (err: any) {
      alert(`Google Sign-In Error: ${err.message || err}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setAuthLoading(true);
    try {
      await loginAsGuest();
    } catch (err: any) {
      alert(`Guest Sign-In Error: ${err.message || err}`);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Account & Profile</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Manage your personal settings & preferences
        </span>
      </div>

      {/* Clean User Account Card */}
      <div 
        className="card" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {currentUser.avatarUrl ? (
            <img 
              src={currentUser.avatarUrl} 
              alt={currentUser.name} 
              style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-full)',
              background: 'var(--brand-600)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              {currentUser.email || 'Guest User'}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: isFirebaseActive ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-subtle)',
          color: isFirebaseActive ? 'var(--brand-500, #10b981)' : 'var(--text-tertiary)',
          fontSize: '0.72rem',
          fontWeight: 700
        }}>
          {isFirebaseActive ? <Cloud size={14} /> : <CloudOff size={14} />}
          <span>{isFirebaseActive ? 'Synced' : 'Local'}</span>
        </div>
      </div>

      {/* Push Notifications Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bell size={20} color="var(--brand-600)" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Settlement & Activity Alerts</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {notifGranted ? 'Browser alerts are active for debt settlements' : 'Enable browser alerts for settlements'}
            </div>
          </div>
        </div>
        {!notifGranted ? (
          <button
            type="button"
            onClick={async () => {
              const res = await enableNotifications();
              setNotifGranted(res);
            }}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            Enable
          </button>
        ) : (
          <span className="badge" style={{ color: 'var(--positive-text)' }}>
            ✓ Enabled
          </span>
        )}
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 'var(--radius-full)',
            background: 'var(--brand-600)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800
          }}>
            {name.charAt(0) || 'U'}
          </div>
          <div>
            <strong style={{ fontSize: '1.1rem', display: 'block' }}>{name}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{email}</span>
          </div>
        </div>

        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            DISPLAY NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-pill"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-pill"
            required
          />
        </div>

        {/* Default Currency */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            DEFAULT CURRENCY
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COMMON_CURRENCIES.map(curr => (
              <button
                key={curr}
                type="button"
                onClick={() => setDefaultCurrency(curr)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: defaultCurrency === curr ? 'var(--brand-600)' : 'var(--bg-subtle)',
                  color: defaultCurrency === curr ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: 4 }}>
          {savedSuccess ? <Check size={18} /> : null}
          <span>{savedSuccess ? 'Profile Saved!' : 'Save Preferences'}</span>
        </button>
      </form>

      {/* Account Logout Action */}
      <div className="card" style={{
        marginTop: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-subtle)'
      }}>
        <div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block' }}>
            Active Session: {currentUser.name}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            {currentUser.email || 'Guest User'}
          </span>
        </div>
        <button
          type="button"
          onClick={logoutUser}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer'
          }}
        >
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </div>

      {/* Firebase Modal */}
      {showFirebaseModal && (
        <div className="sheet-backdrop" onClick={() => setShowFirebaseModal(false)}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Firebase Cloud Configuration</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
              Paste your Firebase Web App credentials or provide them via <code>.env</code> file (<code>VITE_FIREBASE_API_KEY</code>, etc.).
            </p>

            <form onSubmit={handleSaveFirebaseConfig} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>API KEY</label>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={fbConfig.apiKey}
                  onChange={e => setFbConfig({ ...fbConfig, apiKey: e.target.value })}
                  className="input-pill"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>PROJECT ID</label>
                <input
                  type="text"
                  placeholder="whopaid-app-12345"
                  value={fbConfig.projectId}
                  onChange={e => setFbConfig({ ...fbConfig, projectId: e.target.value })}
                  className="input-pill"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>AUTH DOMAIN</label>
                <input
                  type="text"
                  placeholder="whopaid-app-12345.firebaseapp.com"
                  value={fbConfig.authDomain}
                  onChange={e => setFbConfig({ ...fbConfig, authDomain: e.target.value })}
                  className="input-pill"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>STORAGE BUCKET</label>
                <input
                  type="text"
                  placeholder="whopaid-app-12345.appspot.com"
                  value={fbConfig.storageBucket}
                  onChange={e => setFbConfig({ ...fbConfig, storageBucket: e.target.value })}
                  className="input-pill"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>APP ID</label>
                <input
                  type="text"
                  placeholder="1:123456789:web:abcdef"
                  value={fbConfig.appId}
                  onChange={e => setFbConfig({ ...fbConfig, appId: e.target.value })}
                  className="input-pill"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Save & Connect
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setStoredFirebaseConfig(null);
                    setFbConfig({ apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' });
                    setShowFirebaseModal(false);
                  }}
                  className="btn-secondary"
                >
                  Clear (Offline Mode)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
