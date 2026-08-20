import React, { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { useApp } from '../store/AppContext';
import { Trip } from '../types';
import QRCode from 'qrcode';
import { UserPlus, Copy, Check, Share2, Mail, User } from 'lucide-react';

interface AddMemberModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ trip, isOpen, onClose }) => {
  const { addMember, showAlert } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite Link & QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const baseUrl = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`;
  const inviteUrl = trip?.inviteToken ? `${baseUrl}/?join=${encodeURIComponent(trip.inviteToken)}` : '';

  useEffect(() => {
    if (inviteUrl && isOpen) {
      QRCode.toDataURL(inviteUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0f766e',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code error:', err));
    }
  }, [inviteUrl, isOpen]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !trip) return;
    setIsSubmitting(true);
    try {
      const generatedEmail = email.trim() || `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@whopaid.guest`;
      await addMember(trip.id, generatedEmail, name.trim());
      showAlert(`${name.trim()} added to ${trip.name}!`, 'Member Added', 'success');
      setName('');
      setEmail('');
      onClose();
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareLink = () => {
    if (navigator.share && trip) {
      navigator.share({
        title: `Join ${trip.name} on WhoPaid`,
        text: `Split & track shared trip expenses with WhoPaid:`,
        url: inviteUrl
      }).catch(() => {});
    } else {
      handleCopyLink();
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
              Email Address <span style={{ fontWeight: 500, textTransform: 'none', color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@example.com"
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
            disabled={!name.trim() || isSubmitting}
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
          {qrDataUrl && (
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
