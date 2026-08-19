import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { Sparkles, Globe, Users, ArrowRight, ShieldCheck, Check, Loader2 } from 'lucide-react';

import { loginAnonymously } from '../../lib/firebase';

const POPULAR_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const AuthScreen: React.FC = () => {
  const { 
    loginWithGoogleAuth, 
    setCurrentUser, 
    refreshData,
    isFirebaseActive 
  } = useApp();

  const [mode, setMode] = useState<'welcome' | 'guest'>('welcome');
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestCurrency, setGuestCurrency] = useState<CurrencyCode>('EUR');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogleAuth();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain not authorized: Please add "ozlphrt.github.io" to Firebase Console -> Authentication -> Settings -> Authorized domains.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Google Sign-In is not enabled: Please enable Google in Firebase Console -> Authentication -> Sign-in method.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Please allow popups in your browser settings and tap Sign in with Google again.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMsg('Please enter your name to continue.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      let fbUid: string | null = null;
      if (isFirebaseActive) {
        const fbUser = await loginAnonymously().catch(err => {
          console.warn('Anonymous auth failed:', err);
          return null;
        });
        if (fbUser) fbUid = fbUser.uid;
      }

      const cleanName = guestName.trim();
      const userId = fbUid || `user_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`;
      const newUser = {
        id: userId,
        name: cleanName,
        email: guestEmail.trim() || `${cleanName.toLowerCase()}@whopaid.app`,
        defaultCurrency: guestCurrency
      };

      setCurrentUser(newUser);
      localStorage.setItem('whopaid_auth_user', JSON.stringify(newUser));
      await refreshData();
    } catch (err: any) {
      console.error('Guest Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to create guest session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      
      {/* Top Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
        <img 
          src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} 
          alt="WhoPaid" 
          className="animate-float-breath"
          style={{
            width: 76,
            height: 76,
            borderRadius: 22,
            objectFit: 'cover',
            marginBottom: 16,
            cursor: 'default'
          }}
        />

        <h1 style={{
          fontSize: '2.1rem',
          fontWeight: 900,
          letterSpacing: '-0.035em',
          margin: '0 0 6px 0',
          color: 'var(--text-primary)'
        }}>
          WhoPaid
        </h1>

        <p style={{
          fontSize: '0.92rem',
          color: 'var(--text-secondary)',
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.45
        }}>
          Travel together. Split group bills without the awkward math.
        </p>
      </div>

      {/* Feature Highlights Card */}
      {mode === 'welcome' && (
        <div className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: 'var(--bg-surface)',
          padding: '18px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          margin: '20px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', display: 'block', fontWeight: 800 }}>Snap & Split in Seconds</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Equal, exact, weights, or itemized bills on the go</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '1.1rem' }}>🌍</span>
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', display: 'block', fontWeight: 800 }}>30+ Live Currencies</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Daily ECB rates for EUR, TRY, USD, GBP & more</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '1.1rem' }}>🪄</span>
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', display: 'block', fontWeight: 800 }}>Minimum-Transfer Magic</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Settles 20 messy group IOUs in just 2 simple payments</span>
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Form */}
      {mode === 'guest' && (
        <form onSubmit={handleGuestSubmit} className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          margin: '20px 0',
          padding: '20px',
          borderRadius: 'var(--radius-xl)'
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
            Enter your details
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', margin: '0 0 4px 0' }}>
            Choose how your name appears to friends on shared trips.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
              YOUR NAME *
            </label>
            <input
              type="text"
              placeholder="e.g. Ozalp, Sarah, Alex"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              className="input-pill"
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
              EMAIL (OPTIONAL)
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="input-pill"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
              DEFAULT CURRENCY
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {POPULAR_CURRENCIES.map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setGuestCurrency(curr)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: guestCurrency === curr ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: guestCurrency === curr ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: guestCurrency === curr ? '1px solid var(--btn-primary-border)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    boxShadow: guestCurrency === curr ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--negative-text)', fontSize: '0.82rem', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setMode('welcome')}
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 2, justifyContent: 'center' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Start Splitting</span>}
            </button>
          </div>
        </form>
      )}

      {/* Auth Action Buttons */}
      {mode === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {errorMsg && (
            <div style={{ color: 'var(--negative-text)', fontSize: '0.82rem', fontWeight: 600, textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          {/* Google Sign-in Button */}
          {isFirebaseActive && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 'var(--radius-lg)',
                background: '#ffffff',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s ease'
              }}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" color="#1f2937" />
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          )}

          {/* Continue as Guest Button */}
          <button
            type="button"
            onClick={() => setMode('guest')}
            className={isFirebaseActive ? "btn-secondary" : "btn-primary"}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.95rem',
              fontWeight: 800,
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>Continue as Guest / Enter Name</span>
            <ArrowRight size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: 4 }}>
            <ShieldCheck size={14} color="var(--brand-500, #10b981)" />
            <span>Encrypted local storage with offline-first PWA support</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          WhoPaid PWA • v1.0.0
        </span>
      </div>

    </div>
  );
};
