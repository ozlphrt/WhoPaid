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
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Group Balances</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          Total group spend: <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(totalSpend, activeTrip.mainCurrency)}</strong>
        </p>
      </div>

      {/* Household Summary */}
      {householdBalances.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Home size={15} color="var(--text-secondary)" />
            <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                    <strong style={{ fontSize: '0.92rem', display: 'block' }}>{hh.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Paid {formatMoney(hh.paid, activeTrip.mainCurrency)} · Share {formatMoney(hh.share, activeTrip.mainCurrency)}
                    </span>
                  </div>

                  <div className={isOwed ? 'badge-owed' : owes ? 'badge-owes' : 'badge-settled'}>
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
          <Users size={15} color="var(--text-secondary)" />
          <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                  padding: '14px 16px',
                  background: isCurrent ? 'var(--bg-subtle)' : 'var(--bg-surface)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: '0.95rem' }}>
                      {b.name} {isCurrent && '(You)'}
                    </strong>
                    {b.householdName && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                        {b.householdName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Paid {formatMoney(b.paid, activeTrip.mainCurrency)} · Share {formatMoney(b.share, activeTrip.mainCurrency)}
                  </div>
                </div>

                <div className={isOwed ? 'badge-owed' : owes ? 'badge-owes' : 'badge-settled'}>
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
