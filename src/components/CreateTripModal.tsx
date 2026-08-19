import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { suggestTripEmoji, POPULAR_EMOJIS } from '../lib/emoji';
import { CurrencyCode } from '../types';
import { Plus, Trash2, Calendar, Sparkles } from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_MAIN_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY', 'JPY', 'CHF', 'CAD', 'AUD'];

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, createTrip } = useApp();

  const [name, setName] = useState<string>('');
  const [emoji, setEmoji] = useState<string>('✈️');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [mainCurrency, setMainCurrency] = useState<CurrencyCode>('EUR');
  const [memberEmails, setMemberEmails] = useState<string[]>(['']);

  const handleNameChange = (val: string) => {
    setName(val);
    const suggested = suggestTripEmoji(val);
    setEmoji(suggested);
  };

  const handleAddEmailField = () => {
    setMemberEmails(prev => [...prev, '']);
  };

  const handleEmailChange = (index: number, val: string) => {
    setMemberEmails(prev => prev.map((e, idx) => idx === index ? val : e));
  };

  const handleRemoveEmailField = (index: number) => {
    setMemberEmails(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a trip name');
      return;
    }

    await createTrip(
      {
        name: name.trim(),
        emoji,
        startDate,
        endDate,
        mainCurrency,
        ownerId: currentUser.id,
        isClosed: false,
        isDeleted: false
      },
      memberEmails
    );

    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Create New Trip">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Name & Emoji */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            TRIP NAME
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              style={{
                fontSize: '1.8rem',
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {emoji}
            </button>

            <input
              type="text"
              placeholder="e.g. Leros 2026, Paris Weekend"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="input-pill"
              autoFocus
              required
            />
          </div>

          {/* Emoji Picker Grid */}
          {showEmojiPicker && (
            <div style={{
              marginTop: 10,
              padding: 12,
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-lg)',
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 6
            }}>
              {POPULAR_EMOJIS.map((em, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setEmoji(em);
                    setShowEmojiPicker(false);
                  }}
                  style={{ fontSize: '1.4rem', padding: 4 }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>



        {/* Main Currency */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            MAIN CURRENCY
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COMMON_MAIN_CURRENCIES.map(curr => (
              <button
                key={curr}
                type="button"
                onClick={() => setMainCurrency(curr)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: mainCurrency === curr ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                  color: mainCurrency === curr ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: mainCurrency === curr ? '1px solid var(--btn-primary-border)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  boxShadow: mainCurrency === curr ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        {/* Invite Participants */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
              INVITE PARTICIPANTS (EMAILS)
            </label>
            <button
              type="button"
              onClick={handleAddEmailField}
              style={{ fontSize: '0.8rem', color: 'var(--accent-primary, #344256)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} />
              <span>Add another</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberEmails.map((email, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => handleEmailChange(idx, e.target.value)}
                  className="input-pill"
                />
                {memberEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEmailField(idx)}
                    className="nav-icon-btn"
                    style={{ width: 36, height: 36 }}
                  >
                    <Trash2 size={16} color="var(--negative-text)" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
          <span>Create Trip</span>
        </button>

      </form>
    </BottomSheet>
  );
};
