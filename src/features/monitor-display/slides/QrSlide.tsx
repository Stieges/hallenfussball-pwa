import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { cssVars, displayFontSizes, displaySpacing, displayMonitor } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { zuschauerUrl } from '../publicVisibility';

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
  return (
    <div style={{ ...style, gap: displaySpacing.sectionMD }}>
      <div style={{ fontSize: displayFontSizes.headingXL, fontWeight: cssVars.fontWeights.bold }}>
        {tournament.title}
      </div>
      {qrUrl && (
        <>
          <div style={{ fontSize: displayFontSizes.headingLG, fontWeight: cssVars.fontWeights.semibold }}>
            {t('slides.qr.headline')}
          </div>
          <QRCodeSVG
            value={qrUrl}
            size={displayMonitor.qr.sizeLarge}
            bgColor={displayMonitor.qr.background}
            fgColor={displayMonitor.qr.foreground}
            level="M"
          />
          <div style={{ fontSize: displayFontSizes.bodyMD }}>
            {qrUrl}
          </div>
        </>
      )}
      {!qrUrl && (
        <div style={{ fontSize: displayFontSizes.bodyMD }}>
          {t('slides.qr.idleHint')}
        </div>
      )}
    </div>
  );
}
