/**
 * Dialog „Spielplan teilen“ (@OB-074, @OB-085): Code, QR-Code und Link; die Taste „Link kopieren“ steht im festen Fuß
 * (`DialogActions`), nur der Inhalt scrollt. Öffentlich: kurze Adresse `https://<host>/live/CODE` (ohne „#/“, @ZM-208) –
 * QR-Code, Link und Kopieren tragen dieselbe Adresse. Nicht öffentlich: interne Adresse wie bisher.
 * Größen- und Höhenregeln: `shareDialogStyles.ts`.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';
import { DialogActions } from '../ui/molecules/DialogActions';
import { cssVars } from '../../design-tokens';
import { generateQRCode } from '../../utils/qrCodeGenerator';
import {
  shareUrl,
  copyToClipboard,
  isShareSupported,
  generateShortLiveUrl,
  generateTournamentUrl,
  getShareMessage,
} from '../../utils/shareUtils';
import {
  shareDialogCss,
  qrSectionStyle,
  qrImageStyle,
  qrPlaceholderStyle,
  qrCaptionStyle,
  urlSectionStyle,
  labelStyle,
  urlTextStyle,
  deepLinkLabelStyle,
  feedbackStyle,
  shareCodeDisplayStyle,
  shareCodeLabelStyle,
  shareCodeValueStyle,
  notPublicHintStyle,
} from './shareDialogStyles';

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
  const linkRef = useRef<HTMLParagraphElement>(null);

  // Öffentlich: kurze Adresse ohne „#/“ (@OB-085); sonst die interne Adresse
  const hasShareCode = isPublic && shareCode;
  const canonicalUrl = baseUrl ?? (hasShareCode
    ? generateShortLiveUrl(shareCode)
    : generateTournamentUrl(tournamentId));

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
    setFeedback(success ? t('share.copySuccess') : t('share.copyError'));
  };

  const handleNativeShare = async () => {
    const result = await shareUrl({
      url: activeUrl,
      title: t('share.nativeShareTitle', { title: tournamentTitle }),
      text: t('share.nativeShareText', { title: tournamentTitle }),
    });
    setFeedback(getShareMessage(result));
  };

  // Antippen markiert die ganze Adresse (auswählbarer Text, kein Eingabefeld, damit nichts abgeschnitten wird)
  const selectLink = () => {
    const node = linkRef.current;
    const selection = window.getSelection();
    if (!node || !selection) {return;}
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  // Fuß: Rückmeldung über der Taste, „Link kopieren“ als Haupttaste, Systemfunktion „Teilen“ als Nebentaste
  const footer = (
    <>
      {feedback && (
        <div style={feedbackStyle} role="status" data-testid="share-dialog-feedback">
          {feedback}
        </div>
      )}
      <DialogActions
        data-testid="share-dialog-actions"
        primary={{ label: t('share.copyLink'), onClick: () => void handleCopyLink(), 'data-testid': 'share-dialog-copy' }}
        secondary={isShareSupported()
          ? [{ label: t('share.shareButton'), onClick: () => void handleNativeShare(), 'data-testid': 'share-dialog-native' }]
          : []}
      />
    </>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('share.title')} maxWidth="500px" footer={footer}>
      <div className="share-dialog-body">
        {hasShareCode ? (
          <div style={shareCodeDisplayStyle} data-testid="share-dialog-code">
            <span style={shareCodeLabelStyle}>{t('share.shareCode')}</span>
            <span style={shareCodeValueStyle}>{shareCode}</span>
          </div>
        ) : (
          <div style={notPublicHintStyle} data-testid="share-dialog-not-public">
            {'⚠️ '}{t('share.notPublicHint')}
          </div>
        )}

        <div style={qrSectionStyle}>
          {isGenerating ? (
            <div className="share-dialog-qr" style={qrPlaceholderStyle}>{t('share.qrGenerating')}</div>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code" className="share-dialog-qr" style={qrImageStyle} data-testid="share-dialog-qr" />
          ) : (
            <div className="share-dialog-qr" style={qrPlaceholderStyle}>{t('share.qrNotAvailable')}</div>
          )}
          <p style={qrCaptionStyle}>
            {hasShareCode ? t('share.qrCaptionPublic') : t('share.qrCaptionPrivate')}
          </p>
        </div>

        <div style={urlSectionStyle}>
          <span style={labelStyle}>
            {hasShareCode ? t('share.publicLink') : t('share.internalLink')}
          </span>
          <p
            ref={linkRef}
            style={urlTextStyle}
            data-testid="share-dialog-link"
            onClick={selectLink}
          >
            {activeUrl}
          </p>

          {hasDeepLinkOption && (
            <label style={deepLinkLabelStyle}>
              <input
                type="checkbox"
                checked={useDeepLink}
                onChange={(e) => setUseDeepLink(e.target.checked)}
                style={{ width: cssVars.iconSizes.md, height: cssVars.iconSizes.md, accentColor: cssVars.colors.primary }}
              />
              <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary }}>
                {t('share.deepLinkOption')}
              </span>
            </label>
          )}
        </div>
      </div>
      <style>{shareDialogCss}</style>
    </Dialog>
  );
};
