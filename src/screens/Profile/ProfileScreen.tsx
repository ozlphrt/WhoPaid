import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { LogOut, Check, Cloud, CloudOff, Bell } from 'lucide-react';

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const ProfileScreen: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    isFirebaseActive, 
    logoutUser,
    clearAllData,
    enableNotifications,
    isNotificationsEnabled,
    refreshData
  } = useApp();

  const [notifGranted, setNotifGranted] = useState(isNotificationsEnabled);
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(currentUser.defaultCurrency || 'EUR');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(currentUser.name);
    setEmail(currentUser.email);
    setDefaultCurrency(currentUser.defaultCurrency || 'EUR');
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      ...currentUser,
      name: name.trim() || currentUser.name,
      email: email.trim() || currentUser.email,
      defaultCurrency
    });
    await refreshData();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '16px 20px 80px',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px 0' }}>
          Profile & Settings
        </h1>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
          Manage your account preferences & currencies
        </span>
      </div>

      {/* Unified Single Profile Card */}
      <form onSubmit={handleSaveProfile} className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '20px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)'
      }}>

        {/* User Identity Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentUser.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.name} 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-full)',
                  objectFit: 'cover',
                  border: '2px solid var(--border-strong)'
                }} 
              />
            ) : (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-full)',
                background: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.2rem'
              }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <strong style={{ fontSize: '1.05rem', fontWeight: 800, display: 'block', letterSpacing: '-0.01em' }}>
                {currentUser.name}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                {currentUser.email || 'Guest Account'}
              </span>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            background: isFirebaseActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-subtle)',
            color: isFirebaseActive ? '#10b981' : 'var(--text-tertiary)',
            fontSize: '0.72rem',
            fontWeight: 800
          }}>
            {isFirebaseActive ? <Cloud size={13} /> : <CloudOff size={13} />}
            <span>{isFirebaseActive ? 'Synced' : 'Local'}</span>
          </div>
        </div>

        {/* Display Name Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
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

        {/* Email Address Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
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

        {/* Default Currency Selector */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              DEFAULT CURRENCY
            </label>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Selected: {defaultCurrency}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {COMMON_CURRENCIES.map(curr => {
              const isSelected = defaultCurrency === curr;
              return (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setDefaultCurrency(curr)}
                  style={{
                    padding: '9px 0',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    border: isSelected ? '1px solid var(--btn-primary-border)' : '1px solid var(--border-subtle)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {curr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification Alerts Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell size={16} color="#3b82f6" />
            </div>
            <div>
              <strong style={{ fontSize: '0.82rem', display: 'block' }}>Settlement & Activity Alerts</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Push notifications for debt payments</span>
            </div>
          </div>

          {!notifGranted ? (
            <button
              type="button"
              onClick={async () => {
                const res = await enableNotifications();
                setNotifGranted(res);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none'
              }}
            >
              Enable
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={14} /> Active
            </span>
          )}
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="btn-primary"
          style={{
            marginTop: 4,
            padding: '13px',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.92rem',
            fontWeight: 800,
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: savedSuccess ? '#10b981' : undefined
          }}
        >
          {savedSuccess ? <Check size={18} /> : null}
          <span>{savedSuccess ? 'Preferences Saved!' : 'Save Preferences'}</span>
        </button>
      </form>

      {/* Clean Sign Out Action */}
      <button
        type="button"
        onClick={logoutUser}
        style={{
          width: '100%',
          padding: '13px 18px',
          borderRadius: 'var(--radius-xl)',
          background: 'rgba(239, 68, 68, 0.08)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          fontWeight: 700,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'background 0.15s ease'
        }}
      >
        <LogOut size={16} />
        <span>Sign Out ({currentUser.email || currentUser.name})</span>
      </button>

      {/* Clear / Reset All Data for testing */}
      <button
        type="button"
        onClick={async () => {
          if (window.confirm('Are you sure you want to delete all trips and expenses to test from scratch?')) {
            await clearAllData();
            alert('All trips and test data have been wiped clean!');
          }
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 'var(--radius-lg)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          border: '1px dashed var(--border-subtle)',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'center'
        }}
      >
        🗑️ Clear All Trips & Data (Start Fresh)
      </button>

    </div>
  );
};
