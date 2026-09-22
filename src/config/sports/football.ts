/**
 * Football (Indoor) Sport Configuration
 *
 * Complete configuration for indoor football (Hallenfußball) tournaments.
 * This is the default and most complete sport configuration.
 */

import { SportConfig } from './types';

export const footballIndoorConfig: SportConfig = {
  id: 'football-indoor',
  icon: '⚽',
  category: 'ball',

  terminology: {
    scoreFormat: 'goals',
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
    typicalFieldCount: 1,
    minRestSlots: 1,
    defaultFinalsPreset: 'top-4',
  },

  rules: {
    canDrawInGroupPhase: true,
    canDrawInFinals: false,
    hasOvertime: false,
    hasShootout: true,
    defaultTiebreaker: 'shootout',
    defaultTiebreakerDuration: 5,
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

  // Beschriftungen leben in sport.json (`ageClasses.<value>`), siehe
  // AgeClassOption-Kommentar in types.ts.
  ageClasses: [
    // Jugendklassen (G bis A)
    { value: 'G-Jugend', minAge: 5, maxAge: 7 },
    { value: 'F-Jugend', minAge: 7, maxAge: 9 },
    { value: 'E-Jugend', minAge: 9, maxAge: 11 },
    { value: 'D-Jugend', minAge: 11, maxAge: 13 },
    { value: 'C-Jugend', minAge: 13, maxAge: 15 },
    { value: 'B-Jugend', minAge: 15, maxAge: 17 },
    { value: 'A-Jugend', minAge: 17, maxAge: 19 },

    // U-Klassen (numerisch sortiert)
    { value: 'U7', maxAge: 7 },
    { value: 'U8', maxAge: 8 },
    { value: 'U9', maxAge: 9 },
    { value: 'U10', maxAge: 10 },
    { value: 'U11', maxAge: 11 },
    { value: 'U12', maxAge: 12 },
    { value: 'U13', maxAge: 13 },
    { value: 'U14', maxAge: 14 },
    { value: 'U15', maxAge: 15 },
    { value: 'U16', maxAge: 16 },
    { value: 'U17', maxAge: 17 },
    { value: 'U18', maxAge: 18 },
    { value: 'U19', maxAge: 19 },
    { value: 'U20', maxAge: 20 },
    { value: 'U21', maxAge: 21 },
    { value: 'U23', maxAge: 23 },

    // Senioren
    { value: 'Senioren', minAge: 18 },
    { value: 'Herren', minAge: 18 },
    { value: 'Damen', minAge: 18 },
    { value: 'AH', minAge: 32 },
    { value: 'Ü30', minAge: 30 },
    { value: 'Ü35', minAge: 35 },
    { value: 'Ü40', minAge: 40 },
    { value: 'Ü45', minAge: 45 },
    { value: 'Ü50', minAge: 50 },
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
  icon: '⚽',
  category: 'ball',

  // Sportartabhängige Feld-Bezeichnung ("Platz"/"Plätze") liegt in sport.json
  // als `terminology.field_football-outdoor_*`, aufgelöst über useSportTerms.
  terminology: {
    ...footballIndoorConfig.terminology,
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
    defaultFinalsPreset: 'top-4',
  },

  rules: {
    canDrawInGroupPhase: true,
    canDrawInFinals: false,
    hasOvertime: true,
    overtimeDuration: 10,
    hasShootout: true,
    defaultTiebreaker: 'overtime-then-shootout',
    defaultTiebreakerDuration: 10,
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
