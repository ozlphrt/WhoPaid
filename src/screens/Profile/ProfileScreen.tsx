import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { User, Mail, DollarSign, Database, LogOut, Check, Sparkles } from 'lucide-react';
import { getStoredFirebaseConfig, setStoredFirebaseConfig, FirebaseConfig } from '../../lib/firebase';

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const ProfileScreen: React.FC = () => {
  const { currentUser, setCurrentUser } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(currentUser.defaultCurrency);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
      alert('Firebase credentials cleared. Running in Offline Dexie mode.');
    } else {
      setStoredFirebaseConfig(fbConfig);
      alert('Firebase configuration saved!');
    }
    setShowFirebaseModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Profile</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          User settings & preferences
        </span>
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

      {/* Backend & Cloud Sync Card (Firebase) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} color="var(--brand-600)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Cloud Sync & Backend</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          WhoPaid operates offline-first with IndexedDB. Connect Firebase for real-time multi-device cloud synchronization.
        </p>

        <button
          onClick={() => setShowFirebaseModal(true)}
          className="btn-secondary"
          style={{ fontSize: '0.85rem' }}
        >
          <span>Configure Firebase Credentials</span>
        </button>
      </div>

      {/* Firebase Modal */}
      {showFirebaseModal && (
        <div className="sheet-backdrop" onClick={() => setShowFirebaseModal(false)}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 14 }}>Firebase Cloud Configuration</h2>

            <form onSubmit={handleSaveFirebaseConfig} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                placeholder="API Key (e.g. AIzaSy...)"
                value={fbConfig.apiKey}
                onChange={e => setFbConfig({ ...fbConfig, apiKey: e.target.value })}
                className="input-pill"
              />
              <input
                type="text"
                placeholder="Project ID"
                value={fbConfig.projectId}
                onChange={e => setFbConfig({ ...fbConfig, projectId: e.target.value })}
                className="input-pill"
              />
              <input
                type="text"
                placeholder="Auth Domain"
                value={fbConfig.authDomain}
                onChange={e => setFbConfig({ ...fbConfig, authDomain: e.target.value })}
                className="input-pill"
              />
              <input
                type="text"
                placeholder="Storage Bucket"
                value={fbConfig.storageBucket}
                onChange={e => setFbConfig({ ...fbConfig, storageBucket: e.target.value })}
                className="input-pill"
              />
              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                Save Firebase Settings
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
