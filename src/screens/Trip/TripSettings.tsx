import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CurrencyCode, Household } from '../../types';
import { Users, Home, UserPlus, ShieldAlert, Archive, Trash2, Plus, Edit2 } from 'lucide-react';
import { QRCodeModal } from '../../components/QRCodeModal';
import { BottomSheet } from '../../components/BottomSheet';

const COMMON_MAIN_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY', 'JPY', 'CHF', 'CAD', 'AUD'];

export const TripSettings: React.FC = () => {
  const {
    activeTrip,
    currentUser,
    members,
    households,
    updateTrip,
    closeTrip,
    reopenTrip,
    deleteTrip,
    setMemberActive,
    deleteMember,
    addMember,
    saveHousehold,
    deleteHousehold,
    transferOwnership,
    rotateTripInvite,
    showAlert,
    showConfirm
  } = useApp();

  const [name, setName] = useState(activeTrip?.name || '');
  const [startDate, setStartDate] = useState(activeTrip?.startDate || '');
  const [endDate, setEndDate] = useState(activeTrip?.endDate || '');
  const [mainCurrency, setMainCurrency] = useState<CurrencyCode>(activeTrip?.mainCurrency || 'EUR');

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | undefined>(undefined);
  const [householdName, setHouseholdName] = useState('');
  const [selectedHhMembers, setSelectedHhMembers] = useState<string[]>([]);
  
  // Direct Add Member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  // Transfer Ownership
  const [newOwnerId, setNewOwnerId] = useState(activeTrip?.ownerId || '');

  if (!activeTrip) return null;

  const isOwner = activeTrip.ownerId === currentUser.id;

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTrip({
      ...activeTrip,
      name: name.trim(),
      emoji: '',
      startDate,
      endDate,
      mainCurrency
    });
    showAlert('Trip settings updated successfully!', 'Settings Saved', 'success');
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    await addMember(activeTrip.id, newMemberEmail.trim(), newMemberName.trim());
    setNewMemberName('');
    setNewMemberEmail('');
    setShowAddMember(false);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    showConfirm(
      `Are you sure you want to remove ${memberName} from this trip? They will no longer have access to this trip.`,
      async () => {
        await deleteMember(memberId);
      },
      {
        title: 'Remove Member?',
        confirmText: 'Remove',
        isDestructive: true
      }
    );
  };

  const handleOpenHouseholdModal = (hh?: Household) => {
    if (hh) {
      setEditingHouseholdId(hh.id);
      setHouseholdName(hh.name);
      setSelectedHhMembers(hh.memberUserIds);
    } else {
      setEditingHouseholdId(undefined);
      setHouseholdName('');
      setSelectedHhMembers([]);
    }
    setIsHouseholdModalOpen(true);
  };

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName.trim() || selectedHhMembers.length < 2) {
      showAlert('Please enter a name and select at least 2 members for this household.', 'Incomplete Household', 'warning');
      return;
    }

    await saveHousehold({
      tripId: activeTrip.id,
      name: householdName.trim(),
      memberUserIds: selectedHhMembers
    }, editingHouseholdId);

    setIsHouseholdModalOpen(false);
  };

  const handleCloseTripToggle = async () => {
    if (activeTrip.isClosed) {
      await reopenTrip(activeTrip.id);
    } else {
      showConfirm(
        'Are you sure you want to close this trip? It will be moved to Archive and become read-only.',
        async () => {
          await closeTrip(activeTrip.id);
        },
        {
          title: 'Close Trip?',
          confirmText: 'Close Trip',
          isDestructive: false
        }
      );
    }
  };

  const handleDeleteTrip = () => {
    showConfirm(
      'Delete this trip? It will be moved to "Recently Deleted" and kept for 30 days.',
      async () => {
        await deleteTrip(activeTrip.id);
      },
      {
        title: 'Delete Trip?',
        confirmText: 'Delete',
        isDestructive: true
      }
    );
  };

  const handleTransferOwnership = () => {
    if (!newOwnerId || newOwnerId === activeTrip.ownerId) return;
    showConfirm(
      'Are you sure you want to transfer ownership? You will become a regular member of this trip.',
      async () => {
        await transferOwnership(activeTrip.id, newOwnerId);
      },
      {
        title: 'Transfer Ownership?',
        confirmText: 'Transfer',
        isDestructive: true
      }
    );
  };

  const handleRotateInvite = () => {
    showConfirm(
      'Resetting the invitation link immediately disables the old link. Existing members keep access.',
      async () => {
        try {
          await rotateTripInvite(activeTrip.id);
          showAlert('A new invitation link is ready to share.', 'Invite Reset', 'success');
        } catch (error) {
          showAlert(error instanceof Error ? error.message : 'The invitation link could not be reset.', 'Invite Reset Failed', 'warning');
        }
      },
      { title: 'Reset invitation link?', confirmText: 'Reset Link' }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Trip Settings</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          Manage trip parameters, participants & households
        </span>
      </div>

      {/* 1. Trip Details Form */}
      <form onSubmit={handleSaveMetadata} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Trip Details</h2>

        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Trip Name
          </label>
          <input
            type="text"
            value={name}
            disabled={!isOwner}
            onChange={(e) => setName(e.target.value)}
            className="input-pill"
            required
          />
        </div>



        {/* Main Currency */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Main Currency
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COMMON_MAIN_CURRENCIES.map(c => (
              <button
                key={c}
                type="button"
                disabled={!isOwner}
                onClick={() => isOwner && setMainCurrency(c)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: mainCurrency === c ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                  color: mainCurrency === c ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                  fontSize: '0.78rem'
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {isOwner && (
          <button type="submit" className="btn-secondary" style={{ marginTop: 2 }}>
            <span>Save Details</span>
          </button>
        )}
      </form>

      {/* 2. Participants Section */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Participants ({members.length})</h2>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.75rem' }}
            >
              <span>Invite Link / QR</span>
            </button>
            {isOwner && (
              <button
                onClick={() => setShowAddMember(prev => !prev)}
                className="btn-primary"
                style={{ width: 'auto', padding: '5px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-md)' }}
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>

        {showAddMember && isOwner && (
          <form onSubmit={handleAddMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius-md)' }}>
            <input
              type="text"
              placeholder="Name (e.g. Sarah)"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="input-pill"
              required
            />
            <input
              type="email"
              placeholder="Email (e.g. sarah@example.com)"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="input-pill"
              required
            />
            <button type="submit" className="btn-primary" style={{ padding: '7px 10px', fontSize: '0.8rem' }}>
              Add Participant
            </button>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong>{m.name}</strong>
                  {(m.authUid === currentUser.id || m.userId === currentUser.id || m.legacyUserIds?.includes(currentUser.id)) && (
                    <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                      You
                    </span>
                  )}
                  {m.role === 'owner' && (
                    <span style={{ fontSize: '0.68rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                      Owner
                    </span>
                  )}
                  {!m.isActive && (
                    <span style={{ fontSize: '0.68rem', background: 'var(--border-strong)', color: 'var(--text-tertiary)', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                      Inactive
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  {(m.authUid === currentUser.id || m.userId === currentUser.id || m.legacyUserIds?.includes(currentUser.id))
                    ? (currentUser.email || m.email)
                    : m.email}
                </span>
              </div>

              {isOwner && m.userId !== currentUser.id && m.role !== 'owner' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setMemberActive(m.id, !m.isActive)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: m.isActive ? 'var(--text-secondary)' : 'var(--positive-text)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer'
                    }}
                  >
                    {m.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id, m.name)}
                    title={`Remove ${m.name} from trip`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '5px 7px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--negative-text)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Household Management */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Home size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Households / Couples</h2>
          </div>

          {isOwner && (
            <button
              onClick={() => handleOpenHouseholdModal()}
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.75rem' }}
            >
              <Plus size={13} />
              <span>Create</span>
            </button>
          )}
        </div>

        {households.length === 0 ? (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            No households configured for this trip.
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {households.map(hh => {
              const memberNames = hh.memberUserIds.map(id => members.find(m => m.userId === id)?.name || id).join(' + ');

              return (
                <div
                  key={hh.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.88rem', display: 'block' }}>{hh.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{memberNames}</span>
                  </div>

                  {isOwner && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleOpenHouseholdModal(hh)}
                        className="nav-icon-btn"
                        style={{ width: 28, height: 28 }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => deleteHousehold(hh.id)}
                        className="nav-icon-btn"
                        style={{ width: 28, height: 28 }}
                      >
                        <Trash2 size={13} color="var(--negative-text)" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Danger Zone */}
      {isOwner && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'var(--negative-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--negative-text)' }}>
            <ShieldAlert size={16} />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Owner Actions</h2>
          </div>

          {/* Transfer Ownership */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
              TRANSFER TRIP OWNERSHIP
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="input-pill"
                style={{ flex: 1, padding: '7px 10px' }}
              >
                {members.filter(m => m.authUid || m.userId === activeTrip.ownerId).map(m => (
                  <option key={m.id} value={m.authUid || m.userId}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
              <button
                onClick={handleTransferOwnership}
                className="btn-secondary"
                style={{ padding: '7px 10px', fontSize: '0.78rem' }}
              >
                Transfer
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRotateInvite}
            className="btn-secondary"
            style={{ padding: '8px 10px', fontSize: '0.78rem', alignSelf: 'flex-start' }}
          >
            Reset invitation link
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleCloseTripToggle}
              className="btn-secondary"
              style={{ fontSize: '0.8rem' }}
            >
              <Archive size={14} />
              <span>{activeTrip.isClosed ? 'Reopen Trip' : 'Close Trip'}</span>
            </button>

            <button
              onClick={handleDeleteTrip}
              className="btn-danger"
              style={{ fontSize: '0.8rem' }}
            >
              <Trash2 size={14} />
              <span>Delete Trip</span>
            </button>
          </div>
        </div>
      )}

      {/* Household Modal */}
      <BottomSheet
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        title={editingHouseholdId ? 'Edit Household' : 'Create Household'}
      >
        <form onSubmit={handleSaveHousehold} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              HOUSEHOLD NAME
            </label>
            <input
              type="text"
              placeholder="e.g. Ozalp + Betül"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="input-pill"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              SELECT MEMBERS (AT LEAST 2)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => {
                const isSelected = selectedHhMembers.includes(m.userId);
                return (
                  <label
                    key={m.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedHhMembers(prev => [...prev, m.userId]);
                        } else {
                          setSelectedHhMembers(prev => prev.filter(id => id !== m.userId));
                        }
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: 4 }}>
            <span>Save Household</span>
          </button>
        </form>
      </BottomSheet>

      <QRCodeModal
        trip={activeTrip}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

    </div>
  );
};
