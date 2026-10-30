import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayFinal, monitorThemes } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import type { MonitorTheme } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';
import { resolveTheme } from '../monitorDisplayHelpers';
import { rankingPages } from '../finalPages';
import type { MonitorEnd } from '../monitorEnd';
import { HyphenSafe } from '../../tournament-finish/components/HyphenSafe';
import { SlidePageHint } from '../components/SlidePageHint';
import { FinalHeading } from './FinalHeading';
import { finalColumn, finalKids, finalName, finalPlace, finalRow } from './finalStyles';

interface FinalStandingsSlideProps {
  tournament: Pick<Tournament, 'title'>;
  end: MonitorEnd;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite der Folie (@ZM-129), 0-basiert. */
  page?: number;
}

/**
 * Folie „Endstand“ nach dem Abschluss (R3-7; @LZ-076, @ZM-121, @ET-045): Platz und Teamname je Platz des beim Abschluss gespeicherten
 * Endstands, ohne Punkte und Tore, Platz 1 in Gold. Dichte Folien blättern, Namen werden nie gekürzt (@ZM-129). Im Kindermodus
 * steht statt des Endstands „Turnier beendet – danke fürs Mitspielen“ (@ZM-121 Z. 4). Ohne Abschluss steht hier nichts.
 */
export function FinalStandingsSlide({ tournament, end, theme, style, page = 0 }: FinalStandingsSlideProps) {
  const { t } = useTranslation('monitor');
  const resolved = resolveTheme(theme);
  const colors = monitorThemes[resolved];
  if (end.kind === 'none') { return <div style={style} data-testid="monitor-final-empty" />; }
  const heading = <FinalHeading icon="standings" title={t('slides.final.title')} subtitle={tournament.title} colors={colors} />;
  if (end.kind === 'pending') { return <div style={style} data-testid="monitor-final-pending">{heading}</div>; }
  if (end.kind === 'kids') {
    return (
      <div style={style} data-testid="monitor-final-kids">
        {heading}
        <p style={{ ...finalKids, margin: 0 }}>{t('slides.final.kids')}</p>
      </div>
    );
  }
  const pages = rankingPages(end.ranking);
  const index = Math.min(Math.max(page, 0), pages.length - 1);
  const gold = displayFinal.gold[resolved];
  return (
    <div style={style} data-testid="monitor-final-standings" data-page={index + 1} data-pages={pages.length}>
      {heading}
      <div style={finalColumn}>
        {pages[index].map((row) => (
          <div key={row.teamId} data-testid="monitor-final-row" data-place={row.place} style={finalRow(colors, row.place === 1 ? gold : null)}>
            <span data-testid="monitor-final-place" style={finalPlace(colors)}>{row.place}</span>
            <span data-testid="monitor-final-team" data-teamname style={finalName}><HyphenSafe text={monitorTeamName(row.teamName)} /></span>
            {row.place === 1
              ? <span aria-hidden="true" style={{ display: 'inline-flex', color: gold, fontSize: displayFinal.cupSize }}><Icons.Trophy size={displayFinal.cupSize} /></span>
              : <span />}
          </div>
        ))}
      </div>
      <SlidePageHint page={index} pages={pages.length} color={colors.text} />
    </div>
  );
}
