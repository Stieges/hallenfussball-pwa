/**
 * Hilfsfunktionen des Monitor-Editors (M1a ausgelagert): Gruppenliste und Folien-Beschreibung – ohne React.
 */

import type { TFunction } from 'i18next';
import type { Tournament, TournamentGroup } from '../../../../types/tournament';
import type { MonitorSlide } from '../../../../types/monitor';
import { assignedGroupIds } from '../../../../core/services/monitorConfigTransferChecks';
import { slideSetupProblem } from '../../../../core/services/monitorSlideSetup';

/** Feld, das der Monitor nimmt, wenn eine Folie keines gewählt hat (@ZM-074) */
const DEFAULT_FIELD_ID = 'field-1';

export interface SlideDescriptionDeps {
  groups: TournamentGroup[];
  sponsors: { id: string; name: string }[];
  getFieldDisplayName: (id: string) => string;
  t: TFunction<'tournament'>;
}

/**
 * Get groups from tournament - generate if not explicit.
 * For roundRobin tournaments, there's only one group (all teams play each other).
 */
export function buildEditorGroups(tournament: Tournament, t: TFunction<'tournament'>): TournamentGroup[] {
  // Round-robin mode = single group tournament (everyone plays everyone)
  if (tournament.groupSystem === 'roundRobin') {
    return [{ id: 'default', customName: t('monitorEditor.allTeams') }];
  }

  // Gruppen, zu denen Teams gehören, sind die Angebote – Namen aus den gespeicherten Gruppen, sonst „Gruppe A“ (@ZM-181)
  const assigned = assignedGroupIds(tournament.teams);
  if (assigned.length > 0) {
    return assigned.map(id => tournament.groups?.find(g => g.id === id) ?? { id, customName: t('monitorEditor.groupLabel', { letter: id }) });
  }

  // If explicit groups are defined, use them
  if (tournament.groups && tournament.groups.length > 0) {
    return tournament.groups;
  }

  // If numberOfGroups is set, generate synthetic group entries
  const numGroups = tournament.numberOfGroups ?? 1;
  if (numGroups <= 1) {
    // Single group tournament - return one default group
    return [{ id: 'default', customName: t('monitorEditor.allTeams') }];
  }

  // Generate group entries A, B, C, etc.
  return Array.from({ length: numGroups }, (_, i) => ({
    id: String.fromCharCode(65 + i), // A, B, C...
    customName: t('monitorEditor.groupLabel', { letter: String.fromCharCode(65 + i) }),
  }));
}

export function getSlideDescription(slide: MonitorSlide, deps: SlideDescriptionDeps): string {
  const { type, config } = slide;
  const { groups, sponsors, getFieldDisplayName, t } = deps;

  const problem = slideSetupProblem(slide, sponsors);
  if (problem) {return t(`monitorEditor.setupProblem.${problem}`);}

  switch (type) {
    case 'live':
    case 'schedule-field': {
      // Ohne Feld gilt Feld 1, wie am Monitor (@ZM-074, @ME-076)
      return getFieldDisplayName(config.fieldId ?? DEFAULT_FIELD_ID);
    }
    case 'standings':
    case 'schedule-group': {
      // Ohne Auswahl: bei nur einer Gruppe „Alle Teams“, sonst „Alle Gruppen“ (@ME-075)
      if (!config.groupId) {
        return groups.length <= 1 ? t('monitorEditor.allTeams') : t('slideEditor.allGroups');
      }
      const group = groups.find(g => g.id === config.groupId);
      const customName = group?.customName;
      if (customName) {return customName;}
      return t('monitorEditor.groupLabel', { letter: config.groupId });
    }
    case 'sponsor': {
      const sponsorName = sponsors.find(s => s.id === config.sponsorId)?.name;
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- leerer Name soll den Ersatztext zeigen
      return sponsorName || t('monitorEditor.notConfigured');
    }
    case 'custom-text': {
      return config.headline?.trim() ? config.headline : t('monitorEditor.customText');
    }
    default:
      return '';
  }
}
