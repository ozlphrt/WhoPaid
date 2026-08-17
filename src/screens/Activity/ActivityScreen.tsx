import React from 'react';
import { useApp } from '../../store/AppContext';
import { Activity as ActivityIcon, PlusCircle, Edit3, Trash2, Flag, HandCoins, CheckCircle2, Archive, UserCheck, Shield } from 'lucide-react';

export const ActivityScreen: React.FC = () => {
  const { activities, activeTrip } = useApp();

  const getActivityIcon = (type: import('../../types').Activity['type']) => {
    switch (type) {
      case 'expense_added':
        return <PlusCircle size={16} color="var(--brand-600)" />;
      case 'expense_edited':
        return <Edit3 size={16} color="var(--brand-600)" />;
      case 'expense_deleted':
        return <Trash2 size={16} color="var(--negative-text)" />;
      case 'expense_flagged':
        return <Flag size={16} color="var(--negative-text)" />;
      case 'settlement_initiated':
        return <HandCoins size={16} color="var(--warning-text)" />;
      case 'settlement_confirmed':
        return <CheckCircle2 size={16} color="var(--positive-text)" />;
      case 'trip_closed':
        return <Archive size={16} color="var(--text-tertiary)" />;
      case 'member_joined':
        return <UserCheck size={16} color="var(--brand-600)" />;
      default:
        return <ActivityIcon size={16} color="var(--brand-600)" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 80px' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Activity History</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          {activeTrip ? `${activeTrip.emoji} ${activeTrip.name}` : 'Global audit log'}
        </span>
      </div>

      {activities.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem'
        }}>
          No logged activity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map(act => {
            const dateObj = new Date(act.createdAt);
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  {getActivityIcon(act.type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong>{act.userName}</strong> {act.description}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {dateStr} at {timeStr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
