import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode, Trip, TripMember } from '../../types';
import { ArrowRight, ShieldCheck, Loader2, Check, UserPlus, Sparkles } from 'lucide-react';
import { loginAnonymously } from '../../lib/firebase';
import { syncUserToCloud, fetchTripFromCloud, fetchTripMembersFromCloud } from '../../lib/firestoreSync';
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
      padding: 'calc(28px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
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
            width: 72,
            height: 72,
            borderRadius: 22,
            objectFit: 'cover',
            marginBottom: 14,
            cursor: 'default'
          }}
        />

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 900,
          letterSpacing: '-0.035em',
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
            ? `Joining ${pendingTrip.emoji || '✈️'} ${pendingTrip.name}`
            : 'Travel together. Split group bills without the awkward math.'}
        </p>
      </div>

      {/* Main Onboarding Form */}
      <form onSubmit={handleSubmit} className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: '20px 0',
        padding: '22px',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0' }}>
            {existingMembers.length > 0 ? 'Who are you in this trip?' : 'Welcome to WhoPaid'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: 0 }}>
            {existingMembers.length > 0
              ? 'Select your existing profile or type a new name below.'
              : 'Enter your name to start tracking and splitting group travel expenses.'}
          </p>
        </div>

        {/* Existing Member Pills to avoid duplicate names */}
        {existingMembers.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
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
                      padding: '7px 13px',
                      borderRadius: 'var(--radius-full)',
                      background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                      color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
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
                    {isSelected && <Check size={14} />}
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
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: isCustomName ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text-tertiary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  border: '1px dashed var(--border-strong)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <UserPlus size={13} />
                <span>New person</span>
              </button>
            </div>
          </div>
        )}

        {/* Name Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
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
            style={{ fontSize: '0.98rem' }}
          />
        </div>

        {/* Email Input (Optional) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              EMAIL (OPTIONAL)
            </label>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>For cross-device sync</span>
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
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
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
              <span>{pendingTrip ? `Join ${pendingTrip.name}` : 'Get Started'}</span>
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
