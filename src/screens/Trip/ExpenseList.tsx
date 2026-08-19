import React, { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { CATEGORIES } from '../../lib/category';
import { formatMoney, getCurrencySymbol, resolveMemberName } from '../../lib/decimal';
import { Search, Plus, AlertCircle, X } from 'lucide-react';
import { ExpenseDetailModal } from '../../components/ExpenseDetailModal';
import { AddExpenseSheet } from '../../components/AddExpenseSheet';
import { CategoryIcon } from '../../components/CategoryIcon';

export const ExpenseList: React.FC = () => {
  const { expenses, members, currentUser, activeTrip, allUsers } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | undefined>(undefined);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const memberMap = useMemo(() => new Map(members.map(m => [m.userId, m.name])), [members]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (exp.isDeleted) return false;

      // 1. Search query (matches description, note, category, payers, participants, or addedBy)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDesc = exp.description.toLowerCase().includes(q);
        const matchesNote = exp.note?.toLowerCase().includes(q);
        const matchesCat = exp.category.toLowerCase().includes(q);

        // Payer names
        const mainPayerName = (memberMap.get(exp.paidByUserId) || '').toLowerCase();
        const multiPayerNames = (exp.payers || []).map(p => (memberMap.get(p.userId) || '').toLowerCase()).join(' ');
        const matchesPayer = mainPayerName.includes(q) || multiPayerNames.includes(q);

        // Participant names
        const participantNames = (exp.participants || []).map(p => (memberMap.get(p.userId) || '').toLowerCase()).join(' ');
        const matchesParticipant = participantNames.includes(q);

        // Added by name
        const addedByName = (memberMap.get(exp.addedByUserId) || '').toLowerCase();
        const matchesAddedBy = addedByName.includes(q);

        if (!matchesDesc && !matchesNote && !matchesCat && !matchesPayer && !matchesParticipant && !matchesAddedBy) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }

      // 3. Person filter (filters strictly by who paid for the expense)
      if (selectedPerson !== 'all') {
        const isMainPayer = exp.paidByUserId === selectedPerson;
        const isMultiPayer = exp.payers?.some(p => p.userId === selectedPerson && p.amount > 0);
        if (!isMainPayer && !isMultiPayer) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedPerson, memberMap]);

  const categorySpendMap = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(exp => {
      if (!exp.isDeleted) {
        map.set(exp.category, (map.get(exp.category) || 0) + (exp.convertedAmount || 0));
      }
    });
    return map;
  }, [expenses]);

  const sortedCategories = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const spendA = categorySpendMap.get(a.id) || 0;
      const spendB = categorySpendMap.get(b.id) || 0;
      if (spendB !== spendA) {
        return spendB - spendA; // highest spend first
      }
      return a.label.localeCompare(b.label);
    });
  }, [categorySpendMap]);

  const personPaidMap = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(exp => {
      if (!exp.isDeleted) {
        if (exp.payers && exp.payers.length > 0) {
          exp.payers.forEach(p => {
            const payerConverted = exp.exchangeRate ? p.amount * exp.exchangeRate : p.amount;
            map.set(p.userId, (map.get(p.userId) || 0) + payerConverted);
          });
        } else {
          map.set(exp.paidByUserId, (map.get(exp.paidByUserId) || 0) + (exp.convertedAmount || exp.originalAmount));
        }
      }
    });
    return map;
  }, [expenses]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const paidA = personPaidMap.get(a.userId) || 0;
      const paidB = personPaidMap.get(b.userId) || 0;
      if (paidB !== paidA) {
        return paidB - paidA; // highest paid first
      }
      return a.name.localeCompare(b.name);
    });
  }, [members, personPaidMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px 80px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>All Expenses</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Showing {filteredExpenses.length} of {expenses.filter(e => !e.isDeleted).length} expenses
          </span>
        </div>

        {!activeTrip?.isClosed && (
          <button
            onClick={() => {
              setEditingExpenseId(undefined);
              setIsAddOpen(true);
            }}
            className="btn-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', borderRadius: 'var(--radius-lg)' }}
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Search size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search by name, description, note, category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-pill"
          style={{ paddingLeft: 38, paddingRight: searchQuery ? 36 : 14, fontSize: '0.9rem' }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 4, color: 'var(--text-tertiary)' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filter Chips (People - Ordered by Highest to Lowest Paid) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Paid by Person
        </span>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setSelectedPerson('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: selectedPerson === 'all' ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
              color: selectedPerson === 'all' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 600,
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            Everyone
          </button>
          {sortedMembers.map(m => {
            const isSelected = selectedPerson === m.userId;
            const paid = personPaidMap.get(m.userId) || 0;
            const displayName = m.userId === currentUser.id ? 'You' : m.name;
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => setSelectedPerson(isSelected ? 'all' : m.userId)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                  color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <span>{displayName}</span>
                {paid > 0 && (
                  <span style={{ 
                    fontSize: '0.7rem', 
                    opacity: 0.85, 
                    marginLeft: 4,
                    fontWeight: 700
                  }}>
                    • {formatMoney(paid, activeTrip?.mainCurrency || 'EUR')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Chips (Categories - Ordered by Highest to Lowest Spend) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Filter by Category
        </span>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: selectedCategory === 'all' ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
              color: selectedCategory === 'all' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 600,
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            All Categories
          </button>
          {sortedCategories.map(c => {
            const isSelected = selectedCategory === c.id;
            const spend = categorySpendMap.get(c.id) || 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : c.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                  color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <span>{c.emoji} {c.label}</span>
                {spend > 0 && (
                  <span style={{ 
                    fontSize: '0.7rem', 
                    opacity: 0.85, 
                    marginLeft: 4,
                    fontWeight: 700
                  }}>
                    • {formatMoney(spend, activeTrip?.mainCurrency || 'EUR')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expense List Items */}
      {filteredExpenses.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 20px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: '0.9rem',
          marginTop: 10
        }}>
          No expenses match your filters. Try clearing the search or category filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {filteredExpenses.map(exp => {
            const isSelfPayer = 
              exp.paidByUserId === currentUser.id || 
              (currentUser.email && exp.paidByUserId?.toLowerCase() === currentUser.email.toLowerCase()) ||
              (currentUser.name && exp.paidByUserId?.toLowerCase().includes(currentUser.name.toLowerCase())) ||
              (currentUser.email && exp.paidByUserId?.toLowerCase().includes(currentUser.email.split('@')[0].toLowerCase()));
            const payerName = exp.payers && exp.payers.length > 1
              ? `${exp.payers.length} people`
              : (isSelfPayer ? 'You' : resolveMemberName(exp.paidByUserId, members, currentUser, allUsers));

            const dateStr = new Date(exp.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={exp.id}
                onClick={() => setSelectedExpenseId(exp.id)}
                className="transaction-row"
              >
                <CategoryIcon category={exp.category} variant="strip" iconSize={17} />

                <div style={{ flex: 1, minWidth: 0, padding: '12px 16px 12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {exp.description}
                      </strong>
                      {exp.isFlaggedWrong && (
                        <AlertCircle size={14} color="var(--negative-text)" />
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Paid by {payerName} · {dateStr}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {getCurrencySymbol(exp.originalCurrency)}{exp.originalAmount.toFixed(2)}
                    </div>
                    {exp.originalCurrency !== exp.mainCurrency && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                        ≈ {formatMoney(exp.convertedAmount, exp.mainCurrency)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
