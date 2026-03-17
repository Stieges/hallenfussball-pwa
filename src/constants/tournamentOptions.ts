/**
 * Zentrale Konfiguration für alle Tournament-Dropdown-Optionen
 */

import i18n from '../i18n';

export interface SelectOption {
  value: string | number;
  label: string;
}

/**
 * Altersklassen für Fußball
 */
export function getFootballAgeClassOptions(): SelectOption[] {
  return [
    // Jugendklassen (G bis A)
    { value: 'G-Jugend', label: i18n.t('wizard:options.ageClass.gJugend', { defaultValue: '' }) },
    { value: 'F-Jugend', label: i18n.t('wizard:options.ageClass.fJugend', { defaultValue: '' }) },
    { value: 'E-Jugend', label: i18n.t('wizard:options.ageClass.eJugend', { defaultValue: '' }) },
    { value: 'D-Jugend', label: i18n.t('wizard:options.ageClass.dJugend', { defaultValue: '' }) },
    { value: 'C-Jugend', label: i18n.t('wizard:options.ageClass.cJugend', { defaultValue: '' }) },
    { value: 'B-Jugend', label: i18n.t('wizard:options.ageClass.bJugend', { defaultValue: '' }) },
    { value: 'A-Jugend', label: i18n.t('wizard:options.ageClass.aJugend', { defaultValue: '' }) },

    // U-Klassen (numerisch sortiert)
    { value: 'U7', label: 'U7' },
    { value: 'U8', label: 'U8' },
    { value: 'U9', label: 'U9' },
    { value: 'U10', label: 'U10' },
    { value: 'U11', label: 'U11' },
    { value: 'U12', label: 'U12' },
    { value: 'U13', label: 'U13' },
    { value: 'U14', label: 'U14' },
    { value: 'U15', label: 'U15' },
    { value: 'U16', label: 'U16' },
    { value: 'U17', label: 'U17' },
    { value: 'U18', label: 'U18' },
    { value: 'U19', label: 'U19' },
    { value: 'U20', label: 'U20' },
    { value: 'U21', label: 'U21' },
    { value: 'U23', label: 'U23' },

    // Senioren
    { value: 'Senioren', label: i18n.t('wizard:options.ageClass.senioren', { defaultValue: '' }) },
    { value: 'Herren', label: i18n.t('wizard:options.ageClass.herren', { defaultValue: '' }) },
    { value: 'Damen', label: i18n.t('wizard:options.ageClass.damen', { defaultValue: '' }) },
    { value: 'AH', label: i18n.t('wizard:options.ageClass.ah', { defaultValue: '' }) },
    { value: 'Ü30', label: 'Ü30' },
    { value: 'Ü35', label: 'Ü35' },
    { value: 'Ü40', label: 'Ü40' },
    { value: 'Ü45', label: 'Ü45' },
    { value: 'Ü50', label: 'Ü50' },
  ];
}

/**
 * Altersklassen für andere Sportarten
 */
export function getOtherAgeClassOptions(): SelectOption[] {
  return [
    { value: 'U8', label: 'U8' },
    { value: 'U10', label: 'U10' },
    { value: 'U12', label: 'U12' },
    { value: 'U14', label: 'U14' },
    { value: 'U16', label: 'U16' },
    { value: 'U18', label: 'U18' },
    { value: 'Jugend', label: i18n.t('wizard:options.ageClass.jugend', { defaultValue: '' }) },
    { value: 'Erwachsene', label: i18n.t('wizard:options.ageClass.erwachsene', { defaultValue: '' }) },
    { value: 'Mixed', label: i18n.t('wizard:options.ageClass.mixed', { defaultValue: '' }) },
  ];
}

/**
 * Helper-Funktion: Gibt die passenden Altersklassen basierend auf der Sportart zurück
 */
export const getAgeClassOptions = (sport: 'football' | 'other'): SelectOption[] => {
  return sport === 'football' ? getFootballAgeClassOptions() : getOtherAgeClassOptions();
};

/**
 * Gruppensysteme
 */
export function getGroupSystemOptions(): SelectOption[] {
  return [
    { value: 'roundRobin', label: i18n.t('wizard:options.groupSystem.roundRobin', { defaultValue: '' }) },
    { value: 'groupsAndFinals', label: i18n.t('wizard:options.groupSystem.groupsAndFinals', { defaultValue: '' }) },
  ];
}

/**
 * Anzahl Gruppen - Dynamisch generieren bis zu einer sinnvollen Obergrenze
 */
export function getNumberOfGroupsOptions(): SelectOption[] {
  return Array.from({ length: 26 }, (_, i) => ({
    value: i + 1,
    label: i === 0
      ? i18n.t('wizard:options.groups.one', { defaultValue: '' })
      : i18n.t('wizard:options.groups.multiple', { count: i + 1, defaultValue: '' }),
  }));
}

/**
 * Anzahl Felder (für Classic Mode)
 */
export function getNumberOfFieldsOptions(): SelectOption[] {
  return [1, 2, 3, 4, 5, 6, 8, 10].map(n => ({
    value: n,
    label: n === 1
      ? i18n.t('wizard:options.fields.one', { defaultValue: '' })
      : i18n.t('wizard:options.fields.multiple', { count: n, defaultValue: '' }),
  }));
}

/**
 * Anzahl Runden (für Mini-Fussball Mode)
 */
export function getNumberOfRoundsOptions(): SelectOption[] {
  return [5, 6, 7, 8, 9, 10].map(n => ({
    value: n,
    label: i18n.t('wizard:options.rounds', { count: n, defaultValue: '' }),
  }));
}

/**
 * Anzahl Spielabschnitte
 */
export function getGamePeriodsOptions(): SelectOption[] {
  return [
    { value: 1, label: i18n.t('wizard:options.gamePeriods.one', { defaultValue: '' }) },
    { value: 2, label: i18n.t('wizard:options.gamePeriods.two', { defaultValue: '' }) },
    { value: 3, label: i18n.t('wizard:options.gamePeriods.three', { defaultValue: '' }) },
    { value: 4, label: i18n.t('wizard:options.gamePeriods.four', { defaultValue: '' }) },
  ];
}

/**
 * Standard-Werte
 */
export const DEFAULT_VALUES = {
  ageClass: '', // Keine Vorauswahl - Benutzer muss selbst wählen
  numberOfGroups: 2,
  numberOfFields: 1,
  groupPhaseGameDuration: 10, // Spieldauer Gruppenphase (Standard: 10 Min)
  groupPhaseBreakDuration: 2, // Pause zwischen Spielen in Gruppenphase (Standard: 2 Min)
  finalRoundGameDuration: 10, // Spieldauer Finalrunde (Standard: 10 Min)
  finalRoundBreakDuration: 2, // Pause zwischen Spielen in Finalrunde (Standard: 2 Min)
  breakBetweenPhases: 5, // Pause zwischen Gruppenphase und Finalrunde (Standard: 5 Min)
  gamePeriods: 1, // Standard: durchgehend ohne Unterbrechung
  halftimeBreak: 1, // Halbzeitpause (Standard: 1 Min)
  numberOfRounds: 5,
} as const;
