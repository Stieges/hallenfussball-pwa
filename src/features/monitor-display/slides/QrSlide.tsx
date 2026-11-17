import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { cssVars, displayFontSizes, displayMonitor } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { qrTypedAddress, zuschauerUrl } from '../publicVisibility';
import { withViewChannel } from '../../../utils/shareUtils';

interface QrSlideProps {
  tournament: Tournament;
  style: CSSProperties;
}

/** Zuschauer-QR-Folie (@OB-011 Rückfall). */
export function QrSlide({ tournament, style }: QrSlideProps) {
  const { t } = useTranslation('monitor');
  // F-03: Der QR zeigt die Zuschauer-Adresse (generateLiveUrl) — nie die Verwaltung
  // (generateTournamentUrl). Nur bei isPublic && shareCode gibt es überhaupt einen QR.
  const qrUrl = zuschauerUrl(tournament);
  // @ZM-071: der QR-Code ist die Hauptsache der Folie (Kante 50 % der Bildhöhe samt weißer Ruhezone)
  const qr = displayMonitor.qr.slide;
  return (
    <div style={{ ...style, gap: qr.gap }}>
      <div style={{ fontSize: qr.titleFont, fontWeight: cssVars.fontWeights.bold, textAlign: 'center', lineHeight: 1.2 }}>
        {tournament.title}
      </div>
      {qrUrl && (
        <>
          <div data-monitor="nah" style={{ fontSize: qr.headlineFont, fontWeight: cssVars.fontWeights.semibold, lineHeight: 1.2 }}>
            {t('slides.qr.headline')}
          </div>
          <QRCodeSVG
            value={withViewChannel(qrUrl, 'q')}
            size={qr.viewSize}
            marginSize={qr.quietModules}
            // Kante höchstens `size`, schrumpft aber mit der freien Höhe (Rand 10 %, zweizeiliger Titel, Hinweis), damit die Adresse im Bild bleibt (@ZM-208)
            style={{ width: 'auto', height: qr.size, flex: `0 1 ${qr.size}`, minHeight: qr.minSize, aspectRatio: '1 / 1' }}
            bgColor={displayMonitor.qr.background}
            fgColor={displayMonitor.qr.foreground}
            level="M"
            title={t('slides.qr.alt')}
          />
          {/* @ZM-208: zum Abtippen, wenn das Handy keinen QR-Code liest: mindestens 3 % der Bildhöhe, eine Zeile, ohne „https://“ */}
          <div data-monitor="nah" data-testid="qr-address" style={{ fontSize: displayFontSizes.qrAddress, fontWeight: cssVars.fontWeights.semibold, whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
            {qrTypedAddress(qrUrl)}
          </div>
        </>
      )}
      {!qrUrl && (
        <div style={{ fontSize: qr.headlineFont }}>
          {t('slides.qr.idleHint')}
        </div>
      )}
    </div>
  );
}
