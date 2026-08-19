import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode } from '../../types';
import { ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { loginAnonymously } from '../../lib/firebase';
import { syncUserToCloud } from '../../lib/firestoreSync';
import { db } from '../../lib/db';

const POPULAR_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const AuthScreen: React.FC = () => {
  const { 
    setCurrentUser, 
    refreshData,
    joinTrip,
    isFirebaseActive 
  } = useApp();

  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestCurrency, setGuestCurrency] = useState<CurrencyCode>('EUR');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
          console.warn('Anonymous auth note:', err);
          return null;
        });
        if (fbUser) fbUid = fbUser.uid;
      }

      const cleanName = guestName.trim();
      const userId = fbUid || `user_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`;
      const newUser = {
        id: userId,
        name: cleanName,
        email: guestEmail.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@whopaid.app`,
        defaultCurrency: guestCurrency
      };

      await db.users.put(newUser);
      if (isFirebaseActive) {
        await syncUserToCloud(newUser).catch(console.warn);
      }

      setCurrentUser(newUser);
      localStorage.setItem('whopaid_auth_user', JSON.stringify(newUser));

      // Check if user arrived via an invitation link or QR code
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const pendingJoin = searchParams.get('join') ||
        searchParams.get('tripId') ||
        hashParams.get('join') ||
        hashParams.get('tripId') ||
        sessionStorage.getItem('whopaid_pending_join') ||
        localStorage.getItem('whopaid_pending_join');

      if (pendingJoin) {
        sessionStorage.removeItem('whopaid_pending_join');
        localStorage.removeItem('whopaid_pending_join');
        await joinTrip(pendingJoin);
      } else {
        await refreshData();
      }
    } catch (err: any) {
      console.error('Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to create session. Please try again.');
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
      padding: 'calc(28px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      
      {/* Top Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 16 }}>
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

      {/* Main Onboarding Form */}
      <form onSubmit={handleSubmit} className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: '24px 0',
        padding: '22px',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0' }}>
            Welcome to WhoPaid
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Enter your name to start tracking and splitting group travel expenses.
          </p>
        </div>

        {/* Name Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            YOUR NAME *
          </label>
          <input
            type="text"
            placeholder="e.g. Ozalp, Betül, Alex"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            className="input-pill"
            required
            autoFocus
            style={{ fontSize: '0.98rem' }}
          />
        </div>

        {/* Email Input (Optional) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              EMAIL (OPTIONAL)
            </label>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>For cross-device sync</span>
          </div>
          <input
            type="email"
            placeholder="e.g. ozalph@gmail.com"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            className="input-pill"
            style={{ fontSize: '0.92rem' }}
          />
        </div>

        {/* Preferred Currency */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
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

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{
            marginTop: 6,
            padding: '14px 20px',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.95rem',
            fontWeight: 800,
            justifyContent: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <span>Get Started</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Security & Offline Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '0.76rem' }}>
          <ShieldCheck size={14} color="var(--brand-500, #10b981)" />
          <span>Instant access • No passwords • 100% offline capable</span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
          WhoPaid • v1.0.0
        </span>
      </div>

    </div>
  );
};
