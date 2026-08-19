import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode, Trip, TripMember } from '../../types';
import { ArrowRight, ShieldCheck, Loader2, Check, UserPlus } from 'lucide-react';
import { loginAnonymously } from '../../lib/firebase';
import { syncUserToCloud, fetchTripFromCloud, fetchTripMembersFromCloud } from '../../lib/firestoreSync';
import { db } from '../../lib/db';

const POPULAR_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const AuthScreen: React.FC = () => {
  const { 
    loginWithGoogleAuth,
    setCurrentUser, 
    refreshData,
    joinTrip,
    isFirebaseActive 
  } = useApp();

  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestCurrency, setGuestCurrency] = useState<CurrencyCode>('EUR');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingTrip, setPendingTrip] = useState<Trip | null>(null);
  const [existingMembers, setExistingMembers] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [isCustomName, setIsCustomName] = useState<boolean>(false);

  // Discover pending trip & existing members to allow 1-tap selection without duplicate name errors
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const pendingJoin = searchParams.get('join') ||
      searchParams.get('tripId') ||
      hashParams.get('join') ||
      hashParams.get('tripId') ||
      sessionStorage.getItem('whopaid_pending_join') ||
      localStorage.getItem('whopaid_pending_join');

    const loadKnownMembers = async () => {
      if (!pendingJoin) {
        setPendingTrip(null);
        setExistingMembers([]);
        return;
      }

      // Fetch cloud trip and its member list for THIS specific trip only
      try {
        const trip = await fetchTripFromCloud(pendingJoin);
        if (trip) setPendingTrip(trip);

        const cloudMembers = await fetchTripMembersFromCloud(pendingJoin);
        const localMembers = await db.tripMembers.where('tripId').equals(pendingJoin).toArray();
        
        const combined = [...cloudMembers, ...localMembers];
        const uniqueMap = new Map<string, { id: string; name: string; email?: string }>();
        combined.forEach(m => {
          if (m.name && m.name.trim() && m.name !== 'User' && m.name !== 'Member' && m.isActive !== false) {
            uniqueMap.set(m.name.trim().toLowerCase(), { id: m.id, name: m.name.trim(), email: m.email });
          }
        });
        setExistingMembers(Array.from(uniqueMap.values()));
      } catch (err) {
        console.warn('Error loading trip members for invite:', err);
      }
    };

    loadKnownMembers();
  }, []);

  const handleSelectExistingMember = (member: { id: string; name: string; email?: string }) => {
    setGuestName(member.name);
    if (member.email && !member.email.endsWith('@whopaid.app')) {
      setGuestEmail(member.email);
    }
    setIsCustomName(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogleAuth();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain not authorized: Please add "ozlphrt.github.io" to Firebase Console -> Authentication -> Authorized domains.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Please allow popups in your browser settings and try Google Sign-In again.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err.message || 'Google sign-in could not be completed. You can also continue by entering your name below.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMsg('Please enter or select your name to continue.');
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
      padding: 'calc(24px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      maxWidth: 480,
      margin: '0 auto'
    }}>
      
      {/* Top Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <img 
          src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} 
          alt="WhoPaid" 
          className="animate-float-breath"
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            objectFit: 'cover',
            marginBottom: 12,
            cursor: 'default'
          }}
        />

        <h1 style={{
          fontSize: '1.95rem',
          fontWeight: 900,
          letterSpacing: '-0.035em',
          margin: '0 0 4px 0',
          color: 'var(--text-primary)'
        }}>
          WhoPaid
        </h1>

        <p style={{
          fontSize: '0.86rem',
          color: 'var(--text-secondary)',
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.4
        }}>
          {pendingTrip 
            ? `Joining ${pendingTrip.emoji || '✈️'} ${pendingTrip.name}`
            : 'Travel together. Split group bills without the awkward math.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '18px 0' }}>
        
        {/* Google Sign-in Button */}
        {isFirebaseActive && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 'var(--radius-xl)',
              background: '#ffffff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
              transition: 'transform 0.15s ease'
            }}
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" color="#1f2937" />
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        )}

        {/* Divider */}
        {isFirebaseActive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '2px 0'
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OR ENTER NAME
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
        )}

        {/* Main Onboarding Form */}
        <form onSubmit={handleSubmit} className="card" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 15,
          padding: '20px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 3px 0' }}>
              {existingMembers.length > 0 ? 'Who are you in this trip?' : 'Join with your Name'}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>
              {existingMembers.length > 0
                ? 'Select your existing profile or type a new name below.'
                : 'Enter your name to start tracking and splitting group travel expenses.'}
            </p>
          </div>

          {/* Existing Member Pills to avoid duplicate names */}
          {existingMembers.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>
                CHOOSE YOUR PROFILE
              </label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {existingMembers.map(m => {
                  const isSelected = guestName.trim().toLowerCase() === m.name.toLowerCase();
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectExistingMember(m)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                        color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        border: isSelected ? '1px solid var(--btn-primary-border)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{m.name}</span>
                      {isSelected && <Check size={13} />}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setGuestName('');
                    setGuestEmail('');
                    setIsCustomName(true);
                  }}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 'var(--radius-full)',
                    background: isCustomName ? 'var(--bg-elevated)' : 'transparent',
                    color: 'var(--text-tertiary)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    border: '1px dashed var(--border-strong)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <UserPlus size={12} />
                  <span>New person</span>
                </button>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
              YOUR NAME *
            </label>
            <input
              type="text"
              placeholder="e.g. Ozalp, Betül, Alex"
              value={guestName}
              onChange={e => {
                setGuestName(e.target.value);
                setIsCustomName(true);
              }}
              className="input-pill"
              required
              autoFocus={existingMembers.length === 0}
              style={{ fontSize: '0.94rem' }}
            />
          </div>

          {/* Email Input (Optional) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                EMAIL (OPTIONAL)
              </label>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)' }}>For cross-device sync</span>
            </div>
            <input
              type="email"
              placeholder="e.g. ozalph@gmail.com"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="input-pill"
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          {/* Preferred Currency */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
              DEFAULT CURRENCY
            </label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {POPULAR_CURRENCIES.map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setGuestCurrency(curr)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: guestCurrency === curr ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: guestCurrency === curr ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
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
            <div style={{ color: 'var(--negative-text)', fontSize: '0.8rem', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-primary"
            style={{
              marginTop: 4,
              padding: '13px 18px',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.92rem',
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
                <span>{pendingTrip ? `Join ${pendingTrip.name}` : 'Start Splitting'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security & Offline Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '0.74rem' }}>
          <ShieldCheck size={14} color="var(--brand-500, #10b981)" />
          <span>Encrypted storage • Offline capable • 1-Tap Google or Name</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          WhoPaid • v1.0.0
        </span>
      </div>

    </div>
  );
};
