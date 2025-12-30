/**
 * InviteLinkDialog - Dialog zum Anzeigen/Kopieren des Einladungs-Links
 *
 * Zeigt den generierten Link nach Erstellung einer Einladung.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

import React, { useState, CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';

interface InviteLinkDialogProps {
  /** Der generierte Link */
  link: string;
  /** Callback wenn Dialog geschlossen wird */
  onClose: () => void;
}

export const InviteLinkDialog: React.FC<InviteLinkDialogProps> = ({
  link,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const canShare = 'share' in navigator && typeof navigator.share === 'function';

  const handleShare = () => {
    if (canShare) {
      void navigator.share({
        title: 'Turnier-Einladung',
        text: 'Du wurdest zu einem Turnier eingeladen!',
        url: link,
      }).catch(() => {
        // User cancelled or error - ignore
      });
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.successIcon}>
            <span>&#10003;</span>
          </div>
          <h2 style={styles.title}>Einladung erstellt!</h2>
          <p style={styles.subtitle}>
            Teile diesen Link mit der Person, die du einladen möchtest.
          </p>
        </div>

        <div style={styles.content}>
          <div style={styles.linkBox}>
            <input
              type="text"
              value={link}
              readOnly
              style={styles.linkInput}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>

          <div style={styles.actions}>
            <Button
              variant="primary"
              fullWidth
              onClick={handleCopy}
              style={styles.copyButton}
            >
              {copied ? 'Kopiert!' : 'Link kopieren'}
            </Button>

            {canShare && (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleShare}
              >
                Teilen
              </Button>
            )}
          </div>

          <p style={styles.hint}>
            Der Link ist 7 Tage gültig und kann einmalig verwendet werden.
          </p>
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose} fullWidth>
            Fertig
          </Button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: '400px',
    background: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.xl,
    textAlign: 'center',
    borderBottom: `1px solid ${colors.border}`,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.xxl,
    color: colors.onPrimary,
    background: colors.success,
    borderRadius: borderRadius.full,
  },
  title: {
    margin: 0,
    marginBottom: spacing.xs,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  linkBox: {
    marginBottom: spacing.md,
  },
  linkInput: {
    width: '100%',
    padding: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    background: colors.surfaceLight,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  copyButton: {
    minHeight: '48px',
  },
  hint: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
  },
};

export default InviteLinkDialog;
