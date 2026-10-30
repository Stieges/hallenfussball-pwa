import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFinal, monitorThemes } from '../../../design-tokens';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import type { MonitorTheme } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import { resolveTheme } from '../monitorDisplayHelpers';
import { scorerPages } from '../finalPages';
import type { MonitorEnd } from '../monitorEnd';
import { HyphenSafe } from '../../tournament-finish/components/HyphenSafe';
import { SlidePageHint } from '../components/SlidePageHint';
import { FinalHeading } from './FinalHeading';
import { finalColumn, finalName, finalPlace, finalRow } from './finalStyles';

interface FinalScorersSlideProps {
  tournament: Pick<Tournament, 'title'>;
  end: MonitorEnd;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (@ZM-129): Gruppen gleichen Rangs bleiben auf einer Seite. */
  page?: number;
}

/**
 * Folie „Torschützen“ nach dem Abschluss (R3-7; @ZM-012, @ZM-129, @ZM-011): die beim Abschluss gespeicherte Liste, nur mit
 * eingeschaltetem Schalter (Ende ohne Liste zeigt hier nichts) und nie im Kindermodus. Blättert in Gruppen gleichen Rangs.
 */
export function FinalScorersSlide({ tournament, end, theme, style, page = 0 }: FinalScorersSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  if (end.kind !== 'final' || end.scorers === null) { return <div style={style} data-testid="monitor-final-empty" />; }
  const pages = scorerPages(end.scorers);
  const index = Math.min(Math.max(page, 0), pages.length - 1);
  const label = (row: ScorerRow): string => {
    const team = monitorTeamName(row.teamName);
    if (row.kind === 'player') { return `#${String(row.number)} ${team}`; }
    return t(row.kind === 'noNumber' ? 'slides.final.scorerNoNumber' : 'slides.final.scorerOwnGoals', { team });
  };
  return (
    <div style={style} data-testid="monitor-final-scorers" data-page={index + 1} data-pages={pages.length}>
      <FinalHeading icon="scorers" title={t('slides.final.scorersTitle')} subtitle={tournament.title} colors={colors} />
      <div style={finalColumn}>
        {pages[index].map((row) => (
          <div key={`${row.kind}-${row.teamId}-${row.kind === 'player' ? row.number : ''}`} data-testid="monitor-scorer-row" data-rank={row.rank ?? ''} style={finalRow(colors, null)}>
            <span style={finalPlace(colors)}>{row.rank ?? ''}</span>
            <span data-teamname style={finalName}><HyphenSafe text={label(row)} /></span>
            <span style={{ fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {row.goals}
              <span style={{ fontSize: displayFinal.fontSizes.unit, color: colors.text }}> {t('slides.final.goals', { count: row.goals })}</span>
            </span>
          </div>
        ))}
      </div>
      <SlidePageHint page={index} pages={pages.length} color={colors.text} />
    </div>
  );
}
