import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { useApp } from '../store/AppContext';
import { Trip } from '../types';
import QRCode from 'qrcode';
import { UserPlus, Copy, Check, Share2, Mail, User, Loader2 } from 'lucide-react';
import { buildInviteUrl } from '../lib/invite';

interface AddMemberModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ trip, isOpen, onClose }) => {
  const { addMember, prepareTripForSharing, showAlert } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite Link & QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
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
    setIsPreparingShare(true);
    void (async () => {
      try {
        await prepareTripForSharing(trip.id);
        const url = await QRCode.toDataURL(inviteUrl, {
          width: 200,
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
        if (!cancelled) setShareError(error instanceof Error ? error.message : 'This trip is not ready to share.');
      } finally {
        if (!cancelled) setIsPreparingShare(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteUrl, isOpen, trip?.id, prepareAttempt]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !trip) return;
    setIsSubmitting(true);
    try {
      await addMember(trip.id, email.trim(), name.trim());
      showAlert(`${name.trim()} added to ${trip.name}!`, 'Member Added', 'success');
      setName('');
      setEmail('');
      onClose();
    } catch (err) {
      console.error('Failed to add member:', err);
      showAlert(
        err instanceof Error ? err.message : 'This participant could not be added.',
        'Member Not Added',
        'warning'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
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

  const handleShareLink = async () => {
    if (!shareReady) return;
    if (navigator.share && trip) {
      try {
        await navigator.share({
          title: `Join ${trip.name} on WhoPaid`,
          text: `Split & track shared trip expenses with WhoPaid:`,
          url: inviteUrl
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          const didCopy = await handleCopyLink();
          if (didCopy) {
            showAlert('Native sharing was unavailable, so the verified invite link was copied instead.', 'Link Copied', 'info');
          }
        }
      }
    } else {
      await handleCopyLink();
    }
  };

  if (!trip) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Trip Member">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 16px' }}>
        
        {/* Direct Add Form */}
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              Member Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex, Sarah"
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  fontWeight: 600
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              Email Address *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !email.trim() || isSubmitting}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '11px',
              fontWeight: 700,
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-md)',
              marginTop: 2
            }}
          >
            <UserPlus size={16} />
            <span>{isSubmitting ? 'Adding...' : 'Add to Trip'}</span>
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            OR SHARE INVITE LINK
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Invite Link & QR Option */}
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center'
        }}>
          {isPreparingShare && (
            <div style={{ minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="animate-spin" />
              <strong style={{ fontSize: '0.82rem' }}>Checking trip expenses…</strong>
            </div>
          )}

          {shareError && (
            <div style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontSize: '0.78rem', lineHeight: 1.4 }}>
              <div>{shareError}</div>
              <button type="button" className="btn-secondary" onClick={() => setPrepareAttempt(value => value + 1)} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                Try Again
              </button>
            </div>
          )}

          {shareReady && qrDataUrl && (
            <div style={{
              background: '#ffffff',
              padding: 8,
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <img src={qrDataUrl} alt="Trip Join QR" style={{ width: 140, height: 140, display: 'block' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!shareReady || isPreparingShare}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                background: copied ? 'var(--brand-500, #10b981)' : 'var(--bg-surface)',
                color: copied ? '#ffffff' : 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareLink}
              disabled={!shareReady || isPreparingShare}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Share2 size={14} />
              <span>Share Invite</span>
            </button>
          </div>
        </div>

      </div>
    </BottomSheet>
  );
};
