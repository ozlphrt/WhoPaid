import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { formatMoney } from '../../lib/decimal';
import { db } from '../../lib/db';
import { calculateParticipantBalances } from '../../lib/balances';
import { Plus, Calendar, ChevronRight, Archive, Trash2 } from 'lucide-react';
import { CreateTripModal } from '../../components/CreateTripModal';

interface TripsHomeProps {
  onSelectTrip: (tripId: string) => void;
  onOpenArchive: () => void;
}

export const TripsHome: React.FC<TripsHomeProps> = ({ onSelectTrip, onOpenArchive }) => {
  const { trips, currentUser, clearAllData, showConfirm } = useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tripBalances, setTripBalances] = useState<Record<string, { net: number; hasExpenses: boolean }>>({});

  const activeTrips = trips.filter(t => !t.isClosed && !t.isDeleted);

  useEffect(() => {
    let isMounted = true;

    const loadAllTripBalances = async () => {
      const results: Record<string, { net: number; hasExpenses: boolean }> = {};
      for (const trip of activeTrips) {
        const tripMems = await db.tripMembers.where('tripId').equals(trip.id).toArray();
        const tripExps = await db.expenses.where('tripId').equals(trip.id).toArray();
        const tripSettlements = await db.settlements.where('tripId').equals(trip.id).toArray();
        const tripHouseholds = await db.households.where('tripId').equals(trip.id).toArray();

        const activeExps = tripExps.filter(e => !e.isDeleted);
        const b = calculateParticipantBalances(tripMems, tripExps, tripSettlements, tripHouseholds);
        const myBal = b.individualBalances.find(ib => ib.userId === currentUser.id);
        results[trip.id] = {
          net: myBal ? myBal.net : 0,
          hasExpenses: activeExps.length > 0
        };
      }
      if (isMounted) {
        setTripBalances(results);
      }
    };

    loadAllTripBalances();

    return () => {
      isMounted = false;
    };
  }, [activeTrips, currentUser.id]);

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
            {activeTrips.map(trip => {
              const tripBal = tripBalances[trip.id];
              const isOwed = tripBal?.hasExpenses && tripBal.net > 0.009;
              const owes = tripBal?.hasExpenses && tripBal.net < -0.009;
              const isOwner = trip.ownerId === currentUser.id;

              return (
                <div
                  key={trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    padding: '16px 18px',
                    gap: 12
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {trip.name}
                      </h3>
                      {isOwner ? (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-strong)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          flexShrink: 0
                        }}>
                          Owner
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          flexShrink: 0
                        }}>
                          Shared
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      <Calendar size={13} />
                      <span>{formatDateRange(trip.startDate, trip.endDate, trip.mainCurrency)}</span>
                    </div>
                  </div>

                  {/* Net Balance Amount Display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {tripBal && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '0.98rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-main)',
                          letterSpacing: '-0.02em',
                          color: isOwed 
                            ? 'var(--positive-text)' 
                            : owes 
                            ? 'var(--negative-text)' 
                            : 'var(--text-tertiary)'
                        }}>
                          {isOwed ? (
                            <span>+{formatMoney(tripBal.net, trip.mainCurrency)}</span>
                          ) : owes ? (
                            <span>-{formatMoney(Math.abs(tripBal.net), trip.mainCurrency)}</span>
                          ) : (
                            <span>{formatMoney(0, trip.mainCurrency)}</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: isOwed 
                            ? 'var(--positive-text)' 
                            : owes 
                            ? 'var(--negative-text)' 
                            : 'var(--text-tertiary)'
                        }}>
                          {!tripBal.hasExpenses 
                            ? 'No expenses'
                            : isOwed 
                            ? 'You are owed' 
                            : owes 
                            ? 'You owe' 
                            : 'All settled'}
                        </div>
                      </div>
                    )}

                    <ChevronRight size={18} color="var(--text-tertiary)" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archive & Data Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
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

        {trips.length > 0 && (
          <button
            onClick={() => {
              showConfirm(
                "Are you sure you want to delete all trips and reset all expenses? This cannot be undone.",
                async () => {
                  await clearAllData();
                },
                {
                  title: "Delete All Trips?",
                  confirmText: "Delete All",
                  isDestructive: true
                }
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--negative-text)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: 4,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Trash2 size={15} />
            <span>Delete All Trips</span>
          </button>
        )}
      </div>

      <CreateTripModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
