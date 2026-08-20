import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { Trip } from '../../types';
import { formatMoney } from '../../lib/decimal';
import { db } from '../../lib/db';
import { calculateParticipantBalances } from '../../lib/balances';
import { Plus, Calendar, ChevronRight, Archive, Trash2 } from 'lucide-react';
import { CreateTripModal } from '../../components/CreateTripModal';

interface TripsHomeProps {
  onSelectTrip: (tripId: string) => void;
  onOpenArchive: () => void;
}

const ACTION_WIDTH = 152; // 76px Archive + 76px Delete

interface SwipeableTripItemProps {
  trip: Trip;
  tripBal: { net: number; hasExpenses: boolean } | undefined;
  isOwner: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  onArchiveTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
  formatDateRange: (startStr: string, endStr: string, currency: string) => string;
}

const SwipeableTripItem: React.FC<SwipeableTripItemProps> = ({
  trip,
  tripBal,
  isOwner,
  isOpen,
  onOpen,
  onClose,
  onSelectTrip,
  onArchiveTrip,
  onDeleteTrip,
  formatDateRange
}) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const isOwed = tripBal?.hasExpenses && tripBal.net > 0.009;
  const owes = tripBal?.hasExpenses && tripBal.net < -0.009;

  // Owners get 152px (Archive + Delete); Shared members get 76px (Archive/Hide only)
  const actionWidth = isOwner ? 152 : 76;

  const currentTranslateX = dragOffset !== null ? dragOffset : (isOpen ? -actionWidth : 0);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diffX = e.touches[0].clientX - startX.current;
    const diffY = e.touches[0].clientY - startY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (!isHorizontalSwipe.current) return;

    const base = isOpen ? -actionWidth : 0;
    const raw = base + diffX;

    if (raw <= 0) {
      if (raw < -actionWidth) {
        setDragOffset(-actionWidth + (raw + actionWidth) * 0.25);
      } else {
        setDragOffset(raw);
      }
    } else {
      setDragOffset(raw * 0.2);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (isHorizontalSwipe.current) {
      const current = dragOffset ?? (isOpen ? -actionWidth : 0);
      if (isOpen) {
        if (current > -actionWidth + 30) onClose();
        else onOpen();
      } else {
        if (current < -30) onOpen();
        else onClose();
      }
    }
    setDragOffset(null);
  };

  // Mouse Drag Support
  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diffX = moveEvent.clientX - startX.current;
      const diffY = moveEvent.clientY - startY.current;

      if (isHorizontalSwipe.current === null) {
        if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
          isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
        }
      }

      if (!isHorizontalSwipe.current) return;

      const base = isOpen ? -actionWidth : 0;
      const raw = base + diffX;
      if (raw <= 0) {
        setDragOffset(raw < -actionWidth ? -actionWidth + (raw + actionWidth) * 0.25 : raw);
      } else {
        setDragOffset(raw * 0.2);
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setDragOffset((curr) => {
        if (curr !== null && isHorizontalSwipe.current) {
          if (isOpen) {
            if (curr > -actionWidth + 30) onClose();
            else onOpen();
          } else {
            if (curr < -30) onOpen();
            else onClose();
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isOpen) {
      e.stopPropagation();
      onClose();
    } else {
      onSelectTrip(trip.id);
    }
  };

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      touchAction: 'pan-y'
    }}>
      
      {/* Background Revealed Action Buttons */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: actionWidth,
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden'
      }}>
        {/* Archive / Hide Button (Available for both Owner and Shared) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchiveTrip(trip);
          }}
          style={{
            flex: 1,
            background: 'var(--accent-primary, #344256)',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: 'pointer',
            padding: '0 8px',
            border: 'none',
            outline: 'none',
            transition: 'background 0.15s ease'
          }}
          title={isOwner ? "Archive Trip" : "Hide Trip in Archive"}
        >
          <Archive size={19} color="#ffffff" />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {isOwner ? 'Archive' : 'Hide'}
          </span>
        </button>

        {/* Delete Button (Strictly for Trip Owner only) */}
        {isOwner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTrip(trip);
            }}
            style={{
              flex: 1,
              background: '#e11d48',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: '0 8px',
              border: 'none',
              outline: 'none',
              transition: 'background 0.15s ease'
            }}
            title="Delete Trip"
          >
            <Trash2 size={19} color="#ffffff" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Delete
            </span>
          </button>
        )}
      </div>

      {/* Foreground Front Card */}
      <div
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        className="card"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '16px 18px',
          gap: 12,
          background: 'var(--bg-surface)',
          transform: `translateX(${currentTranslateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          userSelect: 'none'
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
          {tripBal ? (
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
          ) : (
            <div style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Updating…</div>
              <div style={{ fontSize: '0.65rem', marginTop: 2 }}>Trip amount</div>
            </div>
          )}

          <ChevronRight size={18} color="var(--text-tertiary)" />
        </div>
      </div>

    </div>
  );
};

export const TripsHome: React.FC<TripsHomeProps> = ({ onSelectTrip, onOpenArchive }) => {
  const { trips, currentUser, refreshData, closeTrip, deleteTrip, showAlert, clearAllData, showConfirm } = useApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const [tripBalances, setTripBalances] = useState<Record<string, { net: number; hasExpenses: boolean }>>({});

  const activeTrips = useMemo(
    () => trips.filter(t => !t.isClosed && !t.isDeleted),
    [trips]
  );

  // Automatically refresh cloud data on overview mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let isMounted = true;

    const loadAllTripBalances = async () => {
      const allKnownUsers = await db.users.toArray();
      const results: Record<string, { net: number; hasExpenses: boolean }> = {};
      for (const trip of activeTrips) {
        const tripMems = await db.tripMembers.where('tripId').equals(trip.id).toArray();
        const tripExps = await db.expenses.where('tripId').equals(trip.id).toArray();
        const tripSettlements = await db.settlements.where('tripId').equals(trip.id).toArray();
        const tripHouseholds = await db.households.where('tripId').equals(trip.id).toArray();

        const activeExps = tripExps.filter(e => !e.isDeleted);
        const b = calculateParticipantBalances(tripMems, tripExps, tripSettlements, tripHouseholds, allKnownUsers);
        const myBal = b.individualBalances.find(ib => 
          ib.userId === currentUser.id || 
          (currentUser.email && ib.userId.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser.name && ib.name.toLowerCase() === currentUser.name.toLowerCase())
        );
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
  }, [activeTrips, currentUser.id, currentUser.email, currentUser.name]);

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

  const handleArchiveTrip = (trip: Trip) => {
    const isOwner = trip.ownerId === currentUser.id;
    showConfirm(
      isOwner
        ? `Are you sure you want to close and archive "${trip.name}"? You can reopen it anytime from the Archive.`
        : `Are you sure you want to hide "${trip.name}"? You can access it anytime from Archived & Closed Trips.`,
      async () => {
        await closeTrip(trip.id);
        setOpenTripId(null);
        showAlert(
          isOwner ? `"${trip.name}" has been moved to Archive.` : `"${trip.name}" is now hidden in Archive.`,
          isOwner ? 'Trip Archived' : 'Trip Hidden',
          'success'
        );
      },
      {
        title: isOwner ? 'Archive Trip?' : 'Hide Trip?',
        confirmText: isOwner ? 'Archive Trip' : 'Hide Trip',
        isDestructive: false
      }
    );
  };

  const handleDeleteTrip = (trip: Trip) => {
    showConfirm(
      `Are you sure you want to delete "${trip.name}" and all of its expenses?`,
      async () => {
        await deleteTrip(trip.id);
        setOpenTripId(null);
        showAlert(`"${trip.name}" was deleted.`, 'Trip Deleted', 'success');
      },
      {
        title: 'Delete Trip?',
        confirmText: 'Delete Trip',
        isDestructive: true
      }
    );
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
              const isOwner = trip.ownerId === currentUser.id;

              return (
                <SwipeableTripItem
                  key={trip.id}
                  trip={trip}
                  tripBal={tripBal}
                  isOwner={isOwner}
                  isOpen={openTripId === trip.id}
                  onOpen={() => setOpenTripId(trip.id)}
                  onClose={() => setOpenTripId(null)}
                  onSelectTrip={onSelectTrip}
                  onArchiveTrip={handleArchiveTrip}
                  onDeleteTrip={handleDeleteTrip}
                  formatDateRange={formatDateRange}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Archive & Data Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <button
          onClick={onOpenArchive}
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '13px 16px',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.86rem',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={16} />
            <span>Archived & Closed Trips</span>
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" />
        </button>
      </div>

      <CreateTripModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
