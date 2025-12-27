import { useState, useEffect, CSSProperties } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../ui/Button';
import { Icons } from '../ui/Icons';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { generateQRCode } from '../../utils/qrCodeGenerator';
import {
  shareUrl,
  copyToClipboard,
  isShareSupported,
  generatePublicUrl,
  getShareMessage,
} from '../../utils/shareUtils';

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentTitle: string;
}

export const ShareDialog = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentTitle,
}: ShareDialogProps) => {
  const [qrCode, setQrCode] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const publicUrl = generatePublicUrl(tournamentId);

  // Generate QR code when dialog opens
  useEffect(() => {
    if (isOpen && !qrCode) {
      setIsGenerating(true);
      generateQRCode(publicUrl)
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
  }, [isOpen, publicUrl, qrCode]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(publicUrl);
    if (success) {
      setFeedback('Link in Zwischenablage kopiert!');
    } else {
      setFeedback('Fehler beim Kopieren');
    }
  };

  const handleNativeShare = async () => {
    const result = await shareUrl({
      url: publicUrl,
      title: `${tournamentTitle} - Spielplan`,
      text: `Sieh dir den Spielplan für ${tournamentTitle} an`,
    });

    const message = getShareMessage(result);
    setFeedback(message);
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xl,
  };

  const qrSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.md,
  };

  const qrImageStyle: CSSProperties = {
    width: '100%',
    maxWidth: '220px',
    aspectRatio: '1 / 1',
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
    background: colors.qrBackground,
    padding: spacing.md,
  };

  const qrPlaceholderStyle: CSSProperties = {
    ...qrImageStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  };

  const qrCaptionStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  };

  const urlSectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: fontWeights.medium,
  };

  const urlInputStyle: CSSProperties = {
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    cursor: 'text',
    wordBreak: 'break-all',
  };

  const buttonGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const feedbackStyle: CSSProperties = {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    background: colors.primary,
    color: colors.background,
    textAlign: 'center',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    animation: 'fadeIn 0.2s ease-out',
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Spielplan teilen" maxWidth="500px">
      <div style={containerStyle}>
        {/* QR Code Section */}
        <div style={qrSectionStyle}>
          {isGenerating ? (
            <div style={qrPlaceholderStyle}>QR-Code wird generiert...</div>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code" style={qrImageStyle} />
          ) : (
            <div style={qrPlaceholderStyle}>QR-Code nicht verfügbar</div>
          )}
          <p style={qrCaptionStyle}>QR-Code scannen für Live-Ansicht</p>
        </div>

        {/* URL Display Section */}
        <div style={urlSectionStyle}>
          <label style={labelStyle}>Öffentlicher Link:</label>
          <input
            type="text"
            value={publicUrl}
            readOnly
            style={urlInputStyle}
            onClick={(e) => e.currentTarget.select()}
          />
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
            Link kopieren
          </Button>

          {isShareSupported() && (
            <Button
              variant="secondary"
              size="md"
              icon={<Icons.Share />}
              onClick={() => void handleNativeShare()}
              fullWidth
            >
              Teilen
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
    </Dialog>
  );
};
