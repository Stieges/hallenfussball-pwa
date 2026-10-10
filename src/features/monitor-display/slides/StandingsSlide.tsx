import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displaySpacing, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { calculateStandings } from '../../../utils/calculations';
import { getGroupDisplayName, resolveTheme } from '../monitorDisplayHelpers';
import { StandingsTable } from '../components/StandingsTable';

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
      {/* Header */}
      <div style={{
        fontSize: displayFontSizes.headingLG,
        fontWeight: cssVars.fontWeights.semibold,
        marginBottom: displaySpacing.sectionMD,
        color: themeColors.text,
      }}>
        📊 {groupName}
      </div>

      <StandingsTable rows={standings} themeColors={themeColors} />
    </div>
  );
}
