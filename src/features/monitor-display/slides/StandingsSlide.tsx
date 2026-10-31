import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide, MonitorTheme } from '../../../types/monitor';
import { groupKeyOf, OVERALL_GROUP } from '../../../core/models/standingsGroups';
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
  const { t } = useTranslation('monitor');
  const resolvedTheme = resolveTheme(theme);
  const themeColors = monitorThemes[resolvedTheme];

  // „default“ ist die Gruppen-ID, die der Monitor-Editor bei „Jeder gegen jeden“ (eine Gruppe) anbietet; kein Team trägt sie → alle Teams
  const configGroupId = slide.config.groupId;
  const groupId = configGroupId === 'default' && !tournament.teams.some(team => team.group === 'default') ? OVERALL_GROUP : configGroupId;
  // @ZM-177/@ZM-181: ohne Gruppe (Jeder gegen jeden) heißt die Überschrift „Gesamttabelle“, nicht „Gruppe“
  const groupName = groupId === OVERALL_GROUP ? t('slides.allStandings.overall') : getGroupDisplayName(tournament, groupId);
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
