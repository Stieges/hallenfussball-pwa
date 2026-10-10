import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayMonitor, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorTheme } from '../../../types/monitor';
import { calculateStandings } from '../../../utils/calculations';
import { getGroupDisplayName, resolveTheme } from '../monitorDisplayHelpers';
import { scoresPublic } from '../publicVisibility';
import { finalRoundMatches, standingsSections, type StandingsSection } from '../slideContent';
import { MonitorMatchRow } from '../components/MonitorMatchRow';
import { StandingsTable } from '../components/StandingsTable';
import { SlidePageHint } from '../components/SlidePageHint';

interface AllStandingsSlideProps {
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
  /** Seite = Abschnitt (R-f3), 0-basiert. */
  page?: number;
}

/** Folie „Alle Tabellen / Finalrunde“ (@ZM-071, @ZM-089): ein Abschnitt je Seite, nur bei öffentlichen Ergebnissen. */
export function AllStandingsSlide({ tournament, theme, style, page = 0 }: AllStandingsSlideProps) {
  const { t } = useTranslation('monitor');
  const colors = monitorThemes[resolveTheme(theme)];
  const sections = standingsSections(tournament);
  const index = Math.min(Math.max(page, 0), Math.max(sections.length - 1, 0));
  const section: StandingsSection | undefined = sections[index];
  const headingStyle = {
    fontSize: displayFontSizes.headingLG,
    fontWeight: cssVars.fontWeights.semibold,
    marginBottom: displaySpacing.sectionMD,
    color: colors.text,
  };

  if (!section) {
    return (
      <div style={style}>
        <div style={{ fontSize: displayFontSizes.bodyLG, color: colors.textMuted }}>
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
        <div style={headingStyle}>📊 {name}</div>
        <StandingsTable rows={standings} themeColors={colors} />
        <SlidePageHint page={index} pages={sections.length} color={colors.textMuted} />
      </div>
    );
  }

  const hidePendingOrigin = !scoresPublic(tournament);
  return (
    <div style={style}>
      <div style={headingStyle}>{t('slides.allStandings.finals')}</div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: displaySpacing.contentMD,
        width: '100%',
        maxWidth: displayMonitor.size.scheduleMaxWidth,
      }}>
        {finalRoundMatches(tournament.matches).map(match => (
          <MonitorMatchRow
            key={match.id}
            match={match}
            teams={tournament.teams}
            tournament={tournament}
            theme={theme}
            hidePendingOrigin={hidePendingOrigin}
            showScore={match.matchStatus === 'finished'}
          />
        ))}
      </div>
      <SlidePageHint page={index} pages={sections.length} color={colors.textMuted} />
    </div>
  );
}
