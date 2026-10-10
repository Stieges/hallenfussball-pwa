import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { displayFontSizes, displaySpacing } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { generateLiveUrl } from '../../../utils/shareUtils';

interface QrSlideProps {
  tournament: Tournament;
  style: CSSProperties;
}

/** Zuschauer-QR-Folie (@OB-011 Rückfall). */
export function QrSlide({ tournament, style }: QrSlideProps) {
  // F-03: Der QR zeigt die Zuschauer-Adresse (generateLiveUrl) — nie die Verwaltung
  // (generateTournamentUrl). Nur bei isPublic && shareCode gibt es überhaupt einen QR.
  const shareCode = tournament.shareCode;
  const qrUrl = tournament.isPublic === true && typeof shareCode === 'string' && shareCode.length > 0
    ? generateLiveUrl(shareCode)
    : null;
  return (
    <div style={{ ...style, gap: displaySpacing.sectionMD }}>
      <div style={{ fontSize: displayFontSizes.headingXL, fontWeight: 700 }}>
        {tournament.title}
      </div>
      {qrUrl && (
        <>
          <QRCodeSVG
            value={qrUrl}
            size={220}
            bgColor="white"
            fgColor="black"
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
