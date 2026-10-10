import type { CSSProperties } from 'react';
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
          Schau auf die Anzeige in der Halle – hier läuft das Spiel live mit.
        </div>
      )}
    </div>
  );
}
