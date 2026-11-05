import { useTranslation } from 'react-i18next';
import { displayColors, displayFontSizes } from '../../../design-tokens';
import { containerStyle } from './monitorStyles';

/** Ladezustand der Monitor-Seite. */
export function MonitorLoadingView() {
  const { t } = useTranslation('monitor');
  return (
    <div style={containerStyle}>
      <div style={{ fontSize: displayFontSizes.headingLG, color: displayColors.textSecondary }}>
        {t('loading')}
      </div>
    </div>
  );
}

/**
 * Ruhige Seite, solange der Monitor keinen Stand hat (@ME-009, @ME-016, @ME-034): ohne Netz, unbekanntes oder nicht geteiltes
 * Turnier, gelöschter Monitor. Nie ein Fehlertext, keine Kennung, keine Taste – der Monitor fragt von selbst weiter an
 * und zeigt dann den Stand (Auftrag Hallen-Bildschirm: kein Fehlertext, nie leeres Bild).
 */
export function MonitorWaitingView() {
  const { t } = useTranslation('monitor');
  return (
    <div style={containerStyle} data-testid="monitor-waiting-state" role="status">
      <div
        data-testid="monitor-waiting-message"
        style={{ fontSize: displayFontSizes.headingLG, color: displayColors.textSecondary }}
      >
        {t('waiting')}
      </div>
    </div>
  );
}
