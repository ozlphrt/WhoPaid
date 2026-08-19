import React, { useState, useEffect, Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
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

  handleReset = () => {
    localStorage.clear();
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
            Reset local cache & reload
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
  const { activeTrip, setActiveTripId, isInitialized, isAuthenticated, currentUser, joinTrip } = useApp();

  // Start from 'trips' overview screen, or resume where user left off if an active trip is open
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const savedTrip = localStorage.getItem('whopaid_active_trip');
    const savedView = localStorage.getItem('whopaid_last_view') as AppView;
    if (savedTrip && savedView && savedView !== 'trips') {
      return savedView;
    }
    return 'trips';
  });

  const handleNavigate = (view: AppView) => {
    setCurrentView(view);
    localStorage.setItem('whopaid_last_view', view);
  };

  // If no active trip is selected, always show Trips Home
  useEffect(() => {
    if (!activeTrip && currentView !== 'trips' && currentView !== 'profile' && currentView !== 'archive') {
      setCurrentView('trips');
      localStorage.setItem('whopaid_last_view', 'trips');
    }
  }, [activeTrip, currentView]);

  // Handle invitation URL if query params exist (?join=... or ?tripId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinTripId = params.get('join') || params.get('tripId');
    if (joinTripId && isAuthenticated) {
      joinTrip(joinTripId);
      handleNavigate('trip-home');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isAuthenticated, joinTrip]);

  const handleSelectTrip = (tripId: string) => {
    setActiveTripId(tripId);
    handleNavigate('trip-home');
  };

  if (!isInitialized) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        gap: 14
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 16,
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          💳
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          WhoPaid
        </div>
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
