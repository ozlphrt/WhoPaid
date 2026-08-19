import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Trash2, X } from 'lucide-react';

export interface DialogOptions {
  type?: 'info' | 'success' | 'warning' | 'danger' | 'confirm';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface GlobalDialogProps {
  isOpen: boolean;
  options: DialogOptions | null;
  onClose: () => void;
}

export const GlobalDialog: React.FC<GlobalDialogProps> = ({
  isOpen,
  options,
  onClose
}) => {
  if (!isOpen || !options) return null;

  const isConfirmType = options.type === 'confirm' || Boolean(options.onConfirm && options.cancelText !== null);

  const getIcon = () => {
    switch (options.type) {
      case 'danger':
        return <Trash2 size={24} color="var(--negative-text)" />;
      case 'warning':
      case 'confirm':
        return <AlertTriangle size={24} color="var(--warning-text)" />;
      case 'success':
        return <CheckCircle size={24} color="var(--positive-text)" />;
      case 'info':
      default:
        return <Info size={24} color="var(--brand-500)" />;
    }
  };

  const handleConfirm = async () => {
    if (options.onConfirm) {
      await options.onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    onClose();
  };

  return (
    <div 
      className="sheet-backdrop" 
      onClick={handleCancel}
      style={{
        zIndex: 200,
        alignItems: 'center',
        padding: 20
      }}
    >
      <div 
        className="animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-dock)',
          width: '100%',
          maxWidth: 380,
          padding: '24px 22px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Icon Badge */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14
        }}>
          {getIcon()}
        </div>

        {/* Title */}
        {options.title && (
          <h3 style={{
            fontSize: '1.15rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 6px 0',
            color: 'var(--text-primary)'
          }}>
            {options.title}
          </h3>
        )}

        {/* Message */}
        <p style={{
          fontSize: '0.88rem',
          lineHeight: 1.45,
          color: 'var(--text-secondary)',
          margin: '0 0 20px 0',
          maxWidth: 320
        }}>
          {options.message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {isConfirmType && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
              style={{
                flex: 1,
                padding: '11px',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)'
              }}
            >
              {options.cancelText || 'Cancel'}
            </button>
          )}

          <button
            type="button"
            onClick={isConfirmType ? handleConfirm : onClose}
            style={{
              flex: 1,
              padding: '11px',
              fontSize: '0.88rem',
              fontWeight: 800,
              borderRadius: 'var(--radius-md)',
              background: options.isDestructive 
                ? 'var(--negative-text)' 
                : 'var(--btn-primary-bg)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {options.confirmText || 'OK'}
          </button>
        </div>

      </div>
    </div>
  );
};
