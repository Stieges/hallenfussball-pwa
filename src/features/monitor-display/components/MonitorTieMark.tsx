/**
 * Kurze Markierung hinter dem Teamnamen einer Monitor-Tabelle bei offenem Gleichstand (@W2A-059): „Strafstoß folgt“ oder
 * „wird entschieden“, Wort und Rahmen (Farbe trägt nie allein). Kein Erklärtext, keine Bedienelemente. Schrift in der
 * Kopfstufe der Tabelle (mindestens 3 % der Bildhöhe, @ZM-125).
 */
import { useTranslation } from 'react-i18next';
import { cssVars, displayList } from '../../../design-tokens';
import type { PublicTieMark } from '../../../core/standings/tieViews';
import type { MonitorColors } from './StandingsTable';

export function MonitorTieMark({ mark, themeColors }: { mark: PublicTieMark; themeColors: MonitorColors }) {
  const { t } = useTranslation('monitor');
  return (
    <span
      data-testid="monitor-tie-mark"
      data-mark={mark}
      style={{
        display: 'inline-block',
        marginLeft: displayList.cellGap,
        padding: `0 ${displayList.rowPaddingX}`,
        border: `${cssVars.borderWidth.medium} solid ${themeColors.warningSymbol}`,
        borderRadius: cssVars.borderRadius.full,
        background: themeColors.pauseBadgeBg,
        color: themeColors.text,
        fontSize: displayList.fontSizes.head,
        fontWeight: cssVars.fontWeights.semibold,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {t(`standings.tie.${mark}`)}
    </span>
  );
}
