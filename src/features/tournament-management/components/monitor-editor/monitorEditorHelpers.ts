/**
 * Hilfsfunktionen des Monitor-Editors (M1a ausgelagert): Gruppenliste und Folien-Beschreibung – ohne React.
 */

import type { TFunction } from 'i18next';
import type { Tournament, TournamentGroup } from '../../../../types/tournament';
import type { MonitorSlide } from '../../../../types/monitor';

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

  switch (type) {
    case 'live':
    case 'schedule-field': {
      return config.fieldId ? getFieldDisplayName(config.fieldId) : t('monitorEditor.notConfigured');
    }
    case 'standings':
    case 'schedule-group': {
      const group = groups.find(g => g.id === config.groupId);
      const customName = group?.customName;
      if (customName) {return customName;}
      const letterName = t('monitorEditor.groupLabel', { letter: config.groupId });
      if (letterName) {return letterName;}
      return t('monitorEditor.notConfigured');
    }
    case 'sponsor': {
      const sponsor = sponsors.find(s => s.id === config.sponsorId);
      const sponsorName = sponsor?.name;
      if (sponsorName) {return sponsorName;}
      return t('monitorEditor.notConfigured');
    }
    case 'custom-text': {
      const headline = config.headline;
      if (headline) {return headline;}
      return t('monitorEditor.customText');
    }
    default:
      return '';
  }
}
