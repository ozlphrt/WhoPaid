import React from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { Check, User, ShieldCheck } from 'lucide-react';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, currentUser, setCurrentUser, members, activeTrip } = useApp();

  const handleSelectUser = (u: import('../types').User) => {
    setCurrentUser(u);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Switch User (Demo / Testing)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Switch users to test personalized debts, settlements, permissions, and creator-only editing.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allUsers.map(u => {
            const isSelected = u.id === currentUser.id;
            const tripMember = members.find(m => m.userId === u.id);
            const isOwner = activeTrip?.ownerId === u.id;

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectUser(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: isSelected ? 'var(--brand-50)' : 'var(--bg-subtle)',
                  border: isSelected ? '1.5px solid var(--brand-500)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? 'var(--brand-600)' : 'var(--border-strong)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700
                  }}>
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: '0.95rem' }}>{u.name}</strong>
                      {isOwner && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--brand-100)', color: 'var(--brand-700)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Owner
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{u.email}</span>
                  </div>
                </div>

                {isSelected && <Check size={20} color="var(--brand-600)" />}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};
