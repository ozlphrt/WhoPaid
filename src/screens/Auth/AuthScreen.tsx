import React, { useState } from 'react';
import { PENDING_INVITE_KEY, readInviteToken } from '../../lib/invite';
import { useApp } from '../../store/AppContext';
import { ShieldCheck, Loader2, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { 
    loginWithGoogleAuth,
    loginWithEmailAuth,
    signUpWithEmailAuth,
    isFirebaseActive 
  } = useApp();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [hasPendingInvite] = useState(() => {
    return Boolean(
      readInviteToken(window.location.href) ||
      sessionStorage.getItem(PENDING_INVITE_KEY) ||
      localStorage.getItem(PENDING_INVITE_KEY)
    );
  });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogleAuth();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg(`Domain not authorized: Please add "${window.location.hostname}" to Firebase Console → Authentication → Settings → Authorized domains.`);
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMsg('Please allow popups in your browser settings and try Google Sign-In again.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err.message || 'Google sign-in could not be completed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    if (authMode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    setEmailLoading(true);
    setErrorMsg(null);
    try {
      if (authMode === 'signin') {
        await loginWithEmailAuth(email, password);
      } else {
        await signUpWithEmailAuth(email, password, name);
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password sign-in is not enabled yet in your Firebase Console. Go to Authentication -> Sign-in method -> Email/Password -> Enable.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Incorrect email or password. If you are new, please click "Create Account".');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Please switch to "Sign In".');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials and try again.');
      }
    } finally {
      setEmailLoading(false);
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
      maxWidth: 440,
      margin: '0 auto'
    }}>
      
      {/* Top Brand Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 6 }}>
        <img 
          src={`${import.meta.env.BASE_URL}cards-logo.png`} 
          alt="WhoPaid" 
          className="animate-float-breath"
          style={{
            height: 74,
            width: 'auto',
            objectFit: 'contain',
            marginBottom: 8,
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.22))'
          }}
        />

        <h1 style={{
          fontSize: '1.95rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          margin: '0 0 3px 0',
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
          {hasPendingInvite
            ? 'Sign in to securely accept your trip invitation.'
            : 'Travel together. Split group bills without the awkward math.'}
        </p>
      </div>

      {/* Middle Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '16px 0' }}>
        
        {/* 1-Tap Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || emailLoading}
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

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '2px 0'
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            OR WITH ANY EMAIL
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Email/Password Card */}
        <div className="card" style={{
          padding: '18px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
          
          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 3
          }} role="group" aria-label="Authentication mode">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMsg(null);
              }}
              aria-pressed={authMode === 'signin'}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: authMode === 'signin' ? 'var(--bg-elevated)' : 'transparent',
                color: authMode === 'signin' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: authMode === 'signin' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMsg(null);
              }}
              aria-pressed={authMode === 'signup'}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: authMode === 'signup' ? 'var(--bg-elevated)' : 'transparent',
                color: authMode === 'signup' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: authMode === 'signup' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            
            {/* Name Input (Sign Up Only) */}
            {authMode === 'signup' && (
              <div>
                <label htmlFor="auth-name" style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                  YOUR FULL NAME *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <UserIcon size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14 }} />
                  <input
                    id="auth-name"
                    autoComplete="name"
                    type="text"
                    placeholder="e.g. Sarah Connor"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="input-pill"
                    required
                    style={{ paddingLeft: 40, fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                EMAIL ADDRESS *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14 }} />
                <input
                  id="auth-email"
                  autoComplete="email"
                  type="email"
                  placeholder="e.g. sarah@hotmail.com, outlook, etc."
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-pill"
                  required
                  style={{ paddingLeft: 40, fontSize: '0.9rem' }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="auth-password" style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
                PASSWORD *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14 }} />
                <input
                  id="auth-password"
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-pill"
                  required
                  minLength={6}
                  style={{ paddingLeft: 40, fontSize: '0.9rem' }}
                />
              </div>
            </div>

            {errorMsg && (
              <div role="alert" style={{ color: 'var(--negative-text)', fontSize: '0.78rem', fontWeight: 600, marginTop: 2 }}>
                {errorMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={emailLoading || googleLoading}
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
              {emailLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* Security & Cloud Badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: '0.74rem' }}>
          <ShieldCheck size={14} color="var(--brand-500, #10b981)" />
          <span>Secure sign-in • Private trip access • Cloud backup</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
          WhoPaid • v1.3.5
        </span>
      </div>

    </div>
  );
};
