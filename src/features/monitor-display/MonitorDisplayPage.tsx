/**
 * MonitorDisplayPage - Placeholder für TV/Monitor-Anzeige
 *
 * MON-KONF-01: Fullscreen Display-Ansicht für Monitore
 *
 * Diese Komponente wird in Phase 1 (P1-10 bis P1-12) implementiert.
 * Für jetzt dient sie als Placeholder und zeigt eine einfache Nachricht.
 *
 * Route: /display/:tournamentId/:monitorId
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-10
 */

import { displayColors, displayFontSizes, displaySpacing } from '../../design-tokens';

interface MonitorDisplayPageProps {
  /** Tournament ID from URL */
  tournamentId: string;
  /** Monitor ID from URL */
  monitorId: string;
  /** Optional: Go back to previous screen */
  onBack?: () => void;
}

export function MonitorDisplayPage({
  tournamentId,
  monitorId,
  onBack,
}: MonitorDisplayPageProps) {
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: displayColors.background,
    color: displayColors.textPrimary,
    fontFamily: 'Inter, system-ui, sans-serif',
    padding: displaySpacing.overscan,
    textAlign: 'center',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: displayFontSizes.headingLG,
    fontWeight: 700,
    marginBottom: displaySpacing.sectionMD,
  };

  const textStyle: React.CSSProperties = {
    fontSize: displayFontSizes.bodyLG,
    color: displayColors.textSecondary,
    marginBottom: displaySpacing.sectionLG,
    maxWidth: '600px',
  };

  const idStyle: React.CSSProperties = {
    fontSize: displayFontSizes.bodySM,
    color: displayColors.textMuted,
    fontFamily: 'monospace',
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: displaySpacing.sectionMD,
    padding: `${displaySpacing.contentMD} ${displaySpacing.contentXL}`,
    fontSize: displayFontSizes.bodyMD,
    background: displayColors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <div style={headingStyle}>📺 Monitor-Display</div>

      <div style={textStyle}>
        Diese Seite wird in Phase 1 implementiert.
        <br />
        Hier wird die Diashow mit allen konfigurierten Slides angezeigt.
      </div>

      <div style={idStyle}>
        Tournament: {tournamentId}
        <br />
        Monitor: {monitorId}
      </div>

      {onBack && (
        <button style={buttonStyle} onClick={onBack}>
          ← Zurück
        </button>
      )}
    </div>
  );
}

export default MonitorDisplayPage;
