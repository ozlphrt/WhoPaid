import React, { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { CATEGORIES } from '../../lib/category';
import { formatAmount, formatMoney, roundMoney, resolveMemberName } from '../../lib/decimal';
import { FileText, FileSpreadsheet, PieChart, Users, Home, TrendingUp, UserX, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { exportTripCSV, exportTripPDF } from '../../lib/export';
import { getExpenseExclusions } from '../../lib/expenseParticipation';
import { CategoryIcon } from '../../components/CategoryIcon';
import { ExpenseDetailModal } from '../../components/ExpenseDetailModal';
import { AddExpenseSheet } from '../../components/AddExpenseSheet';

export const Report: React.FC = () => {
  const {
    activeTrip,
    members,
    expenses,
    balances,
    recommendedTransfers,
    households,
    currentUser,
    allUsers
  } = useApp();

  const [exclusionViewMode, setExclusionViewMode] = useState<'byMember' | 'byExpense'>('byMember');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);

  if (!activeTrip) return null;

  const activeExpenses = useMemo(() => expenses.filter(e => !e.isDeleted), [expenses]);
  const totalSpend = balances.totalSpend;
  const { individualBalances, householdBalances } = balances;

  const exclusions = useMemo(() => {
    return getExpenseExclusions(members, expenses, allUsers);
  }, [members, expenses, allUsers]);

  const dynamicDateRange = useMemo(() => {
    if (activeExpenses.length === 0) return 'Active';
    const timestamps = activeExpenses.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
    if (timestamps.length === 0) return 'Active';
    const minD = new Date(Math.min(...timestamps));
    const maxD = new Date(Math.max(...timestamps));
    const sMonth = minD.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = maxD.toLocaleDateString('en-US', { month: 'short' });
    const sDay = minD.getDate();
    const eDay = maxD.getDate();
    if (sMonth === eMonth) {
      return sDay === eDay ? `${sMonth} ${sDay}` : `${sMonth} ${sDay}–${eDay}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
  }, [activeExpenses]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    CATEGORIES.forEach(c => map.set(c.id, 0));

    activeExpenses.forEach(exp => {
      const cur = map.get(exp.category) || 0;
      map.set(exp.category, cur + exp.convertedAmount);
    });

    return CATEGORIES.map(cat => {
      const amount = roundMoney(map.get(cat.id) || 0, 2);
      const percentage = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
      return {
        category: cat.label,
        emoji: cat.emoji,
        amount,
        percentage
      };
    }).filter(c => c.amount > 0);
  }, [activeExpenses, totalSpend]);

  const handleExportPDF = () => {
    exportTripPDF(
      activeTrip,
      members,
      expenses,
      balances.individualBalances,
      recommendedTransfers,
      categoryBreakdown,
      totalSpend
    );
  };

  const handleExportCSV = () => {
    exportTripCSV(activeTrip, members, expenses);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 80px' }}>
      
      {/* Header with Export Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Trip Summary</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Financial balances, insights & exports
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            title="Export CSV spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="btn-primary"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
            title="Generate PDF report"
          >
            <FileText size={15} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 1. Overview Financial Hero Card */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Total Trip Spend
        </span>
        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '2px 0 12px', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
          {formatMoney(totalSpend, activeTrip.mainCurrency)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Dates</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{dynamicDateRange}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>People</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{members.length} members</div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Expenses</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{activeExpenses.length} records</div>
          </div>
        </div>
      </div>

      {/* 2. Household Combined Balances (if present) */}
      {householdBalances.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Home size={15} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Household Combined Balances
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {householdBalances.map(hh => {
              const isOwed = hh.net > 0.009;
              const owes = hh.net < -0.009;

              return (
                <div
                  key={hh.householdId}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.94rem', fontWeight: 700, display: 'block' }}>{hh.name}</strong>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                      Paid {formatMoney(hh.paid, activeTrip.mainCurrency)} · Share {formatMoney(hh.share, activeTrip.mainCurrency)}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '1.02rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: isOwed ? 'var(--positive-text)' : owes ? 'var(--negative-text)' : 'var(--text-tertiary)',
                    textAlign: 'right'
                  }}>
                    {isOwed ? `+${formatMoney(hh.net, activeTrip.mainCurrency)}` : owes ? `−${formatMoney(Math.abs(hh.net), activeTrip.mainCurrency)}` : 'Settled'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Individual Member Balances */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Users size={15} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Member Balances
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {individualBalances.map(b => {
            const isOwed = b.net > 0.009;
            const owes = b.net < -0.009;
            const isCurrent = b.userId === currentUser.id;

            return (
              <div
                key={b.userId}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isCurrent ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                  border: isCurrent ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isCurrent ? 'var(--btn-primary-bg)' : 'var(--bg-hover)',
                      color: isCurrent ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      {b.name.charAt(0)}
                    </div>
                    <strong style={{ fontSize: '0.94rem', fontWeight: 700 }}>
                      {b.name}
                    </strong>
                    {isCurrent && (
                      <span style={{ fontSize: '0.66rem', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                        You
                      </span>
                    )}
                    {b.householdName && (
                      <span style={{ fontSize: '0.68rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                        {b.householdName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: 2, paddingLeft: 32 }}>
                    Paid {formatMoney(b.paid, activeTrip.mainCurrency)} · Share {formatMoney(b.share, activeTrip.mainCurrency)}
                  </div>
                </div>

                <div style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: isOwed ? 'var(--positive-text)' : owes ? 'var(--negative-text)' : 'var(--text-tertiary)',
                  textAlign: 'right'
                }}>
                  {isOwed ? `+${formatMoney(b.net, activeTrip.mainCurrency)}` : owes ? `−${formatMoney(Math.abs(b.net), activeTrip.mainCurrency)}` : 'Settled'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Exclusions & Non-Participants */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserX size={15} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exclusion List & Non-Participants
            </h2>
          </div>
          {exclusions.totalExclusionsCount > 0 ? (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--negative-text, #ef4444)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              {exclusions.totalExclusionsCount} missing {exclusions.totalExclusionsCount === 1 ? 'entry' : 'entries'}
            </span>
          ) : (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--positive-text, #10b981)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              All Included
            </span>
          )}
        </div>

        {exclusions.totalExclusionsCount === 0 ? (
          <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--positive-text, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block' }}>
                Full Participation
              </strong>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                Every trip member is participating in all {activeExpenses.length} recorded expense{activeExpenses.length === 1 ? '' : 's'}.
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* View Mode Switcher */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 3,
              gap: 2
            }}>
              <button
                type="button"
                onClick={() => setExclusionViewMode('byMember')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: exclusionViewMode === 'byMember' ? 'var(--bg-surface)' : 'transparent',
                  color: exclusionViewMode === 'byMember' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: exclusionViewMode === 'byMember' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                By Member ({exclusions.membersWithExclusionsCount})
              </button>
              <button
                type="button"
                onClick={() => setExclusionViewMode('byExpense')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: exclusionViewMode === 'byExpense' ? 'var(--bg-surface)' : 'transparent',
                  color: exclusionViewMode === 'byExpense' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: exclusionViewMode === 'byExpense' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                By Expense ({exclusions.expensesWithExclusionsCount})
              </button>
            </div>

            {/* Content: By Member */}
            {exclusionViewMode === 'byMember' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exclusions.byMember.map(item => {
                  const isCurrent = item.member.userId === currentUser.id;
                  return (
                    <div key={item.member.userId} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--btn-primary-bg)' : 'var(--bg-hover)',
                            color: isCurrent ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.74rem',
                            fontWeight: 800
                          }}>
                            {item.member.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                                {item.member.name}
                              </strong>
                              {isCurrent && (
                                <span style={{ fontSize: '0.64rem', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  You
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                              Excluded from {item.excludedExpenses.length} expense{item.excludedExpenses.length === 1 ? '' : 's'} (Total: {formatMoney(item.totalExcludedSpend, activeTrip.mainCurrency)})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {item.excludedExpenses.map(exp => {
                          const dateStr = new Date(exp.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          });
                          const isSelfPayer = exp.paidByUserId === currentUser.id;
                          const payerName = isSelfPayer ? 'You' : resolveMemberName(exp.paidByUserId, members, currentUser, allUsers);

                          return (
                            <div
                              key={exp.id}
                              onClick={() => setSelectedExpenseId(exp.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                background: 'var(--bg-subtle)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                                gap: 10
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                              title="Click to view/edit expense"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <CategoryIcon category={exp.category} size={28} iconSize={14} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {exp.description}
                                    </span>
                                    {exp.splitMode === 'custom' && (
                                      <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                        Custom Split
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                    Paid by {payerName} · {dateStr}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.86rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                    {formatAmount(exp.originalAmount, exp.originalCurrency)}
                                  </div>
                                  {exp.originalCurrency !== activeTrip.mainCurrency && (
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                      ≈ {formatMoney(exp.convertedAmount, activeTrip.mainCurrency)}
                                    </div>
                                  )}
                                </div>
                                <ChevronRight size={14} color="var(--text-tertiary)" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Content: By Expense */}
            {exclusionViewMode === 'byExpense' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exclusions.byExpense.map(item => {
                  const exp = item.expense;
                  const dateStr = new Date(exp.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });
                  const isSelfPayer = exp.paidByUserId === currentUser.id;
                  const payerName = isSelfPayer ? 'You' : resolveMemberName(exp.paidByUserId, members, currentUser, allUsers);

                  return (
                    <div
                      key={exp.id}
                      onClick={() => setSelectedExpenseId(exp.id)}
                      className="card"
                      style={{
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Click to view/edit expense"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <CategoryIcon category={exp.category} size={32} iconSize={15} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ fontSize: '0.9rem', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {exp.description}
                            </strong>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                              Paid by {payerName} · {dateStr}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                            {formatAmount(exp.originalAmount, exp.originalCurrency)}
                          </div>
                          {exp.originalCurrency !== activeTrip.mainCurrency && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                              ≈ {formatMoney(exp.convertedAmount, activeTrip.mainCurrency)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 8,
                        marginTop: 4,
                        gap: 8,
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--negative-text, #ef4444)' }}>
                            Excluded ({item.excludedMembers.length}):
                          </span>
                          {item.excludedMembers.map(m => (
                            <span
                              key={m.userId}
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: 'var(--negative-text, #ef4444)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)'
                              }}
                            >
                              {m.name}{m.userId === currentUser.id ? ' (You)' : ''}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                            {item.participatingMembers.length}/{item.participatingMembers.length + item.excludedMembers.length} participating
                          </span>
                          <ChevronRight size={14} color="var(--text-tertiary)" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Category Breakdown */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <PieChart size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            Spending by Category
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categoryBreakdown.map((cat, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{cat.emoji} {cat.category}</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {formatMoney(cat.amount, activeTrip.mainCurrency)} ({cat.percentage.toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${cat.percentage}%`, 
                    background: 'var(--btn-primary-bg)',
                    borderRadius: 'var(--radius-full)'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail and Edit Modals */}
      {selectedExpenseId && (
        <ExpenseDetailModal
          expenseId={selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
          onEdit={(id) => {
            setSelectedExpenseId(null);
            setEditingExpenseId(id);
            setIsAddOpen(true);
          }}
        />
      )}

      {isAddOpen && (
        <AddExpenseSheet
          isOpen={isAddOpen}
          onClose={() => {
            setIsAddOpen(false);
            setEditingExpenseId(undefined);
          }}
          editExpenseId={editingExpenseId}
        />
      )}

    </div>
  );
};

