import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { CATEGORIES, suggestCategory } from '../lib/category';
import { getCurrencySymbol, roundMoney, add, sub } from '../lib/decimal';
import { CurrencyCode, ExpenseCategory, ExpensePayer, ExpenseParticipant } from '../types';
import { ChevronDown, ChevronUp, Camera, AlertCircle, Plus, Trash2, Check, User, Users } from 'lucide-react';
import { checkForDuplicateExpense } from '../lib/duplicate';

interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  editExpenseId?: string;
}

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export const AddExpenseSheet: React.FC<AddExpenseSheetProps> = ({
  isOpen,
  onClose,
  editExpenseId
}) => {
  const {
    activeTrip,
    currentUser,
    members,
    expenses,
    lastUsedCurrency,
    addExpense,
    updateExpense
  } = useApp();

  const activeMembers = useMemo(() => members.filter(m => m.isActive), [members]);

  // Form State
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [currency, setCurrency] = useState<CurrencyCode>(lastUsedCurrency);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  
  // Advanced State
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [isMultiPayer, setIsMultiPayer] = useState<boolean>(false);
  const [paidByUserId, setPaidByUserId] = useState<string>(currentUser.id);
  const [payers, setPayers] = useState<ExpensePayer[]>([]);
  const [includedUserIds, setIncludedUserIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  
  // FX Manual Override
  const [isManualFx, setIsManualFx] = useState<boolean>(false);
  const [manualFxRate, setManualFxRate] = useState<string>('1.00');

  // Autocomplete Suggestions
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or Reset form
  useEffect(() => {
    if (!isOpen) return;

    if (editExpenseId) {
      const exp = expenses.find(e => e.id === editExpenseId);
      if (exp) {
        setAmountStr(exp.originalAmount.toString());
        setDescription(exp.description);
        setCategory(exp.category);
        setCurrency(exp.originalCurrency);
        setDate(exp.date.slice(0, 16));
        setNote(exp.note || '');
        setReceiptUrl(exp.receiptUrl);
        setPaidByUserId(exp.paidByUserId);
        setIsMultiPayer(exp.payers && exp.payers.length > 1);
        setPayers(exp.payers || [{ userId: exp.paidByUserId, amount: exp.originalAmount }]);
        setIncludedUserIds(exp.participants.map(p => p.userId));
        setSplitMode(exp.splitMode);
        setIsManualFx(exp.isManualExchangeRate);
        setManualFxRate(exp.exchangeRate.toString());

        const shares: Record<string, string> = {};
        exp.participants.forEach(p => {
          shares[p.userId] = p.amount.toString();
        });
        setCustomShares(shares);
        setShowMoreOptions(true);
        return;
      }
    }

    // Default New Expense
    setAmountStr('');
    setDescription('');
    setCategory('Food');
    setCurrency(lastUsedCurrency);
    setDate(new Date().toISOString().slice(0, 16));
    setNote('');
    setReceiptUrl(undefined);
    setPaidByUserId(currentUser.id);
    setIsMultiPayer(false);
    setPayers([{ userId: currentUser.id, amount: 0 }]);
    setIncludedUserIds(activeMembers.map(m => m.userId));
    setSplitMode('equal');
    setCustomShares({});
    setIsManualFx(false);
    setManualFxRate('1.00');
    setShowMoreOptions(false);
    setShowCurrencyDropdown(false);
  }, [isOpen, editExpenseId, expenses, lastUsedCurrency, currentUser.id, activeMembers]);

  // Autocomplete descriptions from current trip
  const tripDescriptions = useMemo(() => {
    const unique = new Set<string>();
    expenses.forEach(e => {
      if (e.description && !e.isDeleted) unique.add(e.description);
    });
    return Array.from(unique);
  }, [expenses]);

  const filteredSuggestions = useMemo(() => {
    if (!description.trim() || description.length < 2) return [];
    return tripDescriptions.filter(d => 
      d.toLowerCase().startsWith(description.toLowerCase()) && d.toLowerCase() !== description.toLowerCase()
    ).slice(0, 4);
  }, [description, tripDescriptions]);

  // Auto-suggest category when description changes
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    const suggested = suggestCategory(text);
    setCategory(suggested);
  };

  // Duplicate Check Banner
  const parsedAmount = parseFloat(amountStr) || 0;
  const duplicateCheck = useMemo(() => {
    if (!parsedAmount || !description.trim()) return { isDuplicate: false };
    return checkForDuplicateExpense(
      {
        description,
        originalAmount: parsedAmount,
        originalCurrency: currency,
        paidByUserId: isMultiPayer ? (payers[0]?.userId || currentUser.id) : paidByUserId,
        date
      },
      expenses,
      editExpenseId
    );
  }, [parsedAmount, description, currency, paidByUserId, isMultiPayer, payers, currentUser.id, date, expenses, editExpenseId]);

  // Amount input filter (clean numbers without stepper arrows)
  const handleAmountChange = (val: string) => {
    // Allow digits and at most one decimal point
    if (/^\d*\.?\d*$/.test(val)) {
      setAmountStr(val);
    }
  };

  // Receipt File upload handler
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setReceiptUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Multi-Payer handlers
  const handlePayerAmountChange = (userId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setPayers(prev => {
      const exists = prev.find(p => p.userId === userId);
      if (exists) {
        return prev.map(p => p.userId === userId ? { ...p, amount: num } : p);
      }
      return [...prev, { userId, amount: num }];
    });
  };

  const multiPayerTotal = useMemo(() => {
    return payers.reduce((sum, p) => add(sum, p.amount), 0);
  }, [payers]);

  // Custom Split handlers
  const handleCustomShareChange = (userId: string, val: string) => {
    setCustomShares(prev => ({ ...prev, [userId]: val }));
  };

  const customSharesTotal = useMemo(() => {
    return includedUserIds.reduce((sum, id) => {
      const val = parseFloat(customShares[id] || '0') || 0;
      return add(sum, val);
    }, 0);
  }, [includedUserIds, customShares]);

  // Save Expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description (e.g. Dinner, Taxi)');
      return;
    }
    if (includedUserIds.length === 0) {
      alert('Please select at least one person included in this expense');
      return;
    }

    if (isMultiPayer && Math.abs(multiPayerTotal - parsedAmount) > 0.01) {
      alert(`Payer amounts (${currency} ${multiPayerTotal.toFixed(2)}) must equal total amount (${currency} ${parsedAmount.toFixed(2)})`);
      return;
    }

    if (splitMode === 'custom' && Math.abs(customSharesTotal - parsedAmount) > 0.01) {
      alert(`Custom shares (${currency} ${customSharesTotal.toFixed(2)}) must equal total amount (${currency} ${parsedAmount.toFixed(2)})`);
      return;
    }

    let participants: ExpenseParticipant[] = [];
    if (splitMode === 'custom') {
      participants = includedUserIds.map(uId => ({
        userId: uId,
        amount: roundMoney(parseFloat(customShares[uId] || '0') || 0, 2)
      }));
    } else {
      const equalShare = roundMoney(parsedAmount / includedUserIds.length, 2);
      participants = includedUserIds.map(uId => ({
        userId: uId,
        amount: equalShare
      }));
    }

    const payersPayload: ExpensePayer[] = isMultiPayer 
      ? payers.filter(p => p.amount > 0)
      : [{ userId: paidByUserId, amount: parsedAmount }];

    const expensePayload: Partial<import('../types').Expense> = {
      description: description.trim(),
      category,
      originalAmount: parsedAmount,
      originalCurrency: currency,
      date,
      note: note.trim() || undefined,
      receiptUrl,
      paidByUserId: isMultiPayer ? (payersPayload[0]?.userId || paidByUserId) : paidByUserId,
      payers: payersPayload,
      participants,
      splitMode,
      isManualExchangeRate: isManualFx,
      exchangeRate: isManualFx ? parseFloat(manualFxRate) || 1 : undefined
    };

    if (editExpenseId) {
      const existing = expenses.find(e => e.id === editExpenseId);
      if (existing) {
        await updateExpense({
          ...existing,
          ...expensePayload
        } as import('../types').Expense);
      }
    } else {
      await addExpense(expensePayload);
    }

    onClose();
  };

  const payerName = members.find(m => m.userId === paidByUserId)?.name || 'You';

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editExpenseId ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Possible Duplicate Warning */}
        {duplicateCheck.isDuplicate && (
          <div style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            color: 'var(--warning-text)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ display: 'block', fontWeight: 600 }}>Possible duplicate</strong>
              <span>{duplicateCheck.reason}</span>
            </div>
          </div>
        )}

        {/* 1. Large Amount Input Container */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          position: 'relative'
        }}>
          {/* Currency Pill Dropdown */}
          <button 
            type="button"
            onClick={() => setShowCurrencyDropdown(prev => !prev)}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              background: 'var(--bg-surface)', 
              border: '1px solid var(--border-subtle)',
              padding: '6px 12px', 
              borderRadius: 'var(--radius-full)',
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <span>{getCurrencySymbol(currency)}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currency}</span>
            <ChevronDown size={14} color="var(--text-tertiary)" />
          </button>

          {/* Amount Number Input (Clean, No Stepper Arrows) */}
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => handleAmountChange(e.target.value)}
            style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.03em'
            }}
            required
          />

          {/* Currency Dropdown Menu */}
          {showCurrencyDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 14,
              zIndex: 30,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 6,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 4,
              marginTop: 6
            }}>
              {COMMON_CURRENCIES.map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => {
                    setCurrency(curr);
                    setShowCurrencyDropdown(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: currency === curr ? 'var(--btn-primary-bg)' : 'transparent',
                    color: currency === curr ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {curr}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Description Input with Autocomplete */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="What was this for? (e.g. Dinner, Taxi, Groceries)"
            className="input-pill"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            style={{ fontSize: '0.95rem', padding: '13px 16px' }}
            required
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 20,
              marginTop: 4,
              overflow: 'hidden'
            }}>
              {filteredSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleDescriptionChange(suggestion);
                    setShowSuggestions(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Category Quick Pill Selectors (Inline Bulletproof Styling) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Category
          </label>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch'
          }}>
            {CATEGORIES.map(cat => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Quick Payer & Split Summary Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          padding: '12px 14px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
              Paid by
            </span>
            <select
              value={isMultiPayer ? 'multi' : paidByUserId}
              onChange={(e) => {
                if (e.target.value === 'multi') {
                  setIsMultiPayer(true);
                  setShowMoreOptions(true);
                } else {
                  setIsMultiPayer(false);
                  setPaidByUserId(e.target.value);
                }
              }}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}
            >
              {activeMembers.map(m => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUser.id ? 'You' : m.name}
                </option>
              ))}
              <option value="multi">Multiple people...</option>
            </select>
          </div>

          <div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
              Split with
            </span>
            <button
              type="button"
              onClick={() => setShowMoreOptions(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <span>
                {includedUserIds.length === activeMembers.length 
                  ? `All (${activeMembers.length})` 
                  : `${includedUserIds.length} people`}
              </span>
              <ChevronDown size={14} color="var(--text-tertiary)" />
            </button>
          </div>
        </div>

        {/* 5. More Options Toggle */}
        <button
          type="button"
          onClick={() => setShowMoreOptions(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.82rem',
            padding: '4px 0',
            cursor: 'pointer'
          }}
        >
          <span>{showMoreOptions ? 'Fewer options' : 'More options (date, notes, splits)'}</span>
          {showMoreOptions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {/* Expanded Options */}
        {showMoreOptions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            
            {/* Date Time */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Expense Date & Time
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-pill"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Split Mode & Participants Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Split Mode
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSplitMode('equal')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: splitMode === 'equal' ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                      color: splitMode === 'equal' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('custom')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: splitMode === 'custom' ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                      color: splitMode === 'custom' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    Custom Exact
                  </button>
                </div>
              </div>

              {/* Member Checkboxes & Custom Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius-md)' }}>
                {activeMembers.map(m => {
                  const isChecked = includedUserIds.includes(m.userId);
                  return (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setIncludedUserIds(prev => [...prev, m.userId]);
                            } else {
                              setIncludedUserIds(prev => prev.filter(id => id !== m.userId));
                            }
                          }}
                        />
                        <span>{m.name} {m.userId === currentUser.id && '(You)'}</span>
                      </label>

                      {splitMode === 'custom' && isChecked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{currency}</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={customShares[m.userId] || ''}
                            onChange={(e) => handleCustomShareChange(m.userId, e.target.value)}
                            style={{
                              width: 80,
                              padding: '4px 6px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-surface)',
                              fontSize: '0.85rem',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note & Receipt */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Additional notes..."
                className="input-pill"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              />
            </div>

          </div>
        )}

        {/* Big Submit Button */}
        <button
          type="submit"
          className="btn-primary"
          style={{
            marginTop: 4,
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 800,
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <span>{editExpenseId ? 'Save Changes' : 'Add Expense'}</span>
        </button>

      </form>
    </BottomSheet>
  );
};
