import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { TopNav } from './components/TopNav';
import { TripsHome } from './screens/Home/TripsHome';
import { TripHome } from './screens/Trip/TripHome';
import { ExpenseList } from './screens/Trip/ExpenseList';
import { Balances } from './screens/Trip/Balances';
import { Settle } from './screens/Trip/Settle';
import { Report } from './screens/Trip/Report';
import { TripSettings } from './screens/Trip/TripSettings';
import { ActivityScreen } from './screens/Activity/ActivityScreen';
import { ArchiveScreen } from './screens/Archive/ArchiveScreen';
import { ProfileScreen } from './screens/Profile/ProfileScreen';
import { UndoToast } from './components/UndoToast';
import './styles/global.css';
import './styles/components.css';

type AppView = 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';

const AppContent: React.FC = () => {
  const { activeTrip, setActiveTripId } = useApp();
  const [currentView, setCurrentView] = useState<AppView>('trip-home');

  // Handle invitation URL if query params exist (?tripId=...&code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinTripId = params.get('tripId');
    if (joinTripId) {
      setActiveTripId(joinTripId);
      setCurrentView('trip-home');
      window.history.replaceState({}, '', '/');
    }
  }, [setActiveTripId]);

  const handleSelectTrip = (tripId: string) => {
    setActiveTripId(tripId);
    setCurrentView('trip-home');
  };

  return (
    <div className="app-container">
      <TopNav
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
      />

      <main style={{ flex: 1 }}>
        {currentView === 'trips' && (
          <TripsHome
            onSelectTrip={handleSelectTrip}
            onOpenArchive={() => setCurrentView('archive')}
          />
        )}

        {currentView === 'trip-home' && (
          <TripHome
            onNavigateTab={(tab) => setCurrentView(tab)}
          />
        )}

        {currentView === 'expenses' && <ExpenseList />}
        {currentView === 'balances' && <Balances />}
        {currentView === 'settle' && <Settle />}
        {currentView === 'report' && <Report />}
        {currentView === 'settings' && <TripSettings />}
        {currentView === 'activity' && <ActivityScreen />}
        {currentView === 'archive' && <ArchiveScreen onSelectTrip={handleSelectTrip} />}
        {currentView === 'profile' && <ProfileScreen />}
      </main>

      <UndoToast />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
