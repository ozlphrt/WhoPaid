import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { formatMoney, getCurrencySymbol } from '../../lib/decimal';
import { Plus, ChevronRight, Scale, HandCoins, FileSpreadsheet, Settings, AlertCircle, Users, ArrowUpRight, ArrowDownLeft, Receipt, PieChart } from 'lucide-react';
import { AddExpenseSheet } from '../../components/AddExpenseSheet';
import { ExpenseDetailModal } from '../../components/ExpenseDetailModal';
import { CategoryIcon } from '../../components/CategoryIcon';

interface TripHomeProps {
  onNavigateTab: (tab: 'expenses' | 'balances' | 'settle' | 'report' | 'settings') => void;
}

export const TripHome: React.FC<TripHomeProps> = ({ onNavigateTab }) => {
  const {
    activeTrip,
    currentUser,
    expenses,
    members,
    balances,
    userNetBalance,
    recommendedTransfers
  } = useApp();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | undefined>(undefined);

  if (!activeTrip) return null;

  const memberMap = new Map(members.map(m => [m.userId, m.name]));
  const activeExpenses = expenses.filter(e => !e.isDeleted);

  const isOwed = userNetBalance > 0.009;
  const owes = userNetBalance < -0.009;

  const userBalanceObj = balances.individualBalances.find(b => b.userId === currentUser.id);

  // Immediate pending transfer recommendation for user
  const myNextTransfer = recommendedTransfers.find(t => t.debtorId === currentUser.id || t.creditorId === currentUser.id);

  // Group expenses chronologically by date
  const groupedExpenses = activeExpenses.reduce((groups, exp) => {
    const d = new Date(exp.date);
    const dateLabel = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(exp);
    return groups;
  }, {} as Record<string, typeof activeExpenses>);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '16px 18px 96px',
      minHeight: '100%'
    }}>
      
      {/* 1. Hero Executive Balance Card */}
      <div className="hero-balance-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: isOwed ? 'var(--positive-bg)' : owes ? 'var(--negative-bg)' : 'var(--bg-subtle)',
            border: `1px solid ${isOwed ? 'var(--positive-border)' : owes ? 'var(--negative-border)' : 'var(--border-subtle)'}`,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isOwed ? 'var(--positive-text)' : owes ? 'var(--negative-text)' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isOwed ? 'var(--positive-text)' : owes ? 'var(--negative-text)' : 'var(--text-tertiary)'
            }} />
            <span>{isOwed ? "You are owed" : owes ? "You owe" : "All Settled"}</span>
          </div>

          {userBalanceObj && (
            <div style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-tertiary)', lineHeight: 1.35, flexShrink: 0 }}>
              <div>Paid <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatMoney(userBalanceObj.paid, activeTrip.mainCurrency)}</strong></div>
              <div>Share <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatMoney(userBalanceObj.share, activeTrip.mainCurrency)}</strong></div>
            </div>
          )}
        </div>

        {/* Sculpted Large Balance + Big Circular Add Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
              display: 'block',
              marginBottom: 2
            }}>
              Net Balance
            </span>
            <div style={{
              fontSize: '2.6rem',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              fontFamily: 'var(--font-main)',
              color: isOwed ? 'var(--positive-text)' : owes ? 'var(--negative-text)' : 'var(--text-primary)'
            }}>
              {isOwed ? (
                <span>+{formatMoney(userNetBalance, activeTrip.mainCurrency)}</span>
              ) : owes ? (
                <span>−{formatMoney(Math.abs(userNetBalance), activeTrip.mainCurrency)}</span>
              ) : (
                <span style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>€0.00</span>
              )}
            </div>
          </div>

          {!activeTrip.isClosed ? (
            <button
              onClick={() => {
                setEditingExpenseId(undefined);
                setIsAddOpen(true);
              }}
              className="btn-fab-circle"
              title="Add New Expense"
              aria-label="Add Expense"
            >
              <Plus size={34} strokeWidth={2.8} />
            </button>
          ) : (
            <div style={{
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              color: 'var(--warning-text)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px',
              fontSize: '0.78rem',
              textAlign: 'center',
              fontWeight: 600
            }}>
              Closed
            </div>
          )}
        </div>

          {myNextTransfer && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {myNextTransfer.debtorId === currentUser.id ? (
                  <>
                    <ArrowUpRight size={14} color="var(--negative-text)" />
                    <span>Send {formatMoney(myNextTransfer.amount, activeTrip.mainCurrency)} to <strong>{myNextTransfer.creditorName}</strong></span>
                  </>
                ) : (
                  <>
                    <ArrowDownLeft size={14} color="var(--positive-text)" />
                    <span>Collect {formatMoney(myNextTransfer.amount, activeTrip.mainCurrency)} from <strong>{myNextTransfer.debtorName}</strong></span>
                  </>
                )}
              </div>

              <button
                onClick={() => onNavigateTab('settle')}
                style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline' }}
              >
                Settle
              </button>
            </div>
          )}
      </div>

      {/* 2. Group Balances Ledger (Executive Card - Compact Padding) */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Group Members ({members.length})</h2>
          </div>
          <button
            onClick={() => onNavigateTab('report')}
            style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <span>Breakdown</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {balances.individualBalances.map(b => {
            const isSelf = b.userId === currentUser.id;
            const owesMoney = b.net < -0.009;
            const owedMoney = b.net > 0.009;

            return (
              <div
                key={b.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelf ? 'var(--bg-subtle)' : 'transparent',
                  border: isSelf ? '1px solid var(--border-subtle)' : 'none',
                  fontSize: '0.88rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isSelf ? 'var(--btn-primary-bg)' : 'var(--bg-hover)',
                    color: isSelf ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}>
                    {b.name.charAt(0)}
                  </div>
                  <strong style={{ fontWeight: 600 }}>{b.name}</strong>
                  {isSelf && (
                    <span style={{ fontSize: '0.68rem', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      You
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                  {owedMoney ? (
                    <span style={{ color: 'var(--positive-text)' }}>+{formatMoney(b.net, activeTrip.mainCurrency)}</span>
                  ) : owesMoney ? (
                    <span style={{ color: 'var(--negative-text)' }}>−{formatMoney(Math.abs(b.net), activeTrip.mainCurrency)}</span>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>Settled</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Chronological Expenses Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Expenses ({activeExpenses.length})
          </h2>
          <button
            onClick={() => onNavigateTab('expenses')}
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <span>Search & Filter</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {activeExpenses.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: '0.95rem'
          }}>
            No expenses recorded yet. Tap <strong>+ Add Expense</strong> to begin.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {Object.entries(groupedExpenses).map(([dateLabel, exps]) => (
              <div key={dateLabel} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Date Header */}
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  paddingLeft: 4
                }}>
                  {dateLabel}
                </div>

                {/* Expense Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {exps.map(exp => {
                    const payerName = exp.payers && exp.payers.length > 1
                      ? `${exp.payers.length} people`
                      : (exp.paidByUserId === currentUser.id ? 'You' : memberMap.get(exp.paidByUserId) || 'Someone');

                    return (
                      <div
                        key={exp.id}
                        onClick={() => setSelectedExpenseId(exp.id)}
                        className="transaction-row"
                      >
                        <CategoryIcon category={exp.category} size={44} iconSize={20} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: '0.98rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {exp.description}
                            </strong>
                            {exp.isFlaggedWrong && (
                              <AlertCircle size={14} color="var(--negative-text)" />
                            )}
                          </div>
                          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                            Paid by {payerName}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {getCurrencySymbol(exp.originalCurrency)}{exp.originalAmount.toFixed(2)}
                          </div>
                          {exp.originalCurrency !== exp.mainCurrency && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                              ≈ {formatMoney(exp.convertedAmount, exp.mainCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Floating Bottom Navigation Dock */}
      <nav className="floating-bottom-dock">
        <button
          onClick={() => onNavigateTab('expenses')}
          className="dock-tab-btn"
        >
          <Receipt size={19} />
          <span>Expenses</span>
        </button>

        <button
          onClick={() => onNavigateTab('report')}
          className="dock-tab-btn"
        >
          <PieChart size={19} />
          <span>Summary</span>
        </button>

        <button
          onClick={() => onNavigateTab('settle')}
          className="dock-tab-btn"
        >
          <HandCoins size={19} />
          <span>Settle Up</span>
        </button>

        <button
          onClick={() => onNavigateTab('settings')}
          className="dock-tab-btn"
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Modals */}
      <AddExpenseSheet
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingExpenseId(undefined);
        }}
        editExpenseId={editingExpenseId}
      />

      <ExpenseDetailModal
        expenseId={selectedExpenseId}
        onClose={() => setSelectedExpenseId(null)}
        onEdit={(id) => {
          setSelectedExpenseId(null);
          setEditingExpenseId(id);
          setIsAddOpen(true);
        }}
      />

    </div>
  );
};
