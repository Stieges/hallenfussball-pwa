import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes } from '../../design-tokens';

/** „Endstand“ an der Stelle der Uhr, wenn das Spiel beendet ist (Entscheidung Daniel 2026-10-15); Lage bleibt im festen Raster. */
export function LiveFinalScore({ color }: { color: string }) {
  const { t } = useTranslation('monitor');
  return (
    <div data-testid="live-endstand" style={{ fontSize: displayFontSizes.clockXL, fontWeight: cssVars.fontWeights.bold, lineHeight: 1, color, textAlign: 'center' }}>
      {t('liveMatch.finalScore')}
    </div>
  );
}
