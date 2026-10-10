import type { CSSProperties } from 'react';
import { cssVars, displayColors, displayFontSizes, displaySpacing } from '../../../design-tokens';
import { containerStyle } from './monitorStyles';

/** Ladezustand der Monitor-Seite. */
export function MonitorLoadingView() {
  return (
    <div style={containerStyle}>
      <div style={{ fontSize: displayFontSizes.headingLG, color: displayColors.textSecondary }}>
        Lade Display...
      </div>
    </div>
  );
}

const backButtonStyle: CSSProperties = {
  marginTop: displaySpacing.sectionMD,
  padding: `${displaySpacing.contentMD} ${displaySpacing.contentXL}`,
  fontSize: displayFontSizes.bodyMD,
  background: displayColors.primary,
  color: displayColors.textPrimary,
  border: 'none',
  borderRadius: cssVars.borderRadius.md,
  cursor: 'pointer',
};

interface MonitorErrorViewProps {
  error: string | null | undefined;
  onBack?: () => void;
}

/** Fehlerzustand: Meldung, „← Zurück“ nur wenn die Seite einen Rückweg hat. */
export function MonitorErrorView({ error, onBack }: MonitorErrorViewProps) {
  return (
    <div style={containerStyle} data-testid="monitor-error-state">
      <div
        data-testid="monitor-error-message"
        style={{
          fontSize: displayFontSizes.headingMD,
          color: displayColors.error,
          marginBottom: displaySpacing.sectionMD,
        }}
      >
        {error ?? 'Konfiguration nicht gefunden'}
      </div>
      {onBack && (
        <button onClick={onBack} style={backButtonStyle}>
          ← Zurück
        </button>
      )}
    </div>
  );
}
