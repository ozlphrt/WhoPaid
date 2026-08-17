import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Archive, Trash2, RotateCcw, Calendar, ChevronRight } from 'lucide-react';

interface ArchiveScreenProps {
  onSelectTrip: (tripId: string) => void;
}

export const ArchiveScreen: React.FC<ArchiveScreenProps> = ({ onSelectTrip }) => {
  const { archivedTrips, deletedTrips, restoreTrip, permanentlyDeleteTrip } = useApp();
  const [activeTab, setActiveTab] = useState<'archived' | 'deleted'>('archived');

  const getDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const diffMs = Date.now() - new Date(deletedAt).getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysPassed);
  };

  const handlePermanentDelete = async (tripId: string, name: string) => {
    if (window.confirm(`Permanently delete "${name}"? This action cannot be undone and all data will be erased.`)) {
      await permanentlyDeleteTrip(tripId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Trip Archive</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          Closed and recently deleted trips
        </span>
      </div>

      {/* Segment Tab */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('archived')}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.82rem',
            background: activeTab === 'archived' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'archived' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: activeTab === 'archived' ? 'var(--shadow-sm)' : 'none'
          }}
        >
          Closed Trips ({archivedTrips.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deleted')}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.82rem',
            background: activeTab === 'deleted' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'deleted' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: activeTab === 'deleted' ? 'var(--shadow-sm)' : 'none'
          }}
        >
          Recently Deleted ({deletedTrips.length})
        </button>
      </div>

      {/* Tab 1: Closed Trips */}
      {activeTab === 'archived' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {archivedTrips.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '0.85rem'
            }}>
              No closed trips in archive.
            </div>
          ) : (
            archivedTrips.map(trip => (
              <div
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: '0.98rem' }}>{trip.name}</strong>
                    <span style={{ fontSize: '0.68rem', background: 'var(--bg-subtle)', color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Closed
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {trip.startDate} – {trip.endDate} · {trip.mainCurrency}
                  </span>
                </div>
                <ChevronRight size={16} color="var(--text-tertiary)" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Recently Deleted Trips */}
      {activeTab === 'deleted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deletedTrips.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: '0.85rem'
            }}>
              No recently deleted trips.
            </div>
          ) : (
            deletedTrips.map(trip => {
              const daysLeft = getDaysRemaining(trip.deletedAt);

              return (
                <div
                  key={trip.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '14px 16px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.95rem', display: 'block' }}>{trip.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--negative-text)', fontWeight: 600 }}>
                      {daysLeft} days remaining before permanent deletion
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                    <button
                      onClick={() => restoreTrip(trip.id)}
                      className="btn-secondary"
                      style={{ padding: '7px 10px', fontSize: '0.78rem' }}
                    >
                      <RotateCcw size={13} />
                      <span>Restore</span>
                    </button>

                    <button
                      onClick={() => handlePermanentDelete(trip.id, trip.name)}
                      className="btn-danger"
                      style={{ padding: '7px 10px', fontSize: '0.78rem' }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Forever</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
