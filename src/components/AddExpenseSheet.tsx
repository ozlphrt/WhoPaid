import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { CATEGORIES, suggestCategory } from '../lib/category';
import { getCurrencySymbol, roundMoney, add, sub } from '../lib/decimal';
import { CurrencyCode, ExpenseCategory, ExpensePayer, ExpenseParticipant } from '../types';
import { ChevronDown, ChevronUp, Camera, AlertCircle, Plus, Trash2, Check } from 'lucide-react';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { CategoryIcon } from './CategoryIcon';

interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  editExpenseId?: string;
}

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'JPY'];

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
  }, [isOpen, editExpenseId, expenses, lastUsedCurrency, currentUser.id, activeMembers]);

  // Autocomplete descriptions from current trip only (Section 17)
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
      alert('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      alert('Please enter a description');
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

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editExpenseId ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        
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

        {/* 1. Large Amount Input */}
        <div className="amount-hero-input">
          <button 
            type="button"
            onClick={() => setShowMoreOptions(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4, 
              background: 'var(--bg-subtle)', 
              border: '1px solid var(--border-subtle)',
              padding: '6px 10px', 
              borderRadius: 'var(--radius-full)',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}
          >
            <span>{getCurrencySymbol(currency)}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{currency}</span>
          </button>
          
          <input
            type="number"
            step="any"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            className="amount-field"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />
        </div>

        {/* 2. Description with Autocomplete */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="What was this for? (e.g. Dinner, Taxi)"
            className="input-pill"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
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
              zIndex: 10,
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
                    borderBottom: idx < filteredSuggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Category Quick Chips */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Category
          </label>
          <div className="category-chips-grid">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`category-chip ${category === cat.id ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Expand / Collapse More Options */}
        <button
          type="button"
          onClick={() => setShowMoreOptions(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            padding: '6px 0',
            margin: '2px 0'
          }}
        >
          <span>{showMoreOptions ? 'Fewer options' : 'More options'}</span>
          {showMoreOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Expanded Options */}
        {showMoreOptions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            
            {/* Currency */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Currency
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COMMON_CURRENCIES.slice(0, 6).map(curr => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: currency === curr ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                      color: currency === curr ? 'var(--brand-text)' : 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              {currency !== activeTrip?.mainCurrency && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isManualFx}
                      onChange={(e) => setIsManualFx(e.target.checked)}
                    />
                    <span>Manually override exchange rate</span>
                  </label>

                  {isManualFx && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        1 {currency} =
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={manualFxRate}
                        onChange={(e) => setManualFxRate(e.target.value)}
                        className="input-pill"
                        style={{ width: 90, padding: '6px 10px' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {activeTrip?.mainCurrency}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Paid By */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Paid By
                </label>
                <button
                  type="button"
                  onClick={() => setIsMultiPayer(prev => !prev)}
                  style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'underline' }}
                >
                  {isMultiPayer ? 'Single payer' : 'Split payment'}
                </button>
              </div>

              {!isMultiPayer ? (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {activeMembers.map(m => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => setPaidByUserId(m.userId)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: paidByUserId === m.userId ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                        color: paidByUserId === m.userId ? 'var(--brand-text)' : 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {m.userId === currentUser.id ? 'You' : m.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeMembers.map(m => {
                    const payerObj = payers.find(p => p.userId === m.userId);
                    return (
                      <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{currency}</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={payerObj?.amount || ''}
                            onChange={(e) => handlePayerAmountChange(m.userId, e.target.value)}
                            className="input-pill"
                            style={{ width: 90, padding: '6px 8px', textAlign: 'right' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '0.78rem', textAlign: 'right', color: Math.abs(multiPayerTotal - parsedAmount) < 0.01 ? 'var(--positive-text)' : 'var(--negative-text)' }}>
                    Total: {currency} {multiPayerTotal.toFixed(2)} / {parsedAmount.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Split With */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Split With ({includedUserIds.length === activeMembers.length ? 'Everyone' : `${includedUserIds.length} people`})
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setSplitMode('equal')}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: splitMode === 'equal' ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                      color: splitMode === 'equal' ? 'var(--brand-text)' : 'var(--text-secondary)'
                    }}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('custom')}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: splitMode === 'custom' ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                      color: splitMode === 'custom' ? 'var(--brand-text)' : 'var(--text-secondary)'
                    }}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {splitMode === 'equal' ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeMembers.map(m => {
                    const isSelected = includedUserIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (includedUserIds.length > 1) {
                              setIncludedUserIds(prev => prev.filter(id => id !== m.userId));
                            }
                          } else {
                            setIncludedUserIds(prev => [...prev, m.userId]);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-full)',
                          background: isSelected ? 'var(--brand-primary)' : 'var(--bg-subtle)',
                          color: isSelected ? 'var(--brand-text)' : 'var(--text-tertiary)',
                          border: '1px solid var(--border-subtle)',
                          fontWeight: 600,
                          fontSize: '0.8rem'
                        }}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeMembers.map(m => {
                    const isIncluded = includedUserIds.includes(m.userId);
                    return (
                      <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setIncludedUserIds(prev => [...prev, m.userId]);
                              } else if (includedUserIds.length > 1) {
                                setIncludedUserIds(prev => prev.filter(id => id !== m.userId));
                              }
                            }}
                          />
                          <span>{m.name}</span>
                        </label>

                        {isIncluded && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{currency}</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={customShares[m.userId] || ''}
                              onChange={(e) => handleCustomShareChange(m.userId, e.target.value)}
                              className="input-pill"
                              style={{ width: 85, padding: '5px 8px', textAlign: 'right' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-pill"
              />
            </div>

            {/* Note */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ali wasn't with us"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-pill"
              />
            </div>

            {/* Receipt Photo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Receipt Photo
              </label>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleReceiptUpload}
                style={{ display: 'none' }}
              />
              
              {!receiptUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{ width: '100%' }}
                >
                  <Camera size={16} />
                  <span>Attach Receipt Photo</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-subtle)', padding: 8, borderRadius: 'var(--radius-md)' }}>
                  <img
                    src={receiptUrl}
                    alt="Receipt"
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                  <span style={{ fontSize: '0.82rem', flex: 1, fontWeight: 600 }}>Receipt attached</span>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl(undefined)}
                    className="nav-icon-btn"
                    style={{ width: 30, height: 30 }}
                  >
                    <Trash2 size={14} color="var(--negative-text)" />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Submit Button */}
        <button type="submit" className="btn-primary" style={{ marginTop: 6 }}>
          <span>{editExpenseId ? 'Save Changes' : 'Add Expense'}</span>
        </button>

      </form>
    </BottomSheet>
  );
};
