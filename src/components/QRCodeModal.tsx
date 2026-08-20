import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import QRCode from 'qrcode';
import { Copy, Check, Share2, Loader2 } from 'lucide-react';
import { Trip } from '../types';
import { buildInviteUrl } from '../lib/invite';
import { useApp } from '../store/AppContext';

interface QRCodeModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ trip, isOpen, onClose }) => {
  const { prepareTripForSharing, showAlert } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const [shareError, setShareError] = useState('');
  const [prepareAttempt, setPrepareAttempt] = useState(0);

  const inviteUrl = trip?.inviteToken
    ? buildInviteUrl(window.location.origin, import.meta.env.BASE_URL, trip.inviteToken)
    : '';

  useEffect(() => {
    let cancelled = false;
    if (!inviteUrl || !trip || !isOpen) {
      setQrDataUrl('');
      setShareReady(false);
      setShareError('');
      return () => { cancelled = true; };
    }

    setQrDataUrl('');
    setShareReady(false);
    setShareError('');
    setIsPreparing(true);
    void (async () => {
      try {
        await prepareTripForSharing(trip.id);
        const url = await QRCode.toDataURL(inviteUrl, {
          width: 280,
          margin: 2,
          color: {
            dark: '#0f766e',
            light: '#ffffff'
          }
        });
        if (!cancelled) {
          setQrDataUrl(url);
          setShareReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setShareError(error instanceof Error ? error.message : 'This trip is not ready to share.');
        }
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteUrl, isOpen, trip?.id, prepareAttempt]);

  const handleCopy = async () => {
    if (!inviteUrl || !shareReady) return false;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      showAlert('The invite link could not be copied on this device.', 'Copy Failed', 'warning');
      return false;
    }
  };

  const handleNativeShare = async () => {
    if (!shareReady) return;
    if (navigator.share && trip) {
      try {
        await navigator.share({
          title: `Join ${trip.emoji} ${trip.name} on WhoPaid`,
          text: `Split & track shared trip expenses together with WhoPaid:`,
          url: inviteUrl
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          const didCopy = await handleCopy();
          if (didCopy) {
            showAlert('Native sharing was unavailable, so the verified invite link was copied instead.', 'Link Copied', 'info');
          }
        }
      }
    } else {
      await handleCopy();
    }
  };

  if (!trip) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Invite Trip Members">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.4 }}>
          Scan this QR code or share the invite link with friends to join <strong>{trip.emoji} {trip.name}</strong>.
        </p>

        {isPreparing && (
          <div style={{ minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-secondary)' }}>
            <Loader2 size={30} className="animate-spin" />
            <strong>Preparing the complete trip…</strong>
            <span style={{ fontSize: '0.78rem' }}>Checking the trip, members and expenses before sharing.</span>
          </div>
        )}

        {shareError && (
          <div style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontSize: '0.82rem', lineHeight: 1.4 }}>
            <div>{shareError}</div>
            <button type="button" className="btn-secondary" onClick={() => setPrepareAttempt(value => value + 1)} style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
              Try Again
            </button>
          </div>
        )}

        {shareReady && qrDataUrl && (
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
          {shareReady ? inviteUrl : isPreparing ? 'Verifying invitation…' : 'Invitation unavailable'}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button 
            type="button" 
            onClick={handleCopy}
            disabled={!shareReady || isPreparing}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {copied ? <Check size={18} color="var(--positive-text)" /> : <Copy size={18} />}
            <span>{copied ? 'Invite Link Copied!' : 'Copy Shareable Link'}</span>
          </button>

          <button 
            type="button" 
            onClick={handleNativeShare}
            disabled={!shareReady || isPreparing}
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
