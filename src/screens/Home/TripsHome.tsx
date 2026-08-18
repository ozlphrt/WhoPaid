import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { formatMoney } from '../../lib/decimal';
import { Plus, Calendar, ChevronRight, Archive } from 'lucide-react';
import { CreateTripModal } from '../../components/CreateTripModal';

interface TripsHomeProps {
  onSelectTrip: (tripId: string) => void;
  onOpenArchive: () => void;
}

export const TripsHome: React.FC<TripsHomeProps> = ({ onSelectTrip, onOpenArchive }) => {
  const { trips, currentUser } = useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const activeTrips = trips.filter(t => !t.isClosed && !t.isDeleted);

  const formatDateRange = (startStr: string, endStr: string, currency: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
      const sDay = s.getDate();
      const eDay = e.getDate();
      return `${sMonth} ${sDay}–${eDay} · ${currency}`;
    } catch {
      return `${startStr} – ${endStr} · ${currency}`;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            OVERVIEW
          </span>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '2px 0 0 0' }}>
            My Trips
          </h1>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 14px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)' }}
        >
          <Plus size={15} />
          <span>New Trip</span>
        </button>
      </div>

      {/* Active Trips Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Active Trips</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{activeTrips.length} active</span>
        </div>

        {activeTrips.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>No active trips</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 260 }}>
              Start a new trip with your group to track shared travel spending.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary"
              style={{ width: 'auto', marginTop: 4 }}
            >
              <Plus size={15} />
              <span>Create Trip</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTrips.map(trip => (
              <div
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '16px 18px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trip.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    <Calendar size={13} />
                    <span>{formatDateRange(trip.startDate, trip.endDate, trip.mainCurrency)}</span>
                  </div>
                </div>

                <ChevronRight size={18} color="var(--text-tertiary)" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive Quick Access */}
      <button
        onClick={onOpenArchive}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          marginTop: 4,
          color: 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Archive size={16} />
          <span>Archived & Closed Trips</span>
        </div>
        <ChevronRight size={16} color="var(--text-tertiary)" />
      </button>

      <CreateTripModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
