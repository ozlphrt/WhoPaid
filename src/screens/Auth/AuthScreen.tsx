import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { Trip } from '../../types';
import { ShieldCheck, Loader2, Users } from 'lucide-react';
import { fetchTripFromCloud, fetchTripMembersFromCloud } from '../../lib/firestoreSync';

export const AuthScreen: React.FC = () => {
  const { 
    loginWithGoogleAuth,
    loginWithAppleAuth,
    loginWithMicrosoftAuth,
    loginWithFacebookAuth,
    isFirebaseActive 
  } = useApp();

  const [activeLoadingProvider, setActiveLoadingProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingTrip, setPendingTrip] = useState<Trip | null>(null);
  const [existingMembers, setExistingMembers] = useState<{ id: string; name: string }[]>([]);

  // Discover pending trip info if arrived via invite link or QR code
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const pendingJoin = searchParams.get('join') ||
      searchParams.get('tripId') ||
      hashParams.get('join') ||
      hashParams.get('tripId') ||
      sessionStorage.getItem('whopaid_pending_join') ||
      localStorage.getItem('whopaid_pending_join');

    const loadTripPreview = async () => {
      if (!pendingJoin) return;
      try {
        const trip = await fetchTripFromCloud(pendingJoin);
        if (trip) setPendingTrip(trip);

        const cloudMembers = await fetchTripMembersFromCloud(pendingJoin);
        const uniqueNames = new Set<string>();
        const membersList: { id: string; name: string }[] = [];
        cloudMembers.forEach(m => {
          if (m.name && m.name.trim() && m.name !== 'User' && m.name !== 'Member' && !uniqueNames.has(m.name.toLowerCase())) {
            uniqueNames.add(m.name.toLowerCase());
            membersList.push({ id: m.id, name: m.name.trim() });
          }
        });
        setExistingMembers(membersList);
      } catch (err) {
        console.warn('Error loading trip preview for invite:', err);
      }
    };

    loadTripPreview();
  }, []);

  const handleSocialAuth = async (provider: 'google' | 'apple' | 'microsoft' | 'facebook') => {
    setActiveLoadingProvider(provider);
    setErrorMsg(null);
    try {
      if (provider === 'google') await loginWithGoogleAuth();
      else if (provider === 'apple') await loginWithAppleAuth();
      else if (provider === 'microsoft') await loginWithMicrosoftAuth();
      else if (provider === 'facebook') await loginWithFacebookAuth();
    } catch (err: any) {
      console.error(`${provider} Sign In Error:`, err);
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain not authorized: Please add "ozlphrt.github.io" to Firebase Console -> Authentication -> Authorized domains.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Please allow popups in your browser settings and try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled in Firebase Console. Please sign in with Google or enable this provider.`);
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err.message || `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in could not be completed. Please try again.`);
      }
    } finally {
      setActiveLoadingProvider(null);
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
      maxWidth: 440,
      margin: '0 auto'
    }}>
      
      {/* Top Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <img 
          src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} 
          alt="WhoPaid" 
          className="animate-float-breath"
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            objectFit: 'cover',
            marginBottom: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
          }}
        />

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          margin: '0 0 4px 0',
          color: 'var(--text-primary)'
        }}>
          WhoPaid
        </h1>

        <p style={{
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.4
        }}>
          {pendingTrip 
            ? `You've been invited to join ${pendingTrip.emoji || '✈️'} ${pendingTrip.name}`
            : 'Travel together. Split group bills without the awkward math.'}
        </p>
      </div>

      {/* Middle Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '20px 0' }}>
        
        {/* Pending Trip Invite Card (if joining via link) */}
        {pendingTrip && (
          <div className="card" style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.5rem' }}>{pendingTrip.emoji || '✈️'}</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                  {pendingTrip.name}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  Main Currency: {pendingTrip.mainCurrency}
                </span>
              </div>
            </div>

            {existingMembers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                <Users size={13} color="var(--text-tertiary)" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Traveling with: <strong>{existingMembers.map(m => m.name).join(', ')}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Social Login Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          
          {/* Google */}
          <button
            type="button"
            onClick={() => handleSocialAuth('google')}
            disabled={activeLoadingProvider !== null}
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
              transition: 'all 0.15s ease'
            }}
          >
            {activeLoadingProvider === 'google' ? (
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

          {/* Apple */}
          <button
            type="button"
            onClick={() => handleSocialAuth('apple')}
            disabled={activeLoadingProvider !== null}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 'var(--radius-xl)',
              background: '#000000',
              color: '#ffffff',
              border: '1px solid #27272a',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease'
            }}
          >
            {activeLoadingProvider === 'apple' ? (
              <Loader2 size={18} className="animate-spin" color="#ffffff" />
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 5.05c.66-.82 1.11-1.96.99-3.05-1 .04-2.16.66-2.84 1.46-.59.69-1.11 1.83-.97 2.92 1.12.09 2.16-.51 2.82-1.33z"/>
                </svg>
                <span>Continue with Apple</span>
              </>
            )}
          </button>

          {/* Microsoft / Hotmail */}
          <button
            type="button"
            onClick={() => handleSocialAuth('microsoft')}
            disabled={activeLoadingProvider !== null}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 'var(--radius-xl)',
              background: '#2f2f2f',
              color: '#ffffff',
              border: '1px solid #444444',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease'
            }}
          >
            {activeLoadingProvider === 'microsoft' ? (
              <Loader2 size={18} className="animate-spin" color="#ffffff" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 21 21">
                  <path fill="#f25022" d="M1 1h9v9H1z"/>
                  <path fill="#00a4ef" d="M1 11h9v9H1z"/>
                  <path fill="#7fba00" d="M11 1h9v9h-9z"/>
                  <path fill="#ffb900" d="M11 11h9v9h-9z"/>
                </svg>
                <span>Continue with Microsoft / Hotmail</span>
              </>
            )}
          </button>

          {/* Facebook */}
          <button
            type="button"
            onClick={() => handleSocialAuth('facebook')}
            disabled={activeLoadingProvider !== null}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 'var(--radius-xl)',
              background: '#1877F2',
              color: '#ffffff',
              border: '1px solid #166fe5',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(24,119,242,0.2)',
              transition: 'all 0.15s ease'
            }}
          >
            {activeLoadingProvider === 'facebook' ? (
              <Loader2 size={18} className="animate-spin" color="#ffffff" />
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Continue with Facebook</span>
              </>
            )}
          </button>

        </div>

        {errorMsg && (
          <div style={{ color: 'var(--negative-text)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center', padding: '0 6px' }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Security & Cloud Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '0.74rem' }}>
          <ShieldCheck size={14} color="var(--brand-500, #10b981)" />
          <span>OAuth 2.0 Secure • Automatic Cloud Backup</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          WhoPaid • v1.0.0
        </span>
      </div>

    </div>
  );
};
