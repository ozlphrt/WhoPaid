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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Profile & Cloud Sync</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          User settings, preferences & backend connectivity
        </span>
      </div>

      {/* Cloud Status Banner */}
      <div 
        className="card" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderLeft: `4px solid ${isFirebaseActive ? 'var(--brand-500, #10b981)' : 'var(--warning-500, #f59e0b)'}`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isFirebaseActive ? (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Cloud size={20} color="#10b981" />
            </div>
          ) : (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CloudOff size={20} color="#f59e0b" />
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {isFirebaseActive ? 'Firebase Realtime Cloud Active' : 'Offline-First Local Mode'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              {isFirebaseActive 
                ? (firebaseUser ? `Authenticated as ${firebaseUser.isAnonymous ? 'Guest' : (firebaseUser.email || 'Google User')}` : 'Cloud ready (Not signed in)')
                : 'Data saved locally in browser IndexedDB (Dexie.js)'}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowFirebaseModal(true)}
          className="badge"
          style={{ cursor: 'pointer', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
        >
          ⚙️ Setup
        </button>
      </div>

      {/* Cloud Auth Card (if Firebase is active) */}
      {isFirebaseActive && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--brand-600)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Firebase Account</h2>
          </div>
          
          {firebaseUser ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>
                  {firebaseUser.displayName || currentUser.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  UID: {firebaseUser.uid.substring(0, 10)}... | {firebaseUser.isAnonymous ? 'Guest Session' : firebaseUser.email}
                </span>
              </div>
              <button 
                onClick={logoutUser} 
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button 
                onClick={handleGoogleSignIn} 
                disabled={authLoading}
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <LogIn size={16} />
                <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
              <button 
                onClick={handleGuestSignIn} 
                disabled={authLoading}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                <span>Continue as Guest</span>
              </button>
            </div>
          )}
        </div>
      )}

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
