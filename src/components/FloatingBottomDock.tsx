import React from 'react';
import { AppView } from '../types';
import { Receipt, PieChart, HandCoins, Settings, User } from 'lucide-react';

interface FloatingBottomDockProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const FloatingBottomDock: React.FC<FloatingBottomDockProps> = ({
  currentView,
  onNavigate
}) => {
  return (
    <nav className="floating-bottom-dock" aria-label="Trip Navigation">
      <button
        type="button"
        onClick={() => onNavigate('expenses')}
        className={`dock-tab-btn ${currentView === 'expenses' ? 'active' : ''}`}
        aria-label="All Expenses"
      >
        <Receipt size={18} />
        <span>Expenses</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate('report')}
        className={`dock-tab-btn ${currentView === 'report' ? 'active' : ''}`}
        aria-label="Trip Summary"
      >
        <PieChart size={18} />
        <span>Summary</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate('settle')}
        className={`dock-tab-btn ${currentView === 'settle' ? 'active' : ''}`}
        aria-label="Settle Up"
      >
        <HandCoins size={18} />
        <span>Settle Up</span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate('settings')}
        className={`dock-tab-btn ${currentView === 'settings' ? 'active' : ''}`}
        aria-label="Trip Settings"
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </nav>
  );
};
