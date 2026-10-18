import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { displayList, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { TournamentView } from '../../../core/view';
import type { MonitorTheme } from '../../../types/monitor';
import { calculateStandings } from '../../../utils/calculations';
import { getGroupDisplayName, resolveTheme } from '../monitorDisplayHelpers';
import { finalRoundMatches, standingsSections, type StandingsSection } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { StandingsTable } from '../components/StandingsTable';
import { SlidePageHint } from '../components/SlidePageHint';
import { SlideHeading } from '../components/SlideHeading';

interface AllStandingsSlideProps {
  tournament: Tournament;
  /** Die gemeinsame Ansicht des Monitors (A-36c) */
  view: TournamentView;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite = Abschnitt (R-f3), 0-basiert. */
  page?: number;
}

/** Folie „Alle Tabellen / Finalrunde“ (@ZM-071, @ZM-089): ein Abschnitt je Seite, nur bei öffentlichen Ergebnissen. */
export function AllStandingsSlide({ tournament, view, theme, style, page = 0 }: AllStandingsSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  const sections = standingsSections(tournament, view);
  const index = Math.min(Math.max(page, 0), Math.max(sections.length - 1, 0));
  const section: StandingsSection | undefined = sections[index];
  if (!section) {
    return (
      <div style={style}>
        <div style={{ fontSize: displayList.fontSizes.team, color: colors.textMuted }}>
          {t('slides.allStandings.none')}
        </div>
      </div>
    );
  }

  if (section.kind === 'group' || section.kind === 'overall') {
    const standings = section.kind === 'group'
      ? calculateStandings(tournament.teams, tournament.matches, tournament, section.groupId)
      : calculateStandings(tournament.teams, tournament.matches, tournament);
    const name = section.kind === 'group'
      ? getGroupDisplayName(tournament, section.groupId)
      : t('slides.allStandings.overall');
    return (
      <div style={style}>
        <SlideHeading icon="standings" color={colors.text}>{name}</SlideHeading>
        <StandingsTable rows={standings} themeColors={colors} />
        <SlidePageHint page={index} pages={sections.length} color={colors.textMuted} />
      </div>
    );
  }

  return (
    <div style={style}>
      <SlideHeading icon="finals" color={colors.text}>{t('slides.allStandings.finals')}</SlideHeading>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: displayList.rowGap,
        width: '100%',
      }}>
        {finalRoundMatches(view).map(match => (
          <MonitorMatchRow
            key={match.id}
            match={match}
            tournament={tournament}
            theme={theme}
            showScore={match.status === 'finished' || match.status === 'awarded'}
          />
        ))}
      </div>
      <SlidePageHint page={index} pages={sections.length} color={colors.textMuted} />
    </div>
  );
}
