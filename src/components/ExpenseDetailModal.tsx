import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { Expense } from '../types';
import { formatMoney, getCurrencySymbol } from '../lib/decimal';
import { formatHumanExchangeRate } from '../lib/fx';
import { Edit2, Trash2, Flag, AlertCircle, Info, Calendar, Clock } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface ExpenseDetailModalProps {
  expenseId: string | null;
  onClose: () => void;
  onEdit: (expenseId: string) => void;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  expenseId,
  onClose,
  onEdit
}) => {
  const {
    expenses,
    members,
    currentUser,
    deleteExpense,
    flagExpenseWrong
  } = useApp();

  const [showFlagOptions, setShowFlagOptions] = useState<boolean>(false);
  const [showReceiptFull, setShowReceiptFull] = useState<boolean>(false);

  if (!expenseId) return null;
  const exp = expenses.find(e => e.id === expenseId);
  if (!exp) return null;

  const memberMap = new Map(members.map(m => [m.userId, m.name]));
  const isCreator = exp.addedByUserId === currentUser.id;

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${exp.description}"? This will be logged in Activity.`)) {
      await deleteExpense(exp.id);
      onClose();
    }
  };

  const handleFlagReason = async (reason: Expense['flaggedReason']) => {
    await flagExpenseWrong(exp.id, reason);
    setShowFlagOptions(false);
  };

  const dateObj = new Date(exp.date);
  const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <BottomSheet isOpen={!!expenseId} onClose={onClose} title="Expense Detail">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Header Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CategoryIcon category={exp.category} size={46} iconSize={22} />

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{exp.description}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{exp.category}</span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {getCurrencySymbol(exp.originalCurrency)}{exp.originalAmount.toFixed(2)}
            </div>
            {exp.originalCurrency !== exp.mainCurrency && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                ≈ {formatMoney(exp.convertedAmount, exp.mainCurrency)}
              </div>
            )}
          </div>
        </div>

        {/* Flagged Alert Banner */}
        {exp.isFlaggedWrong && (
          <div style={{
            background: 'var(--negative-bg)',
            border: '1px solid var(--negative-border)',
            color: 'var(--negative-text)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={16} />
            <span>
              Flagged as <strong>"{exp.flaggedReason}"</strong> by {memberMap.get(exp.flaggedByUserId || '') || 'a participant'}.
            </span>
          </div>
        )}

        {/* Metadata Grid */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          fontSize: '0.82rem'
        }}>
          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>PAID BY</span>
            <strong style={{ fontWeight: 600 }}>
              {exp.payers && exp.payers.length > 1 
                ? exp.payers.map(p => `${memberMap.get(p.userId) || 'Someone'} (${getCurrencySymbol(exp.originalCurrency)}${p.amount.toFixed(2)})`).join(', ')
                : (memberMap.get(exp.paidByUserId) || 'Someone')}
            </strong>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>ADDED BY</span>
            <strong style={{ fontWeight: 600 }}>
              {memberMap.get(exp.addedByUserId) || 'Someone'}
            </strong>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>DATE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} color="var(--text-tertiary)" />
              <span>{dateFormatted}</span>
            </div>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>TIME</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color="var(--text-tertiary)" />
              <span>{timeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Split Breakdown */}
        <div>
          <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Split Breakdown ({exp.splitMode.toUpperCase()})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {exp.participants.map(part => (
              <div 
                key={part.userId} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px 10px', 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem' 
                }}
              >
                <span>{memberMap.get(part.userId) || 'Member'}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {getCurrencySymbol(exp.originalCurrency)}{part.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FX Exchange Rate Details */}
        {exp.originalCurrency !== exp.mainCurrency && (
          <div style={{
            background: 'var(--info-bg)',
            color: 'var(--info-text)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Rate: {formatHumanExchangeRate(exp.originalCurrency, exp.mainCurrency, exp.exchangeRate)}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Source: {exp.exchangeRateSource?.includes(exp.exchangeRateDate || '') ? exp.exchangeRateSource : `${exp.exchangeRateSource || 'Frankfurter API'}${exp.exchangeRateDate ? ` (${exp.exchangeRateDate})` : ''}`}
              </div>
            </div>
          </div>
        )}

        {/* Note */}
        {exp.note && (
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
            <span style={{ fontWeight: 700, display: 'block', color: 'var(--text-tertiary)', fontSize: '0.7rem', marginBottom: 2 }}>NOTE</span>
            <p>{exp.note}</p>
          </div>
        )}

        {/* Receipt Image */}
        {exp.receiptUrl && (
          <div>
            <span style={{ fontWeight: 700, display: 'block', color: 'var(--text-tertiary)', fontSize: '0.7rem', marginBottom: 4 }}>RECEIPT PHOTO</span>
            <img
              src={exp.receiptUrl}
              alt="Receipt"
              onClick={() => setShowReceiptFull(true)}
              style={{
                width: '100%',
                maxHeight: 160,
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                border: '1px solid var(--border-subtle)'
              }}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {isCreator ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button 
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(exp.id);
                }} 
                className="btn-secondary"
              >
                <Edit2 size={15} />
                <span>Edit</span>
              </button>

              <button 
                type="button"
                onClick={handleDelete} 
                className="btn-danger"
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <div>
              {!showFlagOptions ? (
                <button
                  type="button"
                  onClick={() => setShowFlagOptions(true)}
                  className="btn-secondary"
                  style={{ width: '100%', color: 'var(--negative-text)' }}
                >
                  <Flag size={15} />
                  <span>Mark as Wrong</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                    SELECT REASON:
                  </span>
                  {(['I wasn\'t there', 'Wrong amount', 'Wrong split', 'Duplicate', 'Other'] as const).map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleFlagReason(reason)}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'left',
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowFlagOptions(false)}
                    style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', padding: 4 }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </BottomSheet>
  );
};
