/**
 * Kopfzeile einer Team-Karte im Reiter „Teams“ (@OB-021): Logo, Name, Gruppen-Abzeichen, Meta-Zeile, Auf-/Zuklapp-Pfeil.
 * Am Handy (unter dem Tablet-Umbruchpunkt) ein kleineres Logo und das Abzeichen in der Meta-Zeile, damit der Name Platz hat;
 * Tablet und Desktop unverändert. Der Name bricht nur an Leerzeichen und nach „/“ um, Wörter mit Bindestrich bleiben ganz (@ZM-207); am Handy steht er in der kleineren Schrift über die volle Breite.
 */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamAvatar } from '../../../components/ui';
import { Icons } from '../../../components/ui/Icons';
import { ColorDot } from '../../../components/ui/atoms/ColorDot';
import { HyphenSafe } from '../../../components/ui/atoms/TeamName';
import { primaryColorOf } from '../../../core/models/teamColors';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { getGroupDisplayName } from '../../../utils/displayNames';
import type { Team, Tournament } from '../../../types/tournament';
import type { TeamMatchAnalysis } from '../../../utils/teamHelpers';
import {
  badgeStyle, expandButtonStyle, metaItemStyle, teamCardHeaderMobileStyle, teamCardHeaderStyle, teamCardLeftStyle, teamCardMetaStyle, teamCardTopRowMobileStyle, teamNameRowStyle, teamNameStyle,
} from '../teamsTabCardStyles';

interface TeamCardHeaderProps {
  team: Team;
  tournament: Tournament;
  analysis: TeamMatchAnalysis;
  isExpanded: boolean;
  canEditTeams: boolean;
  /** Klick auf die Kopfzeile (die Karte entscheidet, ob sie wirkt). */
  onToggle: () => void;
  /** Klick auf den Pfeil. */
  onArrow: () => void;
  onLogo: () => void;
}

export function TeamCardHeader({ team, tournament, analysis, isExpanded, canEditTeams, onToggle, onArrow, onLogo }: TeamCardHeaderProps): ReactElement {
  const { t } = useTranslation('tournament');
  const isMobile = useIsMobile();
  const primaryColor = primaryColorOf(team.colors);
  const badge = team.group ? (
    <span style={{ ...badgeStyle(cssVars.colors.primary, cssVars.colors.infoBadgeBg), ...metaItemStyle }}>{getGroupDisplayName(team.group, tournament)}</span>
  ) : null;

  const avatar = (
    <div
      onClick={(e) => { e.stopPropagation(); if (canEditTeams) { onLogo(); } }}
      style={{ cursor: canEditTeams ? 'pointer' : 'default', flexShrink: 0 }}
    >
      <TeamAvatar team={team} size={isMobile ? 'md' : 'lg'} showColorRing />
    </div>
  );
  const nameRow = (
    <div style={teamNameRowStyle}>
      <span style={isMobile ? { ...teamNameStyle, fontSize: cssVars.fontSizes.md } : teamNameStyle} data-testid={`team-name-${team.id}`}>
        <span data-teamname><HyphenSafe text={team.name} /></span>
      </span>
      {!isMobile && badge}
    </div>
  );
  const meta = (
    <div style={teamCardMetaStyle}>
      {isMobile && badge}
      <ColorDot size="xs" color={primaryColor} label={primaryColor === undefined ? t('matchCard.shirtUnknown') : t('teams.jerseyColor', { color: primaryColor })} testId={`team-color-dot-${team.id}`} />
      {analysis.matchesWithResults > 0 && <span style={metaItemStyle}>{t('teams.results', { count: analysis.matchesWithResults })}</span>}
      {analysis.matchesWithoutResults > 0 && <span style={metaItemStyle}>{t('teams.planned', { count: analysis.matchesWithoutResults })}</span>}
    </div>
  );
  const arrow = (
    <button
      data-testid={`team-expand-arrow-${team.id}`}
      style={{ ...expandButtonStyle, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
      onClick={(e) => { e.stopPropagation(); onArrow(); }}
      aria-label={isExpanded ? t('teams.collapse') : t('teams.expand')}
      aria-expanded={isExpanded}
    >
      <Icons.ChevronDown size={iconSizeValues.sm} />
    </button>
  );

  if (isMobile) {
    return (
      <div data-testid={`team-expand-toggle-${team.id}`} style={teamCardHeaderMobileStyle} onClick={onToggle}>
        <div style={teamCardTopRowMobileStyle}>
          {avatar}
          <div style={{ minWidth: 0, flex: 1 }}>{meta}</div>
          {arrow}
        </div>
        {nameRow}
      </div>
    );
  }
  return (
    <div data-testid={`team-expand-toggle-${team.id}`} style={teamCardHeaderStyle} onClick={onToggle}>
      <div style={teamCardLeftStyle}>
        {avatar}
        <div style={{ minWidth: 0, flex: 1 }}>
          {nameRow}
          {meta}
        </div>
      </div>
      {arrow}
    </div>
  );
}
