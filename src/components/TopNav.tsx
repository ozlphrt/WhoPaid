import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ChevronLeft, Sun, Moon } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

interface TopNavProps {
  currentView: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';
  onNavigate: (view: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile') => void;
}

export const TopNav: React.FC<TopNavProps> = ({ currentView, onNavigate }) => {
  const { activeTrip, currentUser, isOnline, expenses, refreshData, syncWithCloud } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Theme state: defaults to dark, with one-tap toggle to light
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('whopaid_theme') as ThemeMode) || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('whopaid_theme', currentTheme);
  }, [currentTheme]);

  const toggleTheme = () => {
    setCurrentTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Full cloud sync – fetches shared trips from PostgreSQL, not just local DB.
      await syncWithCloud();
      // On standalone PWA, check for service worker updates
      if (import.meta.env.PROD && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
    } catch (err) {
      console.warn('Manual refresh warning:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleBack = () => {
    if (currentView === 'expenses' || currentView === 'balances' || currentView === 'settle' || currentView === 'report' || currentView === 'settings') {
      onNavigate('trip-home');
    } else {
      onNavigate('trips');
    }
  };

  const activeTripExpenses = expenses.filter(e => !e.isDeleted);

  const dynamicDateSubtitle = React.useMemo(() => {
    if (!activeTrip) return '';
    if (activeTripExpenses.length === 0) {
      return `Active · ${activeTrip.mainCurrency}`;
    }
    const timestamps = activeTripExpenses
      .map(e => new Date(e.date).getTime())
      .filter(t => !isNaN(t));

    if (timestamps.length === 0) return `${activeTrip.mainCurrency}`;

    const minD = new Date(Math.min(...timestamps));
    const maxD = new Date(Math.max(...timestamps));

    const sMonth = minD.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = maxD.toLocaleDateString('en-US', { month: 'short' });
    const sDay = minD.getDate();
    const eDay = maxD.getDate();

    if (sMonth === eMonth) {
      if (sDay === eDay) {
        return `${sMonth} ${sDay} · ${activeTrip.mainCurrency}`;
      }
      return `${sMonth} ${sDay}–${eDay} · ${activeTrip.mainCurrency}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay} · ${activeTrip.mainCurrency}`;
  }, [activeTripExpenses, activeTrip]);

  const getNavTitle = () => {
    switch (currentView) {
      case 'trips':
        return 'Trips';
      case 'expenses':
        return 'All Expenses';
      case 'balances':
        return 'Balances';
      case 'settle':
        return 'Settle Up';
      case 'report':
        return 'Trip Report';
      case 'settings':
        return 'Trip Settings';
      case 'activity':
        return 'Activity History';
      case 'archive':
        return 'Archive';
      case 'profile':
        return 'Profile';
      default:
        return '';
    }
  };

  return (
    <>
      <header
        className="top-nav"
        style={{
          paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          paddingBottom: '12px',
          paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
          gap: 10
        }}
      >
        {/* Left Side: Back Arrow + Trip Info / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {currentView !== 'trips' ? (
            <button onClick={handleBack} className="nav-icon-btn" aria-label="Go back" style={{ width: 34, height: 34, flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </button>
          ) : (
            <img 
              src={`${import.meta.env.BASE_URL}cards-logo.png`} 
              alt="WhoPaid" 
              style={{
                height: 42,
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.16))'
              }}
            />
          )}

          {currentView === 'trips' ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontSize: '1.18rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)'
              }}>
                WhoPaid
              </span>
            </div>
          ) : currentView === 'trip-home' && activeTrip ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <h1 style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2
              }}>
                {activeTrip.name}
              </h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                {dynamicDateSubtitle}
              </span>
            </div>
          ) : (
            <div className="top-nav-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              <span>{getNavTitle()}</span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="nav-actions" style={{ flexShrink: 0, gap: 8, alignItems: 'center' }}>
          {/* Instant Sync / Refresh Label Button */}
          <button
            onClick={handleManualRefresh}
            style={{
              height: 32,
              padding: '0 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: isRefreshing ? 'var(--brand-500, #10b981)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease'
            }}
            title="Sync & Refresh Data"
            aria-label="Sync Data"
          >
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="nav-icon-btn"
            style={{ width: 32, height: 32 }}
            title={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle theme"
          >
            {currentTheme === 'light' ? (
              <Moon size={16} />
            ) : (
              <Sun size={16} />
            )}
          </button>

          {/* User Profile Pill with Full Name */}
          <button
            onClick={() => onNavigate('profile')}
            style={{
              height: 32,
              padding: '0 10px 0 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease'
            }}
            title="Profile & Settings"
            aria-label="Profile"
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 'var(--radius-full)',
              background: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.68rem',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                currentUser.name.charAt(0).toUpperCase()
              )}
            </div>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              maxWidth: 90,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-primary)'
            }}>
              {currentUser.name}
            </span>
          </button>
        </div>
      </header>
    </>
  );
};
