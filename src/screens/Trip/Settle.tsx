import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { formatMoney, getCurrencySymbol } from '../../lib/decimal';
import { RecommendedTransfer, CurrencyCode } from '../../types';
import { ArrowRight, CheckCircle2, Clock, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BottomSheet } from '../../components/BottomSheet';

const COMMON_SETTLEMENT_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF'];

export const Settle: React.FC = () => {
  const {
    recommendedTransfers,
    settlements,
    members,
    households,
    currentUser,
    activeTrip,
    initiateSettlement,
    confirmSettlement,
    showAlert
  } = useApp();

  const [selectedTransfer, setSelectedTransfer] = useState<RecommendedTransfer | null>(null);
  const [settlementCurrency, setSettlementCurrency] = useState<CurrencyCode>(activeTrip?.mainCurrency || 'EUR');
  const [customAmountStr, setCustomAmountStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  if (!activeTrip) return null;

  const memberMap = new Map(members.map(m => [m.userId, m.name]));
  const householdMap = new Map(households.map(h => [h.id, h.name]));

  const handleSelectTransfer = (transfer: RecommendedTransfer) => {
    setSelectedTransfer(transfer);
    setSettlementCurrency(transfer.currency);
    setCustomAmountStr(transfer.amount.toString());
    setNotes('');
  };

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransfer || isSubmittingPayment) return;

    const amount = parseFloat(customAmountStr) || selectedTransfer.amount;
    if (amount <= 0) {
      showAlert('Please enter a valid payment amount greater than 0.', 'Invalid Amount', 'warning');
      return;
    }

    let actualDebtorId = selectedTransfer.debtorId;
    const debtorHh = households.find(h => h.id === selectedTransfer.debtorId);
    if (debtorHh) {
      actualDebtorId = debtorHh.memberUserIds.includes(currentUser.id) ? currentUser.id : debtorHh.memberUserIds[0];
    }

    let actualCreditorId = selectedTransfer.creditorId;
    const creditorHh = households.find(h => h.id === selectedTransfer.creditorId);
    if (creditorHh) {
      actualCreditorId = creditorHh.memberUserIds[0];
    }

    setIsSubmittingPayment(true);
    try {
      await initiateSettlement({
        debtorId: actualDebtorId,
        creditorId: actualCreditorId,
        amount,
        currency: settlementCurrency,
        notes: notes.trim() || undefined
      });

      setSelectedTransfer(null);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleConfirmReceipt = async (settlementId: string) => {
    await confirmSettlement(settlementId);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const pendingSettlements = settlements.filter(s => s.status === 'pending_confirmation');
  const visibleRecommendedTransfers = recommendedTransfers.filter(transfer => {
    const debtorHousehold = households.find(household => household.id === transfer.debtorId);
    const creditorHousehold = households.find(household => household.id === transfer.creditorId);
    return !pendingSettlements.some(settlement => {
      const sameDebtor = settlement.debtorId === transfer.debtorId
        || debtorHousehold?.memberUserIds.includes(settlement.debtorId);
      const sameCreditor = settlement.creditorId === transfer.creditorId
        || creditorHousehold?.memberUserIds.includes(settlement.creditorId);
      return sameDebtor && sameCreditor;
    });
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Settle Up</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          Optimized minimum transfers to balance the group.
        </p>
      </div>

      {/* Pending Confirmations Banner */}
      {pendingSettlements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--warning-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Confirmation ({pendingSettlements.length})
          </span>

          {pendingSettlements.map(s => {
            const isCreditor = s.creditorId === currentUser.id;
            const debtorName = memberMap.get(s.debtorId) || 'Debtor';
            const creditorName = memberMap.get(s.creditorId) || 'Creditor';

            return (
              <div
                key={s.id}
                style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color="var(--warning-text)" />
                    <strong style={{ fontSize: '0.88rem', color: 'var(--warning-text)' }}>
                      {debtorName} marked {formatMoney(s.amount, s.currency)} as paid to {creditorName}
                    </strong>
                  </div>
                  {s.currency !== s.mainCurrency && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      (≈ {formatMoney(s.convertedAmount, s.mainCurrency)})
                    </span>
                  )}
                </div>

                {isCreditor ? (
                  <button
                    onClick={() => handleConfirmReceipt(s.id)}
                    className="btn-primary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
                  >
                    <Check size={14} />
                    <span>Received</span>
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    Awaiting confirmation
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended Minimum Transfers List */}
      <div>
        <h2 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
          Recommended Payments
        </h2>

        {visibleRecommendedTransfers.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}>
            {pendingSettlements.length > 0 ? (
              <>
                <Clock size={32} color="var(--warning-text)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Payment awaiting confirmation</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  No additional payment is needed while receipt is pending.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 size={32} color="var(--positive-text)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Group is fully settled</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                  No outstanding balances remain.
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleRecommendedTransfers.map((t, idx) => {
              const debtorIsCurrent = t.debtorId === currentUser.id || (t.debtorHouseholdName && households.some(h => h.name === t.debtorHouseholdName && h.memberUserIds.includes(currentUser.id)));
              const creditorIsCurrent = t.creditorId === currentUser.id || (t.creditorHouseholdName && households.some(h => h.name === t.creditorHouseholdName && h.memberUserIds.includes(currentUser.id)));

              return (
                <div
                  key={idx}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                      <strong style={{ color: debtorIsCurrent ? 'var(--negative-text)' : 'var(--text-primary)' }}>
                        {t.debtorName} {debtorIsCurrent && '(You)'}
                      </strong>
                      <ArrowRight size={13} color="var(--text-tertiary)" />
                      <strong style={{ color: creditorIsCurrent ? 'var(--positive-text)' : 'var(--text-primary)' }}>
                        {t.creditorName} {creditorIsCurrent && '(You)'}
                      </strong>
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 2, display: 'block' }}>
                      {formatMoney(t.amount, t.currency)}
                    </span>
                  </div>

                  {debtorIsCurrent && (
                    <button
                      onClick={() => handleSelectTransfer(t)}
                      className="btn-primary"
                      style={{ width: 'auto', padding: '8px 14px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)' }}
                    >
                      <span>Mark as Paid</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Settlements */}
      {settlements.some(s => s.status === 'completed') && (
        <div style={{ marginTop: 6 }}>
          <h2 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Completed Settlements
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {settlements.filter(s => s.status === 'completed').map(s => {
              const dName = memberMap.get(s.debtorId) || 'Debtor';
              const cName = memberMap.get(s.creditorId) || 'Creditor';

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color="var(--positive-text)" />
                    <span>
                      <strong>{dName}</strong> paid <strong>{cName}</strong> {formatMoney(s.amount, s.currency)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {s.confirmedAt ? s.confirmedAt.split('T')[0] : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {selectedTransfer && (
        <BottomSheet
          isOpen={!!selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          title="Mark Payment as Paid"
        >
          <form onSubmit={handleMarkAsPaid} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Recording a payment to <strong>{selectedTransfer.creditorName}</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Payment Currency
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {COMMON_SETTLEMENT_CURRENCIES.map(curr => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setSettlementCurrency(curr)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: settlementCurrency === curr ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                      color: settlementCurrency === curr ? 'var(--brand-text)' : 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Amount ({settlementCurrency})
              </label>
              <input
                type="number"
                step="any"
                value={customAmountStr}
                onChange={(e) => setCustomAmountStr(e.target.value)}
                className="input-pill"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Note / Reference
              </label>
              <input
                type="text"
                placeholder="e.g. Sent via Revolut / Cash"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-pill"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmittingPayment} style={{ marginTop: 4 }}>
              <span>{isSubmittingPayment ? 'Saving…' : 'Mark as Paid'}</span>
            </button>
          </form>
        </BottomSheet>
      )}

    </div>
  );
};
