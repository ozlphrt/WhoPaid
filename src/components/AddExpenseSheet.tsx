import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { BottomSheet } from './BottomSheet';
import { CATEGORIES, suggestCategory } from '../lib/category';
import { getCurrencySymbol, formatAmount, roundMoney, add, sub, mul } from '../lib/decimal';
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
  Keyboard,
  SlidersHorizontal
} from 'lucide-react';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { compressAndUploadReceipt } from '../lib/supabaseSync';
import { parseReceiptText } from '../lib/receiptOcr';
import { NumericKeypad } from './NumericKeypad';
import { acquireSingleFlight, releaseSingleFlight } from '../lib/asyncReliability';
import { fetchHistoricalExchangeRate } from '../lib/fx';

interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  editExpenseId?: string;
}

const COMMON_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN'];

const AVATAR_PALETTES = [
  { bg: 'rgba(99, 117, 143, 0.25)', border: '#63758f', text: '#cbd5e1' },
  { bg: 'rgba(59, 130, 246, 0.22)', border: '#3b82f6', text: '#93c5fd' },
  { bg: 'rgba(16, 185, 129, 0.22)', border: '#10b981', text: '#6ee7b7' },
  { bg: 'rgba(245, 158, 11, 0.22)', border: '#f59e0b', text: '#fcd34d' },
  { bg: 'rgba(139, 92, 246, 0.22)', border: '#8b5cf6', text: '#c4b5fd' },
  { bg: 'rgba(236, 72, 153, 0.22)', border: '#ec4899', text: '#f472b6' },
  { bg: 'rgba(20, 184, 166, 0.22)', border: '#14b8a6', text: '#5eead4' },
];

function getMemberAvatarPalette(index: number) {
  return AVATAR_PALETTES[index % AVATAR_PALETTES.length];
}

function getMemberInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
    showAlert
  } = useApp();

  const activeMembers = useMemo(() => members.filter(m => m.isActive), [members]);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionInFlightRef = useRef(false);

  // Form State
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [currency, setCurrency] = useState<CurrencyCode>(lastUsedCurrency);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  
  // Toolbelt active drawer state: 'none' | 'date' | 'note'
  const [activeToolDrawer, setActiveToolDrawer] = useState<'none' | 'date' | 'note'>('none');

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

  // FX Conversion State
  const [autoFxRate, setAutoFxRate] = useState<number>(1);
  const [isManualFx, setIsManualFx] = useState<boolean>(false);
  const [manualFxRate, setManualFxRate] = useState<string>('1.00');

  // Autocomplete Suggestions
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // FX Rate Fetching for foreign currencies
  useEffect(() => {
    if (!activeTrip || currency === activeTrip.mainCurrency) {
      setAutoFxRate(1);
      return;
    }
    let isMounted = true;
    const fetchRate = async () => {
      try {
        const dateStr = date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const res = await fetchHistoricalExchangeRate(currency, activeTrip.mainCurrency, dateStr);
        if (isMounted && res.rate) {
          setAutoFxRate(res.rate);
        }
      } catch (err) {
        console.warn('FX fetch failed in AddExpenseSheet:', err);
      }
    };
    fetchRate();
    return () => { isMounted = false; };
  }, [currency, activeTrip, date]);

  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTrip) return;

    setIsUploadingReceipt(true);
    try {
      const url = await compressAndUploadReceipt(activeTrip.id, file);
      setReceiptUrl(url);

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
      console.warn('Receipt compression fallback to local data URL:', err);
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
      setActiveToolDrawer('none');
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
    setActiveToolDrawer('none');
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

  // Direct toggle member in avatar strip
  const handleToggleMember = (userId: string) => {
    if (splitMode === 'custom') {
      setActiveModal('splitWith');
      return;
    }
    setIncludedUserIds(prev => {
      if (prev.includes(userId)) {
        if (prev.length <= 1) {
          showAlert('At least one member must be included in the split.', 'Split Requirement', 'info');
          return prev;
        }
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  // Save Expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current) return;
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert('Please enter a valid amount greater than 0.', 'Invalid Amount', 'warning');
      return;
    }
    if (!description.trim()) {
      showAlert('Please enter an expense title (e.g. Dinner, Taxi).', 'Missing Title', 'warning');
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

    if (!acquireSingleFlight(submissionInFlightRef)) return;
    setIsSubmitting(true);
    try {
      if (editExpenseId) {
        const existing = expenses.find(e => e.id === editExpenseId);
        if (!existing) throw new Error('This expense is no longer available.');
        await updateExpense({
          ...existing,
          ...expensePayload
        } as import('../types').Expense);
      } else {
        await addExpense(expensePayload);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose();
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : 'The expense could not be saved. Please try again.',
        'Expense Not Saved',
        'warning'
      );
    } finally {
      releaseSingleFlight(submissionInFlightRef);
      setIsSubmitting(false);
    }
  };

  const payerName = isMultiPayer
    ? 'Multiple Payers'
    : (activeMembers.find(m => m.userId === paidByUserId)?.name || (paidByUserId === currentUser.id ? 'You' : 'Member'));

  const activeCount = includedUserIds.length;
  const perPersonShare = parsedAmount > 0 && activeCount > 0
    ? roundMoney(parsedAmount / activeCount, 2)
    : 0;

  const isForeignCurrency = activeTrip && currency !== activeTrip.mainCurrency;
  const convertedAmount = isForeignCurrency
    ? roundMoney(parsedAmount * (isManualFx ? (parseFloat(manualFxRate) || 1) : autoFxRate), 2)
    : 0;

  const dateObj = new Date(date);
  const isToday = new Date().toDateString() === dateObj.toDateString();
  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateToolLabel = isToday ? `Today, ${formattedTime}` : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      fullScreen={true}
      title={editExpenseId ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        
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

        {/* 1. Hero Amount & Live Split Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 12px 4px',
          position: 'relative'
        }}>
          {/* Floating Currency Pill & Native Keyboard Switcher (Top Right) */}
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
                padding: '4px 10px', 
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <span>{currency}</span>
              <ChevronDown size={12} color="var(--text-tertiary)" />
            </button>

            <button
              type="button"
              onClick={() => setUseNativeKeyboard(prev => !prev)}
              title={useNativeKeyboard ? 'Use In-App Keypad' : 'Use System Keyboard'}
              style={{
                background: 'transparent',
                border: 'none',
                color: useNativeKeyboard ? 'var(--brand-500)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Keyboard size={16} />
            </button>
          </div>

          {/* Centered Hero Monetary Typography */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
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
                  fontSize: '2.7rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  width: '200px',
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
                  fontSize: '2.7rem',
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

          {/* Dynamic Live Split Breakdown Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            background: parsedAmount > 0 ? 'var(--positive-bg)' : 'var(--bg-subtle)',
            border: `1px solid ${parsedAmount > 0 ? 'var(--positive-border)' : 'var(--border-subtle)'}`,
            color: parsedAmount > 0 ? 'var(--positive-text)' : 'var(--text-tertiary)',
            fontSize: '0.78rem',
            fontWeight: 700,
            transition: 'all 0.15s ease'
          }}>
            <Users size={12} />
            <span>
              {parsedAmount > 0 
                ? splitMode === 'custom' 
                  ? `Custom split • ${activeCount} members`
                  : `€${perPersonShare.toFixed(2)} each • ${activeCount} included`
                : `Split with ${activeCount === activeMembers.length ? `Everyone (${activeMembers.length})` : `${activeCount} members`}`
              }
            </span>
          </div>

          {/* Foreign Currency FX Badge */}
          {isForeignCurrency && parsedAmount > 0 && (
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--text-tertiary)',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span>≈ {formatAmount(convertedAmount, activeTrip.mainCurrency)}</span>
              <span>(1 {currency} = {isManualFx ? manualFxRate : autoFxRate.toFixed(3)} {activeTrip.mainCurrency})</span>
            </div>
          )}
        </div>

        {/* 2. Expense Title Input & 1-Tap Category Emoji Strip */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Expense title (e.g. Dinner, Taxi, Groceries)"
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
                fontSize: '0.9rem',
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

          {/* 1-Tap Category Emoji Strip */}
          <div className="category-emoji-strip">
            {CATEGORIES.map(cat => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`category-pill-chip ${isSelected ? 'active' : ''}`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Direct-Tap Member Avatar Strip */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Split With
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                {splitMode === 'custom' ? '• Custom Amounts' : '• Tap to toggle'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('splitWith')}
              style={{
                background: 'transparent',
                border: 'none',
                color: splitMode === 'custom' ? 'var(--brand-500)' : 'var(--accent-primary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 4px'
              }}
            >
              <SlidersHorizontal size={11} />
              <span>{splitMode === 'custom' ? 'Edit Shares' : 'Custom Split'}</span>
            </button>
          </div>

          {/* Interactive Member Avatars */}
          <div className="avatar-strip-container">
            {activeMembers.map((m, idx) => {
              const isIncluded = includedUserIds.includes(m.userId);
              const palette = getMemberAvatarPalette(idx);
              const initials = getMemberInitials(m.name);
              const isPayer = !isMultiPayer && paidByUserId === m.userId;

              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => handleToggleMember(m.userId)}
                  className={`avatar-member-chip ${isIncluded ? 'active' : ''}`}
                  title={`${m.name} (${isIncluded ? 'Included in split' : 'Excluded'})`}
                >
                  <div 
                    className={`avatar-bubble ${isIncluded ? 'included' : 'excluded'}`}
                    style={{
                      backgroundColor: palette.bg,
                      color: palette.text
                    }}
                  >
                    <span>{initials}</span>
                    {isIncluded && (
                      <div className="avatar-check-badge">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className="avatar-name-label">
                    {m.userId === currentUser.id ? 'You' : m.name}
                  </span>
                  {isPayer && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--accent-primary)', fontWeight: 800, marginTop: -3 }}>
                      (Payer)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Paid By Selector Row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setActiveModal('paidBy')}
            className="config-pill-btn"
            style={{ 
              flex: 1, 
              justifyContent: 'space-between', 
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={13} color="var(--text-tertiary)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Paid by:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{payerName}</span>
            </div>
            <ChevronDown size={12} color="var(--text-tertiary)" />
          </button>
        </div>

        {/* 5. Surfaced Quick Toolbelt (Scan Receipt, Date, Note) */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReceiptFile}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingReceipt}
            className={`toolbelt-btn ${receiptUrl ? 'active' : ''}`}
            title="Attach Receipt Photo"
          >
            {isUploadingReceipt ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            <span>{isUploadingReceipt ? 'Uploading...' : receiptUrl ? 'Receipt Attached ✓' : 'Scan Receipt'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveToolDrawer(prev => prev === 'date' ? 'none' : 'date')}
            className={`toolbelt-btn ${activeToolDrawer === 'date' ? 'active' : ''}`}
          >
            <Calendar size={13} />
            <span>{dateToolLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveToolDrawer(prev => prev === 'note' ? 'none' : 'note')}
            className={`toolbelt-btn ${note.trim() ? 'active' : ''}`}
          >
            <FileText size={13} />
            <span>{note.trim() ? 'Note Added' : 'Add Note'}</span>
          </button>
        </div>

        {/* Expandable Tool Drawer (Date or Note) */}
        {activeToolDrawer === 'date' && (
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Date & Time
              </span>
              <button 
                type="button"
                onClick={() => setDate(new Date().toISOString().slice(0, 16))}
                style={{ fontSize: '0.72rem', color: 'var(--brand-500)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                Set to Now
              </button>
            </div>
            <input
              type="datetime-local"
              className="input-pill"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '6px 10px' }}
            />
          </div>
        )}

        {activeToolDrawer === 'note' && (
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Expense Notes
              </span>
              {note.trim() && (
                <button 
                  type="button" 
                  onClick={() => setNote('')}
                  style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              rows={2}
              placeholder="Add extra details, order breakdown or comments..."
              className="input-pill"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ borderRadius: 'var(--radius-sm)', resize: 'none', fontSize: '0.82rem', padding: '6px 10px' }}
            />
          </div>
        )}

        {/* Receipt Attached Preview Bar */}
        {receiptUrl && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
                <img src={receiptUrl} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Receipt attached</span>
            </div>
            <button
              type="button"
              onClick={() => setReceiptUrl(undefined)}
              style={{ background: 'none', border: 'none', color: 'var(--negative-text)', cursor: 'pointer', padding: 4 }}
              title="Remove receipt"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 6. Clean In-App 3-Column Numeric Keypad */}
        {!useNativeKeyboard && (
          <div style={{
            background: 'var(--bg-subtle)',
            padding: 5,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            marginTop: 'auto'
          }}>
            <NumericKeypad
              value={amountStr}
              onChange={setAmountStr}
            />
          </div>
        )}

        {/* 7. Primary Action Button */}
        <button
          type="submit"
          disabled={isSubmitting || isUploadingReceipt}
          className="btn-primary"
          style={{
            padding: '12px',
            fontSize: '0.95rem',
            fontWeight: 800,
            borderRadius: 'var(--radius-md)',
            marginTop: useNativeKeyboard ? 'auto' : 2
          }}
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          <span>
            {isSubmitting 
              ? 'Saving Expense…' 
              : `Save Expense ${parsedAmount > 0 ? `• ${formatAmount(parsedAmount, currency)}` : ''}`
            }
          </span>
        </button>

      </form>

      {/* ========================================================================= */}
      {/* 8. Sub-Modals (Category, Paid By, Custom Split, Currency)                  */}
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
              {activeMembers.map((m, idx) => {
                const isSelected = !isMultiPayer && paidByUserId === m.userId;
                const palette = getMemberAvatarPalette(idx);
                const initials = getMemberInitials(m.name);
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
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--btn-primary-bg)' : 'var(--bg-subtle)',
                      color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--btn-primary-border)' : 'var(--border-subtle)'}`,
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: palette.bg,
                        color: palette.text,
                        border: `1.5px solid ${palette.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800
                      }}>
                        {initials}
                      </div>
                      <span>{m.name} {m.userId === currentUser.id && '(You)'}</span>
                    </div>
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
                  color: isMultiPayer ? 'var(--brand-500)' : 'var(--text-secondary)',
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
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-500)', background: 'none', border: 'none', cursor: 'pointer' }}
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

      {/* Modal C: Split With Selector & Custom Shares */}
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
                {includedUserIds.length === activeMembers.length && <Check size={16} color="var(--brand-500)" />}
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
                        border: `1.5px solid ${isIncluded ? 'var(--brand-500)' : 'var(--border-strong)'}`,
                        background: isIncluded ? 'var(--brand-500)' : 'transparent',
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
