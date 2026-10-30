import type { CSSProperties } from 'react';
import { monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { groupKeyOf } from '../../../core/models/standingsGroups';
import { groupTieView } from '../../../core/standings/tieViews';
import { calculateStandings } from '../../../utils/calculations';
import { getGroupDisplayName, resolveTheme } from '../monitorDisplayHelpers';
import { StandingsTable } from '../components/StandingsTable';
import { SlideHeading } from '../components/SlideHeading';

interface StandingsSlideProps {
  slide: MonitorSlide;
  tournament: Tournament;
  theme: MonitorTheme;
  style: CSSProperties;
}

export function StandingsSlide({ slide, tournament, theme, style }: StandingsSlideProps) {
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  const groupId = slide.config.groupId;
  const groupName = getGroupDisplayName(tournament, groupId);
  const { teams, matches } = tournament;

  // Calculate standings for this group
  const standings = calculateStandings(teams, matches, tournament, groupId);

  return (
    <div style={style}>
      <SlideHeading icon="standings" color={themeColors.text}>{groupName}</SlideHeading>

      <StandingsTable rows={standings} themeColors={themeColors} tie={groupTieView(tournament, groupKeyOf(groupId))} />
    </div>
  );
}
