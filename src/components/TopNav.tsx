import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { ChevronLeft, MoreVertical, Activity, User, Archive, Users, UserPlus, Sun, Moon } from 'lucide-react';
import { UserSwitcherModal } from './UserSwitcherModal';
import { QRCodeModal } from './QRCodeModal';

type ThemeMode = 'light' | 'dark';

interface TopNavProps {
  currentView: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';
  onNavigate: (view: 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile') => void;
}

export const TopNav: React.FC<TopNavProps> = ({ currentView, onNavigate }) => {
  const { activeTrip, currentUser, isOnline, expenses } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
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
      <header className="top-nav" style={{ padding: '12px 18px', gap: 10 }}>
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

          {/* Active User Avatar */}
          <button
            onClick={() => setShowUserSwitcher(true)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem'
            }}
            title="Switch user"
          >
            {currentUser.name.charAt(0)}
          </button>

          {/* Menu Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(prev => !prev)}
              className="nav-icon-btn"
              style={{ width: 30, height: 30 }}
              aria-label="Menu"
            >
              <MoreVertical size={15} />
            </button>

            {showMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  width: 190,
                  zIndex: 100,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={() => setShowMenu(false)}
              >
                <button
                  onClick={toggleTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  {currentTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                  <span>{currentTheme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>

                <button
                  onClick={() => onNavigate('activity')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <Activity size={15} color="var(--text-secondary)" />
                  <span>Activity History</span>
                </button>

                <button
                  onClick={() => onNavigate('archive')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <Archive size={15} color="var(--text-secondary)" />
                  <span>Archive & Deleted</span>
                </button>

                <button
                  onClick={() => onNavigate('profile')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <User size={15} color="var(--text-secondary)" />
                  <span>Profile Settings</span>
                </button>

                <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                <button
                  onClick={() => setShowUserSwitcher(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textAlign: 'left'
                  }}
                >
                  <Users size={15} color="var(--text-secondary)" />
                  <span>Switch User ({currentUser.name})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <UserSwitcherModal
        isOpen={showUserSwitcher}
        onClose={() => setShowUserSwitcher(false)}
      />

      <QRCodeModal
        trip={activeTrip}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
};
