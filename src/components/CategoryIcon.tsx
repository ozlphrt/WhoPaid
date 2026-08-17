import React from 'react';
import { ExpenseCategory } from '../types';

interface CategoryIconProps {
  category: ExpenseCategory;
  size?: number;
  iconSize?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 42,
  iconSize = 20,
  className = ''
}) => {
  const getCategoryConfig = () => {
    switch (category) {
      case 'Food':
        return {
          // Muted Warm Cognac / Amber
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
              <path d="M8 3v9" />
              <path d="M8 12v9" />
              <path d="M16 3v6a3 3 0 0 1-3 3h0" />
              <path d="M16 3a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h0v9" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #b88648 0%, #99682e 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };

      case 'Drinks':
        return {
          // Muted Dusty Lavender Plum
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16l-8 9-8-9Z" />
              <path d="M12 14v7" />
              <path d="M8 21h8" />
              <circle cx="15.5" cy="4.5" r="1.5" fill="#ffffff" />
              <path d="M13.5 6.5L17 3" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #8a6ea6 0%, #6e508c 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };

      case 'Transport':
        return {
          // Muted Slate Cobalt
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-2 .9l-.8 1.4 6 3.5-3 3-2.5-.5-1.5 1 3 2 2 3 1-1.5-.5-2.5 3-3 3.5 6 1.4-.8c.7-.4 1.1-1.2.9-2Z" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #4f809e 0%, #366582 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };

      case 'Hotel':
        return {
          // Muted Sage Emerald
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4v16" />
              <path d="M2 10h20v10" />
              <path d="M2 16h20" />
              <path d="M6 7h4a2 2 0 0 1 2 2v1H6V7Z" />
              <path d="M14 7h4a2 2 0 0 1 2 2v1h-6V7Z" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #4e8d78 0%, #35725e 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };

      case 'Tickets':
        return {
          // Muted Dusty Rose Terracotta
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="12" rx="3" />
              <path d="M9 6v2a1 1 0 0 1-1 1H3" />
              <path d="M9 18v-2a1 1 0 0 0-1-1H3" />
              <path d="M15 6v2a1 1 0 0 0 1 1h5" />
              <path d="M15 18v-2a1 1 0 0 1 1-1h5" />
              <path d="M12 9v6" strokeDasharray="2 2" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #a8586f 0%, #8c3f55 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };

      case 'Other':
      default:
        return {
          // Muted Graphite Slate
          icon: (
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="M2 12h20" />
              <circle cx="12" cy="12" r="3" fill="#ffffff" />
            </svg>
          ),
          gradient: 'linear-gradient(135deg, #5b6270 0%, #464c58 100%)',
          shadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
        };
    }
  };

  const config = getCategoryConfig();

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '13px',
        background: config.gradient,
        boxShadow: config.shadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        transition: 'transform 0.15s ease'
      }}
    >
      {config.icon}
    </div>
  );
};
