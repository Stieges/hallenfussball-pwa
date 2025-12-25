/**
 * User Profile Types
 *
 * Zentrale Benutzer-Einstellungen für die App.
 * Gespeichert in localStorage unter 'userProfile'.
 */

import { PlacementCriterion } from './tournament';

// ============================================================================
// Subscription Types (for Premium Features like Corporate Colors)
// ============================================================================

/**
 * Subscription Plan Tiers
 * - free: Basis-Funktionen, Standard-Farbschema
 * - pro: Corporate Colors, erweiterte Anpassungen
 * - team: Pro-Features + Multi-User-Verwaltung
 */
export type SubscriptionPlan = 'free' | 'pro' | 'team';

/**
 * Corporate Color Configuration
 */
export interface CorporateColorConfig {
  primary: string;
  secondary: string;
  textOnPrimary?: string;
  textOnSecondary?: string;
  presetId?: string;      // Falls Preset verwendet
  customized?: boolean;   // Falls Preset angepasst wurde
}

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

  // Subscription & Premium Features
  plan: SubscriptionPlan;
  corporateColors?: CorporateColorConfig;

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
    plan: 'free', // Default subscription tier
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

// ============================================================================
// Feature Gating Functions
// ============================================================================

/**
 * Checks if user can use corporate colors feature
 * Requires Pro or Team subscription
 */
export function canUseCorporateColors(profile: UserProfile | null): boolean {
  if (!profile) {return false;}
  return profile.plan === 'pro' || profile.plan === 'team';
}

/**
 * Checks if user can use a specific color preset
 * Free presets are available to all, premium presets require subscription
 */
export function canUsePreset(profile: UserProfile | null, isPremiumPreset: boolean): boolean {
  if (!isPremiumPreset) {return true;}
  return canUseCorporateColors(profile);
}

/**
 * Gets the display name for a subscription plan
 */
export function getPlanDisplayName(plan: SubscriptionPlan): string {
  const names: Record<SubscriptionPlan, string> = {
    free: 'Basis',
    pro: 'Pro',
    team: 'Team',
  };
  return names[plan];
}
