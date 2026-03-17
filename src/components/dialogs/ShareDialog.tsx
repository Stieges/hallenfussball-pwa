import { useState, useEffect, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { cssVars } from '../../design-tokens'
import { generateQRCode } from '../../utils/qrCodeGenerator';
import {
  shareUrl,
  copyToClipboard,
  isShareSupported,
  generateLiveUrl,
  generateTournamentUrl,
  getShareMessage,
} from '../../utils/shareUtils';

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentTitle: string;
  /** Share code for public view (e.g., "ABC123") */
  shareCode?: string | null;
  /** Whether the tournament is public */
  isPublic?: boolean;
  /** Optional Base URL (replaces auto-generation) */
  baseUrl?: string;
  /** Optional Deep Link URL (e.g. current page with filters) */
  deepLinkUrl?: string;
}

export const ShareDialog = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentTitle,
  shareCode,
  isPublic = false,
  baseUrl,
  deepLinkUrl,
}: ShareDialogProps) => {
  const { t } = useTranslation('dashboard');
  const [qrCode, setQrCode] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useDeepLink, setUseDeepLink] = useState(false);

  // Determine Canonical URL
  const hasShareCode = isPublic && shareCode;
  const canonicalUrl = baseUrl ?? (hasShareCode
    ? generateLiveUrl(shareCode)
    : generateTournamentUrl(tournamentId));

  // Determine effective URL
  const hasDeepLinkOption = !!deepLinkUrl && deepLinkUrl !== canonicalUrl;
  const activeUrl = (hasDeepLinkOption && useDeepLink) ? deepLinkUrl : canonicalUrl;

  // Generate QR code when dialog opens or URL changes
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(true);
      generateQRCode(activeUrl)
        .then((dataUrl) => {
          setQrCode(dataUrl);
        })
        .catch((error) => {
          console.error('QR code generation failed:', error);
        })
        .finally(() => {
          setIsGenerating(false);
        });
    }

  }, [isOpen, activeUrl]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(activeUrl);
    if (success) {
      setFeedback(t('share.copySuccess'));
    } else {
      setFeedback(t('share.copyError'));
    }
  };

  const handleNativeShare = async () => {
    const result = await shareUrl({
      url: activeUrl,
      title: t('share.nativeShareTitle', { title: tournamentTitle }),
      text: t('share.nativeShareText', { title: tournamentTitle }),
    });

    const message = getShareMessage(result);
    setFeedback(message);
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xl,
  };

  const qrSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  };

  const qrImageStyle: CSSProperties = {
    width: '100%',
    maxWidth: '220px',
    aspectRatio: '1 / 1',
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.qrBackground,
    padding: cssVars.spacing.md,
  };

  const qrPlaceholderStyle: CSSProperties = {
    ...qrImageStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.sm,
  };

  const qrCaptionStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
  };

  const urlSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.medium,
  };

  const urlInputStyle: CSSProperties = {
    width: '100%',
    padding: cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.sm,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    fontFamily: cssVars.fontFamilies.mono,
    cursor: 'text',
    wordBreak: 'break-all',
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const feedbackStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.sm,
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    textAlign: 'center',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    animation: 'fadeIn 0.2s ease-out',
  };

  const shareCodeDisplayStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.md,
  };

  const shareCodeValueStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.headlineLg,
    fontWeight: cssVars.fontWeights.bold,
    // eslint-disable-next-line local-rules/no-hardcoded-font-styles -- Monospace is intentional for share code display
    fontFamily: 'monospace',
    letterSpacing: '0.2em',
    color: cssVars.colors.primary,
  };

  const notPublicHintStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningLight,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.sm,
    textAlign: 'center',
    marginBottom: cssVars.spacing.md,
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('share.title')} maxWidth="500px">
      <div style={containerStyle}>
        {/* Share Code Display (if public) */}
        {hasShareCode && (
          <div style={shareCodeDisplayStyle}>
            <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
              {t('share.shareCode')}
            </span>
            <span style={shareCodeValueStyle}>{shareCode}</span>
          </div>
        )}

        {/* Not Public Hint */}
        {!hasShareCode && (
          <div style={notPublicHintStyle}>
            {'⚠️ '}{t('share.notPublicHint')}
          </div>
        )}

        {/* QR Code Section */}
        <div style={qrSectionStyle}>
          {isGenerating ? (
            <div style={qrPlaceholderStyle}>{t('share.qrGenerating')}</div>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code" style={qrImageStyle} />
          ) : (
            <div style={qrPlaceholderStyle}>{t('share.qrNotAvailable')}</div>
          )}
          <p style={qrCaptionStyle}>
            {hasShareCode
              ? t('share.qrCaptionPublic')
              : t('share.qrCaptionPrivate')}
          </p>
        </div>



        {/* URL Display Section */}
        <div style={urlSectionStyle}>
          <label style={labelStyle}>
            {hasShareCode ? t('share.publicLink') : t('share.internalLink')}
          </label>
          <input
            type="text"
            value={activeUrl}
            readOnly
            style={urlInputStyle}
            onClick={(e) => e.currentTarget.select()}
          />

          {/* Deep Link Toggle */}
          {hasDeepLinkOption && (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: cssVars.spacing.sm,
              cursor: 'pointer',
              marginTop: cssVars.spacing.xs,
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={useDeepLink}
                onChange={(e) => setUseDeepLink(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: cssVars.colors.primary }}
              />
              <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary }}>
                {t('share.deepLinkOption')}
              </span>
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div style={buttonGroupStyle}>
          <Button
            variant="primary"
            size="md"
            icon={<Icons.Copy />}
            onClick={() => void handleCopyLink()}
            fullWidth
          >
            {t('share.copyLink')}
          </Button>

          {isShareSupported() && (
            <Button
              variant="secondary"
              size="md"
              icon={<Icons.Share />}
              onClick={() => void handleNativeShare()}
              fullWidth
            >
              {t('share.shareButton')}
            </Button>
          )}
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div style={feedbackStyle}>
            {feedback}
          </div>
        )}

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </Dialog >
  );
};
