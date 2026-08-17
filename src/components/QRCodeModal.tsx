import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import QRCode from 'qrcode';
import { Copy, Check, Share2, Mail } from 'lucide-react';
import { Trip } from '../types';

interface QRCodeModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ trip, isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const inviteUrl = trip ? `${window.location.origin}/join?tripId=${trip.id}&code=${trip.id.substring(5, 11)}` : '';

  useEffect(() => {
    if (inviteUrl && isOpen) {
      QRCode.toDataURL(inviteUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f766e',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [inviteUrl, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = () => {
    if (navigator.share && trip) {
      navigator.share({
        title: `Join ${trip.emoji} ${trip.name} on WhoPaid`,
        text: `Track shared trip expenses with WhoPaid:`,
        url: inviteUrl
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  if (!trip) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Invite Friends">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Scan this QR code or share the invite link to join <strong>{trip.emoji} {trip.name}</strong>
        </p>

        {qrDataUrl && (
          <div style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-md)'
          }}>
            <img src={qrDataUrl} alt="Trip Invitation QR Code" style={{ width: 200, height: 200, display: 'block' }} />
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <button 
            type="button" 
            onClick={handleCopy}
            className="btn-secondary"
            style={{ width: '100%' }}
          >
            {copied ? <Check size={18} color="var(--positive-text)" /> : <Copy size={18} />}
            <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>

          <button 
            type="button" 
            onClick={handleNativeShare}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            <Share2 size={18} />
            <span>Share Invitation</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
