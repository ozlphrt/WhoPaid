import React, { useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { suggestTripEmoji, POPULAR_EMOJIS } from '../lib/emoji';
import { CurrencyCode } from '../types';
import { acquireSingleFlight, releaseSingleFlight } from '../lib/asyncReliability';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_MAIN_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY', 'JPY', 'CHF', 'CAD', 'AUD'];

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, createTrip, showAlert } = useApp();

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);

  const handleNameChange = (val: string) => {
    setName(val);
    const autoEmoji = suggestTripEmoji(val);
    setEmoji(autoEmoji);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acquireSingleFlight(submissionInFlightRef)) return;
    if (!name.trim()) {
      releaseSingleFlight(submissionInFlightRef);
      showAlert('Please enter a trip name to continue.', 'Missing Trip Name', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
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
        []
      );
      onClose();
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : 'The trip could not be created. Please try again.',
        'Trip Not Created',
        'warning'
      );
    } finally {
      releaseSingleFlight(submissionInFlightRef);
      setIsSubmitting(false);
    }
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

        {/* Submit */}
        <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: 8 }}>
          <span>{isSubmitting ? 'Creating Trip…' : 'Create Trip'}</span>
        </button>

      </form>
    </BottomSheet>
  );
};
