/**
 * Football (Indoor) Sport Configuration
 *
 * Complete configuration for indoor football (Hallenfußball) tournaments.
 * This is the default and most complete sport configuration.
 */

import { SportConfig } from './types';

export const footballIndoorConfig: SportConfig = {
  id: 'football-indoor',
  name: 'Hallenfußball',
  icon: '⚽',
  category: 'ball',

  terminology: {
    field: 'Feld',
    fieldPlural: 'Felder',
    goal: 'Tor',
    goalPlural: 'Tore',
    period: 'Halbzeit',
    periodPlural: 'Halbzeiten',
    match: 'Spiel',
    matchPlural: 'Spiele',
    team: 'Mannschaft',
    teamPlural: 'Mannschaften',
    referee: 'Schiedsrichter',
    refereePlural: 'Schiedsrichter',
    scoreFormat: 'goals',
    scoreLabel: 'Ergebnis',
    win: 'Sieg',
    loss: 'Niederlage',
    draw: 'Unentschieden',
    goalAnimationText: 'TOR!',
  },

  defaults: {
    gameDuration: 10,
    breakDuration: 2,
    periods: 1,
    periodBreak: 1,
    pointSystem: {
      win: 3,
      draw: 1,
      loss: 0,
    },
    allowDraw: true,
    typicalTeamSize: 6,
    typicalFieldCount: 2,
    minRestSlots: 1,
  },

  rules: {
    canDrawInGroupPhase: true,
    canDrawInFinals: false,
    hasOvertime: false,
    hasShootout: true,
    isSetBased: false,
  },

  features: {
    hasDFBKeys: true,
    hasBambiniMode: true,
    hasRefereeAssignment: true,
    hasGoalAnimation: true,
    hasMatchTimer: true,
    hasPeriodTimer: true,
    isSetBased: false,
  },

  ageClasses: [
    // Jugendklassen (G bis A)
    { value: 'G-Jugend', label: 'G-Jugend (U7)', minAge: 5, maxAge: 7 },
    { value: 'F-Jugend', label: 'F-Jugend (U9)', minAge: 7, maxAge: 9 },
    { value: 'E-Jugend', label: 'E-Jugend (U10/U11)', minAge: 9, maxAge: 11 },
    { value: 'D-Jugend', label: 'D-Jugend (U12/U13)', minAge: 11, maxAge: 13 },
    { value: 'C-Jugend', label: 'C-Jugend (U14/U15)', minAge: 13, maxAge: 15 },
    { value: 'B-Jugend', label: 'B-Jugend (U16/U17)', minAge: 15, maxAge: 17 },
    { value: 'A-Jugend', label: 'A-Jugend (U18/U19)', minAge: 17, maxAge: 19 },

    // U-Klassen (numerisch sortiert)
    { value: 'U7', label: 'U7', maxAge: 7 },
    { value: 'U8', label: 'U8', maxAge: 8 },
    { value: 'U9', label: 'U9', maxAge: 9 },
    { value: 'U10', label: 'U10', maxAge: 10 },
    { value: 'U11', label: 'U11', maxAge: 11 },
    { value: 'U12', label: 'U12', maxAge: 12 },
    { value: 'U13', label: 'U13', maxAge: 13 },
    { value: 'U14', label: 'U14', maxAge: 14 },
    { value: 'U15', label: 'U15', maxAge: 15 },
    { value: 'U16', label: 'U16', maxAge: 16 },
    { value: 'U17', label: 'U17', maxAge: 17 },
    { value: 'U18', label: 'U18', maxAge: 18 },
    { value: 'U19', label: 'U19', maxAge: 19 },
    { value: 'U20', label: 'U20', maxAge: 20 },
    { value: 'U21', label: 'U21', maxAge: 21 },
    { value: 'U23', label: 'U23', maxAge: 23 },

    // Senioren
    { value: 'Senioren', label: 'Senioren', minAge: 18 },
    { value: 'Herren', label: 'Herren', minAge: 18 },
    { value: 'Damen', label: 'Damen', minAge: 18 },
    { value: 'AH', label: 'AH (Alte Herren)', minAge: 32 },
    { value: 'Ü30', label: 'Ü30', minAge: 30 },
    { value: 'Ü35', label: 'Ü35', minAge: 35 },
    { value: 'Ü40', label: 'Ü40', minAge: 40 },
    { value: 'Ü45', label: 'Ü45', minAge: 45 },
    { value: 'Ü50', label: 'Ü50', minAge: 50 },
  ],

  validation: {
    minTeams: 3,
    maxTeams: 64,
    minFields: 1,
    maxFields: 10,
    minGameDuration: 5,
    maxGameDuration: 30,
  },
};

/**
 * Football Outdoor Configuration
 * Field football with longer game durations and larger fields
 */
export const footballOutdoorConfig: SportConfig = {
  id: 'football-outdoor',
  name: 'Feldfußball',
  icon: '⚽',
  category: 'ball',

  terminology: {
    ...footballIndoorConfig.terminology,
    field: 'Platz',
    fieldPlural: 'Plätze',
  },

  defaults: {
    gameDuration: 25,
    breakDuration: 5,
    periods: 2,
    periodBreak: 5,
    pointSystem: {
      win: 3,
      draw: 1,
      loss: 0,
    },
    allowDraw: true,
    typicalTeamSize: 11,
    typicalFieldCount: 1,
    minRestSlots: 2,
  },

  rules: {
    canDrawInGroupPhase: true,
    canDrawInFinals: false,
    hasOvertime: true,
    overtimeDuration: 10,
    hasShootout: true,
    isSetBased: false,
  },

  features: {
    hasDFBKeys: true,
    hasBambiniMode: true,
    hasRefereeAssignment: true,
    hasGoalAnimation: true,
    hasMatchTimer: true,
    hasPeriodTimer: true,
    isSetBased: false,
  },

  ageClasses: footballIndoorConfig.ageClasses,

  validation: {
    minTeams: 3,
    maxTeams: 32,
    minFields: 1,
    maxFields: 4,
    minGameDuration: 10,
    maxGameDuration: 90,
  },
};
