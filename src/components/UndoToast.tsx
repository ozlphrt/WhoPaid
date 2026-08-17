import React from 'react';
import { useApp } from '../store/AppContext';
import { RotateCcw, X } from 'lucide-react';

export const UndoToast: React.FC = () => {
  const { undoState, undoLastExpense, dismissUndo } = useApp();

  if (!undoState) return null;

  return (
    <div className="undo-toast animate-pop-in">
      <span>
        Added <strong>{undoState.expense.description}</strong>
      </span>
      
      <button 
        type="button"
        onClick={undoLastExpense}
        className="undo-btn"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={dismissUndo}
        style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', marginLeft: 4 }}
      >
        <X size={14} />
      </button>
    </div>
  );
};
