import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ChevronLeft, UserPlus, Sun, Moon } from 'lucide-react';
import { QRCodeModal } from './QRCodeModal';

type ThemeMode = 'light' | 'dark';

interface TopNavProps {
  currentView: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';
  onNavigate: (view: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile') => void;
}

export const TopNav: React.FC<TopNavProps> = ({ currentView, onNavigate }) => {
  const { activeTrip, currentUser, isOnline, expenses } = useApp();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  // Theme state: defaults to light, with one-tap toggle to dark
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('whopaid_theme') as ThemeMode) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('whopaid_theme', currentTheme);
  }, [currentTheme]);

  const toggleTheme = () => {
    setCurrentTheme(prev => prev === 'light' ? 'dark' : 'light');
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
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              flexShrink: 0
            }}>
              W
            </div>
          )}

          {currentView === 'trip-home' && activeTrip ? (
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
          {/* Small Clean LED Status Dot (Replaces text pill) */}
          <div
            title={isOnline ? "Cloud Sync Active" : "Offline Mode (Local Storage)"}
            style={{
              width: 8,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: isOnline ? '#10b981' : '#f59e0b',
              boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : '0 0 6px rgba(245, 158, 11, 0.6)',
              marginRight: 2
            }}
          />

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

          {/* Direct Invite Button on Trip Home */}
          {currentView === 'trip-home' && activeTrip && (
            <button
              onClick={() => setIsInviteOpen(true)}
              className="nav-icon-btn"
              style={{ width: 32, height: 32 }}
              title="Invite Friends"
            >
              <UserPlus size={15} />
            </button>
          )}

          {/* User Profile Avatar */}
          <button
            onClick={() => onNavigate('profile')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              background: 'var(--brand-600, #10b981)',
              border: '2px solid var(--border-subtle)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.8rem',
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0
            }}
            title="Profile & Account"
            aria-label="Profile"
          >
            {currentUser.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              currentUser.name.charAt(0).toUpperCase()
            )}
          </button>
        </div>
      </header>

      <QRCodeModal
        trip={activeTrip}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
};
