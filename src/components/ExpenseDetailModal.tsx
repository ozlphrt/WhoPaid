import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { CategoryIcon } from './CategoryIcon';
import { formatMoney, formatAmount, getCurrencySymbol, resolveMemberName } from '../lib/decimal';
import { fetchHistoricalExchangeRate, formatHumanExchangeRate, isLegacyUnverifiedFxSource } from '../lib/fx';
import { Calendar, Clock, Edit2, Trash2, Flag, AlertCircle, Info, ChevronRight, X } from 'lucide-react';
import { Expense } from '../types';

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
    updateExpense,
    flagExpenseWrong,
    showConfirm
  } = useApp();

  const [showFlagOptions, setShowFlagOptions] = useState<boolean>(false);
  const [showReceiptFull, setShowReceiptFull] = useState<boolean>(false);
  const [isRepairingFx, setIsRepairingFx] = useState<boolean>(false);
  const fxRepairAttempts = useRef(new Set<string>());

  const exp = expenses.find(e => e.id === expenseId);
  const isCreator = Boolean(exp && (
    exp.addedByUserId === currentUser.id || exp.paidByUserId === currentUser.id
  ));

  useEffect(() => {
    if (
      !exp ||
      !isCreator ||
      exp.isManualExchangeRate ||
      exp.originalCurrency === exp.mainCurrency ||
      !isLegacyUnverifiedFxSource(exp.exchangeRateSource) ||
      fxRepairAttempts.current.has(exp.id)
    ) return;

    fxRepairAttempts.current.add(exp.id);
    let cancelled = false;

    const repairLegacyRate = async () => {
      setIsRepairingFx(true);
      try {
        const rateDate = exp.exchangeRateDate || exp.date.slice(0, 10);
        const result = await fetchHistoricalExchangeRate(
          exp.originalCurrency,
          exp.mainCurrency,
          rateDate,
          { forceRefresh: true }
        );
        if (!cancelled) {
          await updateExpense({
            ...exp,
            exchangeRate: result.rate,
            exchangeRateDate: rateDate,
            exchangeRateSource: result.source
          });
        }
      } catch (error) {
        fxRepairAttempts.current.delete(exp.id);
        console.warn('Could not repair legacy exchange rate:', error);
      } finally {
        if (!cancelled) setIsRepairingFx(false);
      }
    };

    void repairLegacyRate();
    return () => { cancelled = true; };
  }, [exp?.id, exp?.updatedAt, isCreator]);

  useEffect(() => {
    if (!showReceiptFull) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowReceiptFull(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showReceiptFull]);

  if (!exp) return null;

  const memberMap = new Map(members.map(m => [m.userId, m.name]));

  const handleDelete = () => {
    showConfirm(
      'Are you sure you want to delete this expense?',
      async () => {
        await deleteExpense(exp.id);
        onClose();
      },
      {
        title: 'Delete Expense?',
        confirmText: 'Delete',
        isDestructive: true
      }
    );
  };

  const handleFlagReason = async (reason: Expense['flaggedReason']) => {
    await flagExpenseWrong(exp.id, reason);
    setShowFlagOptions(false);
    onClose();
  };

  const dateObj = new Date(exp.date);
  const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <BottomSheet isOpen={!!expenseId} onClose={onClose} title="Expense Detail">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Header Hero Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 14px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)'
        }}>
          <CategoryIcon category={exp.category} size={48} iconSize={24} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {exp.description}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {exp.category}
            </span>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              {formatAmount(exp.originalAmount, exp.originalCurrency)}
            </div>
            {exp.originalCurrency !== exp.mainCurrency && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
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
            lineHeight: 1.4
          }}>
            <strong style={{ display: 'block', fontWeight: 700, marginBottom: 2 }}>⚠️ Flagged as Incorrect</strong>
            <span>{exp.flaggedReason || 'A member flagged this expense.'}</span>
          </div>
        )}

        {/* Metadata Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              PAID BY
            </span>
            <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {exp.payers && exp.payers.length > 1 
                ? exp.payers.map(p => `${resolveMemberName(p.userId, members, currentUser)} (${formatAmount(p.amount, exp.originalCurrency)})`).join(', ')
                : resolveMemberName(exp.paidByUserId, members, currentUser)}
            </strong>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              ADDED BY
            </span>
            <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {resolveMemberName(exp.addedByUserId, members, currentUser)}
            </strong>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              DATE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-primary)', fontWeight: 600 }}>
              <Calendar size={14} color="var(--text-tertiary)" />
              <span>{dateFormatted}</span>
            </div>
          </div>

          <div>
            <span style={{ display: 'block', color: 'var(--text-tertiary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              TIME
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-primary)', fontWeight: 600 }}>
              <Clock size={14} color="var(--text-tertiary)" />
              <span>{timeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Split Breakdown */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Split Breakdown ({exp.splitMode.toUpperCase()})
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {exp.participants.length} people
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exp.participants.map(part => (
              <div 
                key={part.userId} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.88rem' 
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {resolveMemberName(part.userId, members, currentUser)} {(part.userId === currentUser.id || part.userId === currentUser.email) && '(You)'}
                </span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {formatAmount(part.amount, exp.originalCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FX Exchange Rate Details */}
        {exp.originalCurrency !== exp.mainCurrency && (
          <div style={{
            background: 'var(--info-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--info-text)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {isRepairingFx
                  ? 'Updating verified ECB rate…'
                  : `Rate: ${formatHumanExchangeRate(exp.originalCurrency, exp.mainCurrency, exp.exchangeRate)}`}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Source: {exp.exchangeRateSource || 'Exchange-rate provider'}
              </div>
            </div>
            {isCreator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(exp.id);
                }}
                aria-label="Edit exchange rate"
                style={{
                  flexShrink: 0,
                  minHeight: 38,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--info-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <Edit2 size={14} />
                Edit rate
              </button>
            )}
          </div>
        )}

        {/* Note */}
        {exp.note && (
          <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 800, display: 'block', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
              NOTE
            </span>
            <p style={{ color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{exp.note}</p>
          </div>
        )}

        {/* Receipt Image */}
        {exp.receiptUrl && (
          <div>
            <span style={{ fontWeight: 800, display: 'block', color: 'var(--text-tertiary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              RECEIPT PHOTO
            </span>
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

        {/* Action Buttons & Flag Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          {isCreator ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button 
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(exp.id);
                }} 
                className="btn-secondary"
                style={{ justifyContent: 'center', padding: '12px' }}
              >
                <Edit2 size={16} />
                <span>Edit</span>
              </button>

              <button 
                type="button"
                onClick={handleDelete} 
                className="btn-danger"
                style={{ justifyContent: 'center', padding: '12px' }}
              >
                <Trash2 size={16} />
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
                  style={{ width: '100%', color: 'var(--negative-text)', justifyContent: 'center', padding: '12px' }}
                >
                  <Flag size={16} />
                  <span>Mark as Wrong / Flag Issue</span>
                </button>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: 'var(--bg-subtle)',
                  padding: 14,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      SELECT REASON:
                    </span>
                  </div>

                  {([
                    { id: "I wasn't there", label: "I wasn't there / Not involved" },
                    { id: "Wrong amount", label: "Wrong amount entered" },
                    { id: "Wrong split", label: "Incorrect split / participants" },
                    { id: "Duplicate", label: "Duplicate expense entry" },
                    { id: "Other", label: "Other issue" }
                  ] as const).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleFlagReason(item.id as Expense['flaggedReason'])}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 14px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <span>{item.label}</span>
                      <ChevronRight size={15} color="var(--text-tertiary)" />
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setShowFlagOptions(false)}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      justifyContent: 'center',
                      padding: '10px'
                    }}
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Full-screen Receipt Lightbox */}
      {showReceiptFull && exp.receiptUrl && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Receipt photo viewer"
          onClick={() => setShowReceiptFull(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'calc(82px + env(safe-area-inset-top, 0px)) 16px calc(90px + env(safe-area-inset-bottom, 0px))',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(12px + env(safe-area-inset-top, 0px))',
              left: 16,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 48
            }}
          >
            <strong style={{ color: '#ffffff', fontSize: '1rem' }}>Receipt</strong>
            <button
              type="button"
              aria-label="Close receipt"
              onClick={() => setShowReceiptFull(false)}
              style={{
                minWidth: 96,
                height: 48,
                padding: '0 18px',
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <X size={21} />
              Close
            </button>
          </div>
          <img
            src={exp.receiptUrl}
            alt="Full Receipt"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100dvh - 190px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowReceiptFull(false);
            }}
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              minHeight: 52,
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              color: '#111827',
              fontSize: '1rem',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
            }}
          >
            Done
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
