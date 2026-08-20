import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { TopNav } from './components/TopNav';
import { TripsHome } from './screens/Home/TripsHome';
import { TripHome } from './screens/Trip/TripHome';
import { ExpenseList } from './screens/Trip/ExpenseList';
import { Balances } from './screens/Trip/Balances';
import { Settle } from './screens/Trip/Settle';
import { ProfileScreen } from './screens/Profile/ProfileScreen';
import { AuthScreen } from './screens/Auth/AuthScreen';
import { UndoToast } from './components/UndoToast';
import { db } from './lib/db';
import './styles/global.css';
import './styles/components.css';

const Report = lazy(() => import('./screens/Trip/Report').then(m => ({ default: m.Report })));
const TripSettings = lazy(() => import('./screens/Trip/TripSettings').then(m => ({ default: m.TripSettings })));
const ActivityScreen = lazy(() => import('./screens/Activity/ActivityScreen').then(m => ({ default: m.ActivityScreen })));
const ArchiveScreen = lazy(() => import('./screens/Archive/ArchiveScreen').then(m => ({ default: m.ArchiveScreen })));

type AppView = 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WhoPaid App caught error:', error, errorInfo);
  }

  handleReset = async () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('whopaid_')) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('whopaid_')) sessionStorage.removeItem(key);
    }
    await db.delete();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          background: '#101217',
          color: '#f8fafc',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💳</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 320, marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              borderRadius: '9999px',
              background: '#ffffff',
              color: '#101217',
              fontWeight: 800,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 10
            }}
          >
            Reload App
          </button>
          <button
            onClick={this.handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.78rem',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Reset WhoPaid device data & reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { FloatingBottomDock } from './components/FloatingBottomDock';

interface AppContentProps {}

const AppContent: React.FC<AppContentProps> = () => {
  const {
    activeTrip,
    setActiveTripId,
    isInitialized,
    isAuthenticated,
    currentUser,
    joinTrip,
    showAlert,
    startupStatus
  } = useApp();
  const joiningTripRef = useRef<string | null>(null);

  // Start from 'trips' overview screen, or resume where user left off if an active trip is open (never resume into profile)
  const [currentView, setCurrentView] = useState<AppView>(() => {
    // Clear any stale profile view from previous session
    if (localStorage.getItem('whopaid_last_view') === 'profile') {
      localStorage.removeItem('whopaid_last_view');
    }
    const savedTrip = localStorage.getItem('whopaid_active_trip');
    const savedView = localStorage.getItem('whopaid_last_view') as AppView;
    if (savedTrip && savedView && savedView !== 'trips' && savedView !== 'profile') {
      return savedView;
    }
    return 'trips';
  });

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    if (view !== 'profile') {
      localStorage.setItem('whopaid_last_view', view);
    }
  };

  // If no active trip is selected, always reset view to trips (never remain on profile)
  useEffect(() => {
    const savedTrip = localStorage.getItem('whopaid_active_trip');
    if (isInitialized && !activeTrip && !savedTrip && currentView !== 'trips' && currentView !== 'archive') {
      setCurrentView('trips');
      localStorage.setItem('whopaid_last_view', 'trips');
    }
  }, [activeTrip, isInitialized]);

  // When user authenticates, ensure they land directly on trips
  useEffect(() => {
    if (isAuthenticated && currentView === 'profile') {
      setCurrentView('trips');
      localStorage.setItem('whopaid_last_view', 'trips');
    }
  }, [isAuthenticated]);

  // Handle invitation URL if query params exist (?join=... or ?tripId=...)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    
    const urlJoinId = searchParams.get('join') || searchParams.get('tripId') || hashParams.get('join') || hashParams.get('tripId');
    if (urlJoinId) {
      sessionStorage.setItem('whopaid_pending_join', urlJoinId);
      localStorage.setItem('whopaid_pending_join', urlJoinId);
    }

    const pendingJoin = urlJoinId || sessionStorage.getItem('whopaid_pending_join') || localStorage.getItem('whopaid_pending_join');
    if (pendingJoin && isAuthenticated && joiningTripRef.current !== pendingJoin) {
      joiningTripRef.current = pendingJoin;
      joinTrip(pendingJoin)
        .then(() => {
          sessionStorage.removeItem('whopaid_pending_join');
          localStorage.removeItem('whopaid_pending_join');
          setCurrentView('trip-home');
          localStorage.setItem('whopaid_last_view', 'trip-home');
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'The trip could not be joined.';
          showAlert(message, 'Could not join trip', 'warning');
        });
    }
  }, [isAuthenticated, joinTrip, showAlert]);

  const handleSelectTrip = (tripId: string) => {
    setActiveTripId(tripId);
    handleNavigate('trip-home');
  };

  if (!isInitialized) {
    return (
      <div className="startup-screen" role="status" aria-live="polite">
        <h1 className="startup-wordmark">WhoPaid</h1>
        <div className="startup-ring is-indeterminate" aria-hidden="true">
          <span>•••</span>
        </div>
        <div className="startup-copy">
          <h2>Opening WhoPaid</h2>
          <p>{startupStatus.message}</p>
        </div>
        <span className="startup-hint">Saved data opens first. Cloud updates continue in the background.</span>
      </div>
    );
  }

  // If not signed in, show Auth Gate
  if (!isAuthenticated || !currentUser) {
    return <AuthScreen />;
  }

  const showTripDock = Boolean(
    activeTrip && 
    currentView !== 'trips' && 
    currentView !== 'archive' && 
    currentView !== 'profile'
  );

  return (
    <div className="app-container">
      <TopNav
        currentView={currentView}
        onNavigate={handleNavigate}
      />

      <main style={{ flex: 1, paddingBottom: showTripDock ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-tertiary)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading...</span>
          </div>
        }>
          {(!activeTrip || currentView === 'trips') && (
            <TripsHome
              onSelectTrip={handleSelectTrip}
              onOpenArchive={() => handleNavigate('archive')}
            />
          )}

          {activeTrip && currentView === 'trip-home' && (
            <TripHome
              onNavigateTab={(tab) => handleNavigate(tab)}
            />
          )}

          {activeTrip && currentView === 'expenses' && <ExpenseList />}
          {activeTrip && currentView === 'balances' && <Balances />}
          {activeTrip && currentView === 'settle' && <Settle />}
          {activeTrip && currentView === 'report' && <Report />}
          {activeTrip && currentView === 'settings' && <TripSettings />}
          {currentView === 'activity' && <ActivityScreen />}
          {currentView === 'archive' && <ArchiveScreen onSelectTrip={handleSelectTrip} />}
          {currentView === 'profile' && <ProfileScreen />}
        </Suspense>
      </main>

      {showTripDock && (
        <FloatingBottomDock
          currentView={currentView}
          onNavigate={handleNavigate}
        />
      )}

      {startupStatus.phase === 'syncing-cloud' && (
        <div
          className="sync-progress-overlay"
          role="status"
          aria-live="polite"
        >
          <h1 className="sync-progress-wordmark">WhoPaid</h1>
          <div
            className={`sync-progress-ring${startupStatus.indeterminate ? ' is-indeterminate' : ''}`}
            role="progressbar"
            aria-label="Trip synchronization"
            aria-valuemin={0}
            aria-valuemax={100}
            {...(!startupStatus.indeterminate ? { 'aria-valuenow': startupStatus.progress } : {})}
            style={{ '--sync-progress': `${startupStatus.progress * 3.6}deg` } as React.CSSProperties}
          >
            <div className="sync-progress-value">
              {startupStatus.indeterminate ? <span>•••</span> : <strong>{startupStatus.progress}%</strong>}
            </div>
          </div>
          <div className="sync-progress-copy">
            <h2>Syncing your trips</h2>
            <p>{startupStatus.message}</p>
            <span>Your saved trips are already available on this device.</span>
          </div>
          <p className="sync-progress-footer">Keep WhoPaid open for a moment. Sync will continue automatically.</p>
        </div>
      )}

      {startupStatus.phase === 'error' && (
        <div className="sync-error-notice" role="status" aria-live="polite">
          <strong>Saved data is ready</strong>
          <span>{startupStatus.message}</span>
        </div>
      )}

      <UndoToast />
    </div>
  );
};

export function App() {
  return (
    <GlobalErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
