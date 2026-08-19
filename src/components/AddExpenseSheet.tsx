import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { CATEGORIES, suggestCategory } from '../lib/category';
import { getCurrencySymbol, roundMoney, add, sub, mul } from '../lib/decimal';
import { CurrencyCode, ExpenseCategory, ExpensePayer, ExpenseParticipant } from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Check, 
  Users, 
  User, 
  Calendar, 
  FileText, 
  Camera, 
  X, 
  Loader2, 
  Keyboard
} from 'lucide-react';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { compressAndUploadReceipt } from '../lib/firestoreSync';
import { parseReceiptText } from '../lib/receiptOcr';
import { NumericKeypad } from './NumericKeypad';

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
    updateExpense,
    isFirebaseActive,
    isOnline,
    showAlert
  } = useApp();

  const activeMembers = useMemo(() => members.filter(m => m.isActive), [members]);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  
  // Modal states for focused selection
  const [activeModal, setActiveModal] = useState<'none' | 'category' | 'paidBy' | 'splitWith' | 'currency'>('none');
  const [useNativeKeyboard, setUseNativeKeyboard] = useState<boolean>(false);

  // FX Manual Override
  const [isManualFx, setIsManualFx] = useState<boolean>(false);
  const [manualFxRate, setManualFxRate] = useState<string>('1.00');

  // Autocomplete Suggestions
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTrip) return;

    setIsUploadingReceipt(true);
    try {
      if (isFirebaseActive && isOnline) {
        const url = await compressAndUploadReceipt(activeTrip.id, file);
        setReceiptUrl(url);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setReceiptUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }

      const parsed = parseReceiptText(file.name.replace(/[._-]/g, ' '));
      if (parsed.amount && !amountStr) {
        setAmountStr(parsed.amount.toString());
      }
      if (parsed.currency && (!currency || currency === lastUsedCurrency)) {
        setCurrency(parsed.currency);
      }
      if (parsed.vendor && !description) {
        setDescription(parsed.vendor);
        if (parsed.category) setCategory(parsed.category);
      }
    } catch (err: any) {
      console.warn('Firebase upload fallback to local dataURL:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Initialize or Reset form
  useEffect(() => {
    if (!isOpen) {
      setActiveModal('none');
      return;
    }

    if (editExpenseId) {
      const exp = expenses.find(e => e.id === editExpenseId);
      if (exp) {
        setAmountStr(exp.originalAmount != null ? exp.originalAmount.toString() : '');
        setDescription(exp.description || '');
        setCategory(exp.category || 'Food');
        setCurrency(exp.originalCurrency || lastUsedCurrency);
        setDate(exp.date ? exp.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
        setNote(exp.note || '');
        setReceiptUrl(exp.receiptUrl);
        setPaidByUserId(exp.paidByUserId || currentUser.id);
        setIsMultiPayer(Boolean(exp.payers && exp.payers.length > 1));
        setPayers(exp.payers || [{ userId: exp.paidByUserId || currentUser.id, amount: exp.originalAmount || 0 }]);
        setIncludedUserIds(exp.participants ? exp.participants.map(p => p.userId) : activeMembers.map(m => m.userId));
        setSplitMode(exp.splitMode || 'equal');
        setIsManualFx(Boolean(exp.isManualExchangeRate));
        setManualFxRate(exp.exchangeRate != null ? exp.exchangeRate.toString() : '1.00');

        const shares: Record<string, string> = {};
        if (exp.participants) {
          exp.participants.forEach(p => {
            shares[p.userId] = p.amount != null ? p.amount.toString() : '0';
          });
        }
        setCustomShares(shares);
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
    setPayers(activeMembers.map(m => ({
      userId: m.userId,
      amount: m.userId === currentUser.id ? 0 : 0
    })));
    setIncludedUserIds(activeMembers.map(m => m.userId));
    setSplitMode('equal');
    setCustomShares({});
    setIsManualFx(false);
    setManualFxRate('1.00');
    setShowMoreOptions(false);
    setActiveModal('none');
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
    ).slice(0, 3);
  }, [description, tripDescriptions]);

  // Auto-suggest category when description changes
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    const suggested = suggestCategory(text);
    setCategory(suggested);
  };

  const parsedAmount = parseFloat(amountStr) || 0;

  // Duplicate Check Banner
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

  const handleSplitPaidEqually = () => {
    if (!parsedAmount || parsedAmount <= 0) return;
    const count = activeMembers.length;
    if (count === 0) return;
    const share = roundMoney(parsedAmount / count, 2);
    setPayers(activeMembers.map((m, idx) => ({
      userId: m.userId,
      amount: idx === 0 ? roundMoney(sub(parsedAmount, mul(share, count - 1)), 2) : share
    })));
  };

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

  // Switch to Custom Split and prefill with equal portions
  const handleSetSplitModeCustom = () => {
    setSplitMode('custom');
    if (parsedAmount > 0 && includedUserIds.length > 0) {
      const share = roundMoney(parsedAmount / includedUserIds.length, 2);
      const shares: Record<string, string> = {};
      includedUserIds.forEach((id, idx) => {
        shares[id] = idx === 0 
          ? roundMoney(sub(parsedAmount, mul(share, includedUserIds.length - 1)), 2).toString()
          : share.toString();
      });
      setCustomShares(shares);
    }
  };

  // Save Expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert('Please enter a valid amount greater than 0.', 'Invalid Amount', 'warning');
      return;
    }
    if (!description.trim()) {
      showAlert('Please enter an expense name (e.g. Dinner, Taxi).', 'Missing Expense Name', 'warning');
      return;
    }
    if (includedUserIds.length === 0) {
      showAlert('Please select at least one person included in this expense.', 'Select Participants', 'warning');
      return;
    }

    if (isMultiPayer && Math.abs(multiPayerTotal - parsedAmount) > 0.01) {
      showAlert(`Payer amounts (${currency} ${multiPayerTotal.toFixed(2)}) must equal total amount (${currency} ${parsedAmount.toFixed(2)}).`, 'Payer Total Mismatch', 'warning');
      return;
    }

    let effectiveSplitMode = splitMode;
    let participants: ExpenseParticipant[] = [];

    if (effectiveSplitMode === 'custom') {
      if (customSharesTotal <= 0) {
        // If no custom amounts were typed, safely default to equal split
        effectiveSplitMode = 'equal';
      } else if (Math.abs(customSharesTotal - parsedAmount) > 0.01) {
        showAlert(`Custom shares (${currency} ${customSharesTotal.toFixed(2)}) must equal total amount (${currency} ${parsedAmount.toFixed(2)}).`, 'Custom Share Mismatch', 'warning');
        return;
      }
    }

    if (effectiveSplitMode === 'custom') {
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
      splitMode: effectiveSplitMode,
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

  const payerName = isMultiPayer
    ? 'Multiple'
    : (activeMembers.find(m => m.userId === paidByUserId)?.name || (paidByUserId === currentUser.id ? 'You' : 'Member'));

  const splitLabel = includedUserIds.length === activeMembers.length
    ? `Everyone (${activeMembers.length})`
    : `${includedUserIds.length} Person${includedUserIds.length > 1 ? 's' : ''}`;

  const currentCategoryObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editExpenseId ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        
        {/* Possible Duplicate Warning */}
        {duplicateCheck.isDuplicate && (
          <div style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            color: 'var(--warning-text)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>Possible duplicate: {duplicateCheck.reason}</span>
          </div>
        )}

        {/* 1. Centered Hero Amount Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px 8px',
          position: 'relative'
        }}>
          {/* Floating Currency Pill (Top Right) */}
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button 
              type="button"
              onClick={() => setActiveModal('currency')}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 4, 
                background: 'var(--bg-subtle)', 
                border: '1px solid var(--border-subtle)',
                padding: '4px 9px', 
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <span>{currency}</span>
              <ChevronDown size={11} color="var(--text-tertiary)" />
            </button>

            {/* Keyboard Switcher */}
            <button
              type="button"
              onClick={() => setUseNativeKeyboard(prev => !prev)}
              title={useNativeKeyboard ? 'Use In-App Keypad' : 'Use System Keyboard'}
              style={{
                background: 'transparent',
                border: 'none',
                color: useNativeKeyboard ? 'var(--brand-500)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Keyboard size={14} />
            </button>
          </div>

          {/* Centered Large Typography */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
              {getCurrencySymbol(currency)}
            </span>
            {useNativeKeyboard ? (
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value)) setAmountStr(e.target.value);
                }}
                style={{
                  fontSize: '2.6rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  width: '180px',
                  textAlign: 'center',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.03em'
                }}
              />
            ) : (
              <div 
                style={{
                  fontSize: '2.6rem',
                  fontWeight: 800,
                  color: amountStr ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '-0.03em',
                  cursor: 'pointer'
                }}
              >
                {amountStr || '0.00'}
              </div>
            )}
          </div>
        </div>

        {/* 2. Grouped Info Card (Title Input + 3 Config Pills) */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          {/* Title Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Expense title (e.g. Dinner, Taxi, Drinks)"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
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
                marginTop: 2,
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
                      padding: '7px 12px',
                      fontSize: '0.82rem',
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

          {/* 3 Config Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            <button
              type="button"
              onClick={() => setActiveModal('category')}
              className="config-pill-btn"
              style={{ padding: '6px 8px', fontSize: '0.78rem', justifyContent: 'center' }}
            >
              <span>{currentCategoryObj.emoji}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentCategoryObj.label}</span>
              <ChevronDown size={11} color="var(--text-tertiary)" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('paidBy')}
              className="config-pill-btn"
              style={{ padding: '6px 8px', fontSize: '0.78rem', justifyContent: 'center' }}
            >
              <User size={12} color="var(--text-tertiary)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{payerName}</span>
              <ChevronDown size={11} color="var(--text-tertiary)" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('splitWith')}
              className="config-pill-btn"
              style={{ padding: '6px 8px', fontSize: '0.78rem', justifyContent: 'center' }}
            >
              <Users size={12} color="var(--text-tertiary)" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitLabel}</span>
              <ChevronDown size={11} color="var(--text-tertiary)" />
            </button>
          </div>
        </div>

        {/* 3. In-App Numeric Keypad (Compact Oval Keys) */}
        {!useNativeKeyboard && (
          <div style={{
            background: 'var(--bg-subtle)',
            padding: 5,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            marginTop: 2
          }}>
            <NumericKeypad
              value={amountStr}
              onChange={setAmountStr}
            />
          </div>
        )}

        {/* 5. More Options Toggle (Date, Note, Receipt, FX) */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setShowMoreOptions(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              fontSize: '0.74rem',
              padding: '2px 6px',
              cursor: 'pointer',
              background: 'none',
              border: 'none'
            }}
          >
            <span>{showMoreOptions ? 'Hide details' : '+ More options (date, receipt photo, notes)'}</span>
            {showMoreOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Expanded Options Drawer */}
        {showMoreOptions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            
            {/* Date Time */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                Date & Time
              </label>
              <input
                type="datetime-local"
                className="input-pill"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '6px 10px' }}
              />
            </div>

            {/* Receipt Photo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                Receipt Photo
              </label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReceiptFile}
                style={{ display: 'none' }}
              />

              {receiptUrl ? (
                <div style={{ position: 'relative', width: 70, height: 70, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
                  <img src={receiptUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setReceiptUrl(undefined)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingReceipt}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-subtle)',
                    border: '1px dashed var(--border-strong)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isUploadingReceipt ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                  <span>{isUploadingReceipt ? 'Uploading...' : 'Attach Receipt'}</span>
                </button>
              )}
            </div>

            {/* Note */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 2 }}>
                Note
              </label>
              <textarea
                rows={2}
                placeholder="Add details, notes or order items..."
                className="input-pill"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ borderRadius: 'var(--radius-md)', resize: 'vertical', fontSize: '0.82rem', padding: '6px 10px' }}
              />
            </div>
          </div>
        )}

        {/* Primary Save Button */}
        <button
          type="submit"
          className="btn-primary"
          style={{
            padding: '11px',
            fontSize: '0.92rem',
            fontWeight: 800,
            borderRadius: 'var(--radius-md)'
          }}
        >
          <span>Save Expense {parsedAmount > 0 ? `• ${getCurrencySymbol(currency)}${parsedAmount.toFixed(2)}` : ''}</span>
        </button>

      </form>

      {/* ========================================================================= */}
      {/* 6. Focused Sub-Modals (Clean, Non-Cluttered Focused Selection)            */}
      {/* ========================================================================= */}

      {/* Modal A: Category Selector */}
      {activeModal === 'category' && (
        <div className="sheet-backdrop" onClick={() => setActiveModal('none')}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Select Category</h3>
              <button type="button" onClick={() => setActiveModal('none')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--text-tertiary)" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    setActiveModal('none');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: category === cat.id ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: category === cat.id ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    border: `1px solid ${category === cat.id ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal B: Paid By Selector */}
      {activeModal === 'paidBy' && (
        <div className="sheet-backdrop" onClick={() => setActiveModal('none')}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Who Paid for this?</h3>
              <button type="button" onClick={() => setActiveModal('none')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--text-tertiary)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeMembers.map(m => {
                const isSelected = !isMultiPayer && paidByUserId === m.userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => {
                      setIsMultiPayer(false);
                      setPaidByUserId(m.userId);
                      setActiveModal('none');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                      color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span>{m.name} {m.userId === currentUser.id && '(You)'}</span>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })}

              {/* Multiple Payers Option */}
              <button
                type="button"
                onClick={() => {
                  setIsMultiPayer(true);
                  if (payers.length <= 1) {
                    setPayers(activeMembers.map(m => ({
                      userId: m.userId,
                      amount: m.userId === paidByUserId ? (parsedAmount || 0) : 0
                    })));
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: isMultiPayer ? 'var(--bg-surface)' : 'transparent',
                  color: isMultiPayer ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: '1px dashed var(--border-strong)',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 6
                }}
              >
                <span>+ Split Paid Amount Among Multiple People</span>
              </button>
            </div>

            {/* If Multi-Payer is Active in Modal */}
            {isMultiPayer && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Payer Amounts
                  </span>
                  <button
                    type="button"
                    onClick={handleSplitPaidEqually}
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Split Equally
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeMembers.map(m => {
                    const payerObj = payers.find(p => p.userId === m.userId);
                    const currentVal = payerObj ? (payerObj.amount > 0 ? payerObj.amount.toString() : '') : '';
                    return (
                      <div key={m.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{currency}</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={currentVal}
                            onChange={(e) => handlePayerAmountChange(m.userId, e.target.value)}
                            style={{
                              width: 80,
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-surface)',
                              fontSize: '0.88rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: 12, padding: '10px' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal C: Split With Selector */}
      {activeModal === 'splitWith' && (
        <div className="sheet-backdrop" onClick={() => setActiveModal('none')}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Split With</h3>
              <button type="button" onClick={() => setActiveModal('none')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--text-tertiary)" />
              </button>
            </div>

            {/* Split Mode Tabs (Equal vs Custom) */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-subtle)', padding: 4, borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: splitMode === 'equal' ? 'var(--btn-primary-bg)' : 'transparent',
                  color: splitMode === 'equal' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Split Equally
              </button>
              <button
                type="button"
                onClick={handleSetSplitModeCustom}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: splitMode === 'custom' ? 'var(--btn-primary-bg)' : 'transparent',
                  color: splitMode === 'custom' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Custom Amounts
              </button>
            </div>

            {/* Member Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Select All */}
              <button
                type="button"
                onClick={() => {
                  setIncludedUserIds(activeMembers.map(m => m.userId));
                  if (splitMode === 'custom' && parsedAmount > 0) {
                    const share = roundMoney(parsedAmount / activeMembers.length, 2);
                    const shares: Record<string, string> = {};
                    activeMembers.forEach((m, idx) => {
                      shares[m.userId] = idx === 0 
                        ? roundMoney(sub(parsedAmount, mul(share, activeMembers.length - 1)), 2).toString()
                        : share.toString();
                    });
                    setCustomShares(shares);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: includedUserIds.length === activeMembers.length ? 'var(--bg-surface)' : 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <span>Select Everyone ({activeMembers.length})</span>
                {includedUserIds.length === activeMembers.length && <Check size={16} color="var(--brand-600)" />}
              </button>

              {activeMembers.map(m => {
                const isIncluded = includedUserIds.includes(m.userId);
                return (
                  <div
                    key={m.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div 
                      onClick={() => {
                        if (isIncluded) {
                          if (includedUserIds.length > 1) {
                            setIncludedUserIds(prev => prev.filter(id => id !== m.userId));
                          }
                        } else {
                          setIncludedUserIds(prev => [...prev, m.userId]);
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `1.5px solid ${isIncluded ? 'var(--brand-600)' : 'var(--border-strong)'}`,
                        background: isIncluded ? 'var(--brand-600)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        {isIncluded && <Check size={14} />}
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{m.name}</span>
                    </div>

                    {/* If Custom Split mode is selected */}
                    {splitMode === 'custom' && isIncluded && (
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
                            padding: '5px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                            fontSize: '0.88rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="btn-primary"
              style={{ width: '100%', marginTop: 14, padding: '10px' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Modal D: Currency Selector */}
      {activeModal === 'currency' && (
        <div className="sheet-backdrop" onClick={() => setActiveModal('none')}>
          <div className="sheet-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Select Currency</h3>
              <button type="button" onClick={() => setActiveModal('none')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--text-tertiary)" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {COMMON_CURRENCIES.map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => {
                    setCurrency(curr);
                    setActiveModal('none');
                  }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    background: currency === curr ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                    color: currency === curr ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                    border: `1px solid ${currency === curr ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </BottomSheet>
  );
};
