/**
 * User Profile Types
 *
 * Zentrale Benutzer-Einstellungen für die App.
 * Gespeichert in localStorage unter 'userProfile'.
 */

import { PlacementCriterion } from './tournament';

/**
 * User Profile Interface
 * Speichert Benutzerinformationen und App-Einstellungen
 */
export interface UserProfile {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Persönliche Daten
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  avatarUrl?: string;

  // Branding
  logoUrl?: string;
  logoBackgroundColor?: string;
  useLogoAsDefault: boolean;

  // Team-Mitglieder (siehe US-INVITE)
  team: TeamMember[];

  // Standard-Einstellungen für neue Turniere
  defaults: TournamentDefaults;

  // App-Einstellungen
  settings: AppSettings;
}

/**
 * Team Member - Helfer die Turniere verwalten dürfen
 */
export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: TeamMemberRole;
  ageClassRestrictions?: string[]; // Optional: Nur bestimmte Altersklassen
  createdAt: string;
}

export type TeamMemberRole =
  | 'timekeeper'   // Zeitnehmer - nur Timer-Kontrolle
  | 'scorekeeper'  // Schreiber - Ergebniseingabe
  | 'manager'      // Spielleiter - volle Kontrolle ohne Löschrechte
  | 'admin';       // Vollzugriff

/**
 * Standard-Einstellungen für neue Turniere
 */
export interface TournamentDefaults {
  groupPhaseGameDuration: number;
  groupPhaseBreakDuration: number;
  pointSystem: {
    win: number;
    draw: number;
    loss: number;
  };
  placementLogic: PlacementCriterion[];
  isKidsTournament: boolean;
  hideScoresForPublic: boolean;
  hideRankingsForPublic: boolean;
}

/**
 * App-weite Einstellungen
 */
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: 'de' | 'en';
  enableNotifications: boolean;
  enableOfflineMode: boolean;

  /**
   * Ergebnis-Sperre: Wenn aktiviert, können beendete Spiele nur über
   * den Korrektur-Workflow geändert werden.
   * Default: true (Sperre aktiv)
   */
  lockFinishedResults: boolean;
}

/**
 * Correction Reason - Gründe für Ergebnis-Korrekturen
 */
export type CorrectionReason =
  | 'input_error'      // Eingabefehler
  | 'referee_decision' // Schiedsrichterentscheidung
  | 'protest_accepted' // Protestentscheidung
  | 'technical_error'  // Technischer Fehler
  | 'other';           // Sonstiges

export const CORRECTION_REASONS: Record<CorrectionReason, string> = {
  input_error: 'Eingabefehler',
  referee_decision: 'Schiedsrichterentscheidung',
  protest_accepted: 'Protestentscheidung',
  technical_error: 'Technischer Fehler',
  other: 'Sonstiges',
};

/**
 * Default User Profile
 */
export function getDefaultUserProfile(): UserProfile {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: '',
    useLogoAsDefault: false,
    team: [],
    defaults: {
      groupPhaseGameDuration: 10,
      groupPhaseBreakDuration: 2,
      pointSystem: { win: 3, draw: 1, loss: 0 },
      placementLogic: [],
      isKidsTournament: false,
      hideScoresForPublic: false,
      hideRankingsForPublic: false,
    },
    settings: {
      theme: 'dark',
      language: 'de',
      enableNotifications: false,
      enableOfflineMode: false,
      lockFinishedResults: true, // Default: Sperre aktiv
    },
  };
}
