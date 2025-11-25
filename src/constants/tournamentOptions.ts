/**
 * Zentrale Konfiguration für alle Tournament-Dropdown-Optionen
 */

export interface SelectOption {
  value: string | number;
  label: string;
}

/**
 * Altersklassen für Fußball
 */
export const FOOTBALL_AGE_CLASS_OPTIONS: SelectOption[] = [
  // Jugendklassen (G bis A)
  { value: 'G-Jugend', label: 'G-Jugend (U7)' },
  { value: 'F-Jugend', label: 'F-Jugend (U9)' },
  { value: 'E-Jugend', label: 'E-Jugend (U10/U11)' },
  { value: 'D-Jugend', label: 'D-Jugend (U12/U13)' },
  { value: 'C-Jugend', label: 'C-Jugend (U14/U15)' },
  { value: 'B-Jugend', label: 'B-Jugend (U16/U17)' },
  { value: 'A-Jugend', label: 'A-Jugend (U18/U19)' },

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
  { value: 'Senioren', label: 'Senioren' },
  { value: 'Herren', label: 'Herren' },
  { value: 'Damen', label: 'Damen' },
  { value: 'AH', label: 'AH (Alte Herren)' },
  { value: 'Ü30', label: 'Ü30' },
  { value: 'Ü35', label: 'Ü35' },
  { value: 'Ü40', label: 'Ü40' },
  { value: 'Ü45', label: 'Ü45' },
  { value: 'Ü50', label: 'Ü50' },
];

/**
 * Altersklassen für andere Sportarten
 */
export const OTHER_AGE_CLASS_OPTIONS: SelectOption[] = [
  { value: 'U8', label: 'U8' },
  { value: 'U10', label: 'U10' },
  { value: 'U12', label: 'U12' },
  { value: 'U14', label: 'U14' },
  { value: 'U16', label: 'U16' },
  { value: 'U18', label: 'U18' },
  { value: 'Jugend', label: 'Jugend' },
  { value: 'Erwachsene', label: 'Erwachsene' },
  { value: 'Mixed', label: 'Mixed' },
];

/**
 * Helper-Funktion: Gibt die passenden Altersklassen basierend auf der Sportart zurück
 */
export const getAgeClassOptions = (sport: 'football' | 'other'): SelectOption[] => {
  return sport === 'football' ? FOOTBALL_AGE_CLASS_OPTIONS : OTHER_AGE_CLASS_OPTIONS;
};

/**
 * Gruppensysteme
 */
export const GROUP_SYSTEM_OPTIONS: SelectOption[] = [
  { value: 'roundRobin', label: 'Jeder gegen jeden' },
  { value: 'groupsAndFinals', label: 'Gruppenphase + Finalrunde' },
];

/**
 * Anzahl Gruppen - Dynamisch generieren bis zu einer sinnvollen Obergrenze
 */
export const NUMBER_OF_GROUPS_OPTIONS: SelectOption[] = Array.from({ length: 26 }, (_, i) => ({
  value: i + 1,
  label: i === 0 ? '1 Gruppe' : `${i + 1} Gruppen`,
}));

/**
 * Anzahl Felder (für Classic Mode)
 */
export const NUMBER_OF_FIELDS_OPTIONS: SelectOption[] = [
  { value: 1, label: '1 Feld' },
  { value: 2, label: '2 Felder' },
  { value: 3, label: '3 Felder' },
  { value: 4, label: '4 Felder' },
  { value: 5, label: '5 Felder' },
  { value: 6, label: '6 Felder' },
  { value: 8, label: '8 Felder' },
  { value: 10, label: '10 Felder' },
];

/**
 * Anzahl Runden (für Mini-Fussball Mode)
 */
export const NUMBER_OF_ROUNDS_OPTIONS: SelectOption[] = [
  { value: 5, label: '5 Runden' },
  { value: 6, label: '6 Runden' },
  { value: 7, label: '7 Runden' },
  { value: 8, label: '8 Runden' },
  { value: 9, label: '9 Runden' },
  { value: 10, label: '10 Runden' },
];

/**
 * Anzahl Spielabschnitte
 */
export const GAME_PERIODS_OPTIONS: SelectOption[] = [
  { value: 1, label: '1 (durchgehend)' },
  { value: 2, label: '2 (zwei Halbzeiten)' },
  { value: 3, label: '3 Abschnitte' },
  { value: 4, label: '4 Abschnitte' },
];

/**
 * Standard-Werte
 */
export const DEFAULT_VALUES = {
  ageClass: 'U11',
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
