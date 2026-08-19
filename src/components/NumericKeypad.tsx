import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange
}) => {
  const handleDigit = (digit: string) => {
    if (value === '0' && digit !== '.') {
      onChange(digit);
      return;
    }
    // Limit decimal precision to 2 decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }
    // Limit overall length
    if (value.length >= 9) return;
    onChange(value + digit);
  };

  const handleDecimal = () => {
    if (!value) {
      onChange('0.');
      return;
    }
    if (!value.includes('.')) {
      onChange(value + '.');
    }
  };

  const handleBackspace = () => {
    if (!value || value.length <= 1) {
      onChange('');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const keys = [
    { label: '1', action: () => handleDigit('1') },
    { label: '2', action: () => handleDigit('2') },
    { label: '3', action: () => handleDigit('3') },
    { label: '4', action: () => handleDigit('4') },
    { label: '5', action: () => handleDigit('5') },
    { label: '6', action: () => handleDigit('6') },
    { label: '7', action: () => handleDigit('7') },
    { label: '8', action: () => handleDigit('8') },
    { label: '9', action: () => handleDigit('9') },
    { label: '.', action: handleDecimal },
    { label: '0', action: () => handleDigit('0') },
    { label: 'backspace', icon: <Delete size={20} />, action: handleBackspace }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 6,
      width: '100%',
      paddingTop: 4,
      userSelect: 'none'
    }}>
      {keys.map((k, idx) => (
        <button
          key={idx}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            k.action();
          }}
          className="keypad-btn"
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            fontWeight: 700,
            fontFamily: 'var(--font-main)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            touchAction: 'manipulation',
            transition: 'all 0.1s ease',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {k.icon ? k.icon : k.label}
        </button>
      ))}
    </div>
  );
};
