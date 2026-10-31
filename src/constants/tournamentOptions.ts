/**
 * Zentrale Konfiguration für alle Tournament-Dropdown-Optionen
 */

import i18n from '../i18n';

export interface SelectOption {
  value: string | number;
  label: string;
}

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
  ageClass: '', // Keine Angabe: startet leer, ist freiwillig (@W2B-022)
  numberOfGroups: 2,
  numberOfFields: 1,
  groupPhaseGameDuration: 10, // Spieldauer Gruppenphase (Standard: 10 Min)
  groupPhaseBreakDuration: 2, // Pause zwischen Spielen in Gruppenphase (Standard: 2 Min)
  finalRoundGameDuration: 10, // Spieldauer Finalrunde (Standard: 10 Min)
  finalRoundBreakDuration: 2, // Pause zwischen Spielen in Finalrunde (Standard: 2 Min)
  breakBetweenPhases: 5, // Pause zwischen Gruppenphase und Finalrunde (Standard: 5 Min)
  gamePeriods: 1, // Standard: durchgehend ohne Unterbrechung
  halftimeBreak: 1, // Halbzeitpause (Standard: 1 Min)
  numberOfRounds: 1, // @TM-152: eine Runde, nur bei „Jeder gegen jeden“ wählbar (1–10)
} as const;
