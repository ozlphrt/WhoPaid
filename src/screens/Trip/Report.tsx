import React, { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { CATEGORIES } from '../../lib/category';
import { formatMoney, getCurrencySymbol, roundMoney } from '../../lib/decimal';
import { FileText, FileSpreadsheet, PieChart, Users } from 'lucide-react';
import { exportTripCSV, exportTripPDF } from '../../lib/export';

export const Report: React.FC = () => {
  const {
    activeTrip,
    members,
    expenses,
    balances,
    recommendedTransfers
  } = useApp();

  if (!activeTrip) return null;

  const activeExpenses = useMemo(() => expenses.filter(e => !e.isDeleted), [expenses]);
  const totalSpend = balances.totalSpend;

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
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Trip Report</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Financial summary & exports
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
          >
            <FileSpreadsheet size={15} />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="btn-primary"
            style={{ width: 'auto', padding: '7px 14px', fontSize: '0.78rem', borderRadius: 'var(--radius-md)' }}
          >
            <FileText size={15} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 1. Overview Card */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Total Trip Spend
        </span>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '2px 0 10px', fontFamily: 'var(--font-mono)' }}>
          {formatMoney(totalSpend, activeTrip.mainCurrency)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Dates</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{activeTrip.startDate.slice(5)} – {activeTrip.endDate.slice(5)}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>People</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{members.length} members</div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Expenses</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{activeExpenses.length} records</div>
          </div>
        </div>
      </div>

      {/* 2. Category Breakdown */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <PieChart size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.92rem', fontWeight: 700 }}>Category Breakdown</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categoryBreakdown.map((cat, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{cat.category}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {formatMoney(cat.amount, activeTrip.mainCurrency)} ({cat.percentage.toFixed(1)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: 5, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${cat.percentage}%`, 
                    background: 'var(--brand-primary)',
                    borderRadius: 'var(--radius-full)'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. People Balances */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Users size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.92rem', fontWeight: 700 }}>Participant Balances</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {balances.individualBalances.map(b => (
            <div
              key={b.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem'
              }}
            >
              <div>
                <strong>{b.name}</strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                  Paid {formatMoney(b.paid, activeTrip.mainCurrency)} · Share {formatMoney(b.share, activeTrip.mainCurrency)}
                </div>
              </div>

              <strong style={{ fontFamily: 'var(--font-mono)', color: b.net > 0.009 ? 'var(--positive-text)' : b.net < -0.009 ? 'var(--negative-text)' : 'var(--text-tertiary)' }}>
                {formatMoney(b.net, activeTrip.mainCurrency, true)}
              </strong>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
