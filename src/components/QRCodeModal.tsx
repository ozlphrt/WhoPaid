import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import QRCode from 'qrcode';
import { Copy, Check, Share2, Sparkles } from 'lucide-react';
import { Trip } from '../types';

interface QRCodeModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ trip, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Clean base URL handling for GitHub Pages & Localhost
  const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`;
  const inviteUrl = trip?.inviteToken ? `${baseUrl}/?join=${encodeURIComponent(trip.inviteToken)}` : '';

  useEffect(() => {
    if (inviteUrl && isOpen) {
      QRCode.toDataURL(inviteUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f766e',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code generation error:', err));
    }
  }, [inviteUrl, isOpen]);

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = () => {
    if (navigator.share && trip) {
      navigator.share({
        title: `Join ${trip.emoji} ${trip.name} on WhoPaid`,
        text: `Split & track shared trip expenses together with WhoPaid:`,
        url: inviteUrl
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  if (!trip) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Invite Trip Members">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.4 }}>
          Scan this QR code or share the invite link with friends to join <strong>{trip.emoji} {trip.name}</strong>.
        </p>

        {qrDataUrl && (
          <div style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)',
            display: 'inline-block'
          }}>
            <img 
              src={qrDataUrl} 
              alt={`QR Code for ${trip.name}`} 
              style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }} 
            />
          </div>
        )}

        <div style={{
          background: 'var(--bg-subtle)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          width: '100%',
          wordBreak: 'break-all',
          fontSize: '0.78rem',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)'
        }}>
          {inviteUrl}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button 
            type="button" 
            onClick={handleCopy}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {copied ? <Check size={18} color="var(--positive-text)" /> : <Copy size={18} />}
            <span>{copied ? 'Invite Link Copied!' : 'Copy Shareable Link'}</span>
          </button>

          <button 
            type="button" 
            onClick={handleNativeShare}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Share2 size={18} />
            <span>Share Invitation</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
