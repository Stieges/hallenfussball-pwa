/**
 * Finals Options Generator
 *
 * Generiert sinnvolle und mögliche Finalrunden-Varianten basierend auf:
 * - T = Gesamtzahl Teams
 * - G = Anzahl Gruppen
 *
 * Unterscheidung:
 * - "recommended" = Sinnvoll (fair, wenig Freilose, gute Struktur)
 * - "possible" = Nur möglich (theoretisch machbar, aber organisatorisch ungünstig)
 */

import { FinalsPreset } from '../types/tournament';
import i18n from '../i18n';

export interface FinalsOption {
  preset: FinalsPreset;
  label: string;
  description: string;
  category: 'recommended' | 'possible';
  minGroups?: number; // Mindestanzahl Gruppen für diese Variante
  finalTeams: number; // Anzahl Teams in der Finalrunde
  explanation?: string; // Warum sinnvoll oder nur möglich
}

/**
 * Gibt alle Finalrunden-Optionen für eine gegebene Anzahl Gruppen zurück
 */
export function getFinalsOptions(numberOfGroups: number): FinalsOption[] {
  const options: FinalsOption[] = [];

  // KEINE FINALRUNDE
  options.push({
    preset: 'none',
    label: i18n.t('wizard:finalsOptions.none.label', { defaultValue: '' }),
    description: i18n.t('wizard:finalsOptions.none.description', { defaultValue: '' }),
    category: 'recommended',
    finalTeams: 0,
    explanation: i18n.t('wizard:finalsOptions.none.explanation', { defaultValue: '' }),
  });

  // 2 GRUPPEN
  if (numberOfGroups === 2) {
    // Empfohlen
    options.push({
      preset: 'top-4',
      label: i18n.t('wizard:finalsOptions.top4.label2g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top4.description2g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 4,
      explanation: i18n.t('wizard:finalsOptions.top4.explanation2g', { defaultValue: '' }),
    });

    options.push({
      preset: 'all-places',
      label: i18n.t('wizard:finalsOptions.allPlaces.label2g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.allPlaces.description2g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 8,
      explanation: i18n.t('wizard:finalsOptions.allPlaces.explanation2g', { defaultValue: '' }),
    });

    // Nur möglich
    options.push({
      preset: 'final-only',
      label: i18n.t('wizard:finalsOptions.finalOnly.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.finalOnly.description2g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 2,
      explanation: i18n.t('wizard:finalsOptions.finalOnly.explanation2g', { defaultValue: '' }),
    });
  }

  // 3 GRUPPEN
  else if (numberOfGroups === 3) {
    // Empfohlen
    options.push({
      preset: 'top-4',
      label: i18n.t('wizard:finalsOptions.top4.label3g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top4.description3g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 4,
      explanation: i18n.t('wizard:finalsOptions.top4.explanation3g', { defaultValue: '' }),
    });

    // Nur möglich
    options.push({
      preset: 'final-only',
      label: i18n.t('wizard:finalsOptions.finalOnly.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.finalOnly.description3g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 2,
      explanation: i18n.t('wizard:finalsOptions.finalOnly.explanation3g', { defaultValue: '' }),
    });

    options.push({
      preset: 'all-places',
      label: i18n.t('wizard:finalsOptions.allPlaces.label3g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.allPlaces.description3g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 6,
      explanation: i18n.t('wizard:finalsOptions.allPlaces.explanation3g', { defaultValue: '' }),
    });
  }

  // 4 GRUPPEN
  else if (numberOfGroups === 4) {
    // Empfohlen
    options.push({
      preset: 'top-8',
      label: i18n.t('wizard:finalsOptions.top8.label4g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top8.description4g', { defaultValue: '' }),
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: i18n.t('wizard:finalsOptions.top8.explanation4g', { defaultValue: '' }),
    });

    options.push({
      preset: 'top-4',
      label: i18n.t('wizard:finalsOptions.top4.label4g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top4.description4g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 4,
      explanation: i18n.t('wizard:finalsOptions.top4.explanation4g', { defaultValue: '' }),
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: i18n.t('wizard:finalsOptions.allPlaces.label4g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.allPlaces.description4g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 16,
      explanation: i18n.t('wizard:finalsOptions.allPlaces.explanation4g', { defaultValue: '' }),
    });

    options.push({
      preset: 'final-only',
      label: i18n.t('wizard:finalsOptions.finalOnly.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.finalOnly.description4g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 2,
      explanation: i18n.t('wizard:finalsOptions.finalOnly.explanation4g', { defaultValue: '' }),
    });
  }

  // 5-7 GRUPPEN
  else if (numberOfGroups >= 5 && numberOfGroups < 8) {
    // Empfohlen
    options.push({
      preset: 'top-8',
      label: i18n.t('wizard:finalsOptions.top8.label5to7g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top8.description5to7g', { defaultValue: '' }),
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: i18n.t('wizard:finalsOptions.top8.explanation5to7g', { defaultValue: '' }),
    });

    options.push({
      preset: 'top-4',
      label: i18n.t('wizard:finalsOptions.top4.label5to7g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top4.description5to7g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 4,
      explanation: i18n.t('wizard:finalsOptions.top4.explanation5to7g', { defaultValue: '' }),
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: i18n.t('wizard:finalsOptions.allPlaces.label5to7g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.allPlaces.description5to7g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: numberOfGroups * 4,
      explanation: i18n.t('wizard:finalsOptions.allPlaces.explanation5to7g', { defaultValue: '' }),
    });

    options.push({
      preset: 'final-only',
      label: i18n.t('wizard:finalsOptions.finalOnly.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.finalOnly.descriptionDefault', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 2,
      explanation: i18n.t('wizard:finalsOptions.finalOnly.explanation5to7g', { defaultValue: '' }),
    });
  }

  // 8+ GRUPPEN
  else if (numberOfGroups >= 8) {
    // Empfohlen
    options.push({
      preset: 'top-16',
      label: i18n.t('wizard:finalsOptions.top16.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top16.description', { defaultValue: '' }),
      category: 'recommended',
      minGroups: 8,
      finalTeams: 16,
      explanation: i18n.t('wizard:finalsOptions.top16.explanation', { defaultValue: '' }),
    });

    options.push({
      preset: 'top-8',
      label: i18n.t('wizard:finalsOptions.top8.label8g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top8.description8g', { defaultValue: '' }),
      category: 'recommended',
      minGroups: 4,
      finalTeams: 8,
      explanation: i18n.t('wizard:finalsOptions.top8.explanation8g', { defaultValue: '' }),
    });

    options.push({
      preset: 'top-4',
      label: i18n.t('wizard:finalsOptions.top4.label8g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.top4.description8g', { defaultValue: '' }),
      category: 'recommended',
      finalTeams: 4,
      explanation: i18n.t('wizard:finalsOptions.top4.explanation8g', { defaultValue: '' }),
    });

    // Nur möglich
    options.push({
      preset: 'all-places',
      label: i18n.t('wizard:finalsOptions.allPlaces.label8g', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.allPlaces.description8g', { defaultValue: '' }),
      category: 'possible',
      finalTeams: numberOfGroups * 4,
      explanation: i18n.t('wizard:finalsOptions.allPlaces.explanation8g', { defaultValue: '' }),
    });

    options.push({
      preset: 'final-only',
      label: i18n.t('wizard:finalsOptions.finalOnly.label', { defaultValue: '' }),
      description: i18n.t('wizard:finalsOptions.finalOnly.descriptionDefault', { defaultValue: '' }),
      category: 'possible',
      finalTeams: 2,
      explanation: i18n.t('wizard:finalsOptions.finalOnly.explanation8g', { defaultValue: '' }),
    });
  }

  return options;
}

/**
 * Gibt die empfohlene (default) Finalrunden-Option zurück
 */
export function getRecommendedFinalsPreset(numberOfGroups: number): FinalsPreset {
  if (numberOfGroups === 2) {return 'top-4';}
  if (numberOfGroups === 3) {return 'top-4';}
  if (numberOfGroups === 4) {return 'top-8';}
  if (numberOfGroups >= 5 && numberOfGroups < 8) {return 'top-8';}
  if (numberOfGroups >= 8) {return 'top-16';}
  return 'none';
}

/**
 * Prüft ob eine Finalrunden-Variante für die Gruppenanzahl empfohlen ist
 */
export function isRecommendedOption(preset: FinalsPreset, numberOfGroups: number): boolean {
  const options = getFinalsOptions(numberOfGroups);
  const option = options.find(opt => opt.preset === preset);
  return option?.category === 'recommended';
}
