import React from 'react';
import { useApp } from '../../store/AppContext';
import { formatMoney } from '../../lib/decimal';
import { Users, Home } from 'lucide-react';

export const Balances: React.FC = () => {
  const { balances, activeTrip, currentUser } = useApp();

  if (!activeTrip) return null;

  const { individualBalances, householdBalances, totalSpend } = balances;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 80px' }}>
      
      {/* Header & Total Spend */}
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Group Balances</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
          Total group spend: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatMoney(totalSpend, activeTrip.mainCurrency)}</strong>
        </p>
      </div>

      {/* Household Summary */}
      {householdBalances.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Home size={16} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                    padding: '14px 18px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.96rem', fontWeight: 700, display: 'block' }}>{hh.name}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                      Paid {formatMoney(hh.paid, activeTrip.mainCurrency)} · Share {formatMoney(hh.share, activeTrip.mainCurrency)}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '1.05rem',
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

      {/* Individual Balances List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Users size={16} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Individual Breakdown
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
                  padding: '14px 18px',
                  background: isCurrent ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                  border: isCurrent ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)'
                }}
              >
                <div>
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
                      {b.name.charAt(0)}
                    </div>
                    <strong style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                      {b.name}
                    </strong>
                    {isCurrent && (
                      <span style={{ fontSize: '0.68rem', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                        You
                      </span>
                    )}
                    {b.householdName && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                        {b.householdName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 4, paddingLeft: 34 }}>
                    Paid {formatMoney(b.paid, activeTrip.mainCurrency)} · Share {formatMoney(b.share, activeTrip.mainCurrency)}
                  </div>
                </div>

                <div style={{
                  fontSize: '1.05rem',
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

    </div>
  );
};
