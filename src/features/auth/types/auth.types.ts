/**
 * Auth Types - Anmeldung & Rollen-System
 *
 * Datenmodell ist 1:1 Supabase-kompatibel für spätere Migration.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

// ============================================
// GLOBAL ROLES (Account-weit)
// ============================================

/**
 * Globale Rollen - gelten für den gesamten Account
 *
 * - guest: Nicht angemeldet, nur lokale Daten
 * - user: Standard-Account, kann Turniere erstellen
 * - admin: Globale Verwaltung, User-Management
 */
export type GlobalRole = 'guest' | 'user' | 'admin';

// ============================================
// TOURNAMENT ROLES (pro Turnier)
// ============================================

/**
 * Turnier-Rollen - gelten nur für ein spezifisches Turnier
 *
 * - owner: Ersteller, volle Kontrolle, kann Ownership übertragen
 * - co-admin: Stellvertreter, alles außer Turnier löschen/Owner ändern
 * - trainer: Verwaltet zugewiesene Teams, gibt Ergebnisse für eigene Teams ein
 * - collaborator: Kann alle Ergebnisse eingeben
 * - viewer: Nur lesen
 */
export type TournamentRole =
  | 'owner'
  | 'co-admin'
  | 'trainer'
  | 'collaborator'
  | 'viewer';

// ============================================
// USER (globaler Account)
// ============================================

/**
 * User - Repräsentiert einen registrierten Account
 */
export interface User {
  /** UUID */
  id: string;
  /** E-Mail-Adresse (unique, lowercase) */
  email: string;
  /** Anzeigename */
  name: string;
  /** Optional: Profilbild-URL */
  avatarUrl?: string;
  /** Globale Rolle */
  globalRole: GlobalRole;
  /**
   * True if user is a Supabase anonymous user.
   * Anonymous users have a real auth.users entry but no email/password.
   * They can later "claim" their account by adding credentials.
   * Different from 'guest' (globalRole) which is local-only.
   */
  isAnonymous?: boolean;
  /** Erstellungszeitpunkt (ISO 8601) */
  createdAt: string;
  /** Letztes Update (ISO 8601) */
  updatedAt: string;
  /** Letzter Login (ISO 8601) */
  lastLoginAt?: string;
}

// ============================================
// SESSION (Anmelde-Session)
// ============================================

/**
 * Session - Aktive Anmelde-Session eines Users
 */
export interface Session {
  /** UUID */
  id: string;
  /** FK → User.id */
  userId: string;
  /** Session-Token für Authentifizierung */
  token: string;
  /** Erstellungszeitpunkt (ISO 8601) */
  createdAt: string;
  /** Ablaufzeitpunkt (ISO 8601) */
  expiresAt: string;
  /** Letzte Aktivität (ISO 8601) */
  lastActivityAt: string;
}

// ============================================
// TOURNAMENT MEMBERSHIP (Rolle pro Turnier)
// ============================================

/**
 * TournamentMembership - Verbindung zwischen User und Turnier mit Rolle
 */
export interface TournamentMembership {
  /** UUID */
  id: string;
  /** FK → User.id */
  userId: string;
  /** FK → Tournament.id */
  tournamentId: string;
  /** Rolle in diesem Turnier */
  role: TournamentRole;
  /** Zugewiesene Teams (für Trainer) */
  teamIds: string[];
  /** FK → User.id (wer hat eingeladen) */
  invitedBy?: string;
  /** Einladungszeitpunkt (ISO 8601) */
  invitedAt?: string;
  /** Annahmezeitpunkt (ISO 8601, null = noch nicht angenommen) */
  acceptedAt?: string;
  /** Erstellungszeitpunkt (ISO 8601) */
  createdAt: string;
  /** Letztes Update (ISO 8601) */
  updatedAt: string;
}

// ============================================
// INVITATION (Einladungs-Token)
// ============================================

/**
 * Invitation - Token-basierte Einladung zu einem Turnier
 */
export interface Invitation {
  /** UUID */
  id: string;
  /** Unique Token (32 Zeichen, URL-safe) */
  token: string;
  /** FK → Tournament.id */
  tournamentId: string;
  /** Welche Rolle erhält der Eingeladene */
  role: TournamentRole;
  /** Vorab-Zuordnung für Trainer */
  teamIds: string[];
  /** Optional: Beschreibung (z.B. "Link für Trainer FC Rot") */
  label?: string;
  /** FK → User.id (Ersteller) */
  createdBy: string;
  /** Erstellungszeitpunkt (ISO 8601) */
  createdAt: string;
  /** Ablaufzeitpunkt (ISO 8601) */
  expiresAt: string;
  /** Maximale Verwendungen (0 = unbegrenzt) */
  maxUses: number;
  /** Anzahl bisheriger Verwendungen */
  useCount: number;
  /** FK → User.id[] (wer hat verwendet) */
  usedBy: string[];
  /** Aktiv-Status (kann deaktiviert werden) */
  isActive: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * localStorage Keys für Auth-Daten
 */
export const AUTH_STORAGE_KEYS = {
  CURRENT_USER: 'auth:currentUser',
  SESSION: 'auth:session',
  USERS: 'users',
  MEMBERSHIPS: 'tournamentMemberships',
  INVITATIONS: 'invitations',
  MIGRATION_PENDING: 'auth:migrationPending',
} as const;

/**
 * Session-Dauer in Millisekunden
 */
export const SESSION_DURATION = {
  /** 24 Stunden */
  DEFAULT: 24 * 60 * 60 * 1000,
  /** 30 Tage */
  REMEMBER_ME: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Einladungs-Gültigkeitsdauer in Millisekunden
 */
export const INVITATION_DURATION = {
  /** 24 Stunden */
  ONE_DAY: 24 * 60 * 60 * 1000,
  /** 7 Tage */
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  /** 30 Tage */
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  /** Kein Ablauf (1 Jahr) */
  NO_EXPIRY: 365 * 24 * 60 * 60 * 1000,
} as const;

// ============================================
// HELPER TYPES
// ============================================

/**
 * Connection state to Supabase Auth
 */
export type ConnectionState = 'connected' | 'connecting' | 'offline';

/**
 * Auth-State für Hooks
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  /**
   * True if user is a Supabase anonymous user.
   * Anonymous users can sync to cloud but haven't created credentials yet.
   */
  isAnonymous: boolean;
  isLoading: boolean;
  /** Connection state to Supabase - 'offline' means auth init timed out */
  connectionState: ConnectionState;
}

/**
 * Login-Result
 */
export interface LoginResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  /** Indicates local guest tournaments were migrated to cloud */
  wasMigrated?: boolean;
  /** Number of tournaments migrated */
  migratedCount?: number;
}

/**
 * Register-Result
 */
export interface RegisterResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  /** Indicates local guest tournaments were migrated to cloud */
  wasMigrated?: boolean;
  /** Number of tournaments migrated */
  migratedCount?: number;
}

/**
 * Invitation-Validation-Result
 */
export interface InvitationValidationResult {
  valid: boolean;
  invitation?: Invitation;
  tournament?: {
    id: string;
    name: string;
  };
  inviter?: {
    id: string;
    name: string;
  };
  error?: 'not_found' | 'expired' | 'max_uses_reached' | 'deactivated' | 'already_used';
}

// ============================================
// ROLE LABELS (i18n-Ready)
// ============================================

/**
 * Rollen-Bezeichnungen und Beschreibungen
 */
export const ROLE_LABELS: Record<TournamentRole, { label: string; description: string }> = {
  owner: {
    label: 'Ersteller',
    description: 'Volle Kontrolle über das Turnier',
  },
  'co-admin': {
    label: 'Stellvertreter',
    description: 'Kann das Turnier verwalten',
  },
  trainer: {
    label: 'Trainer',
    description: 'Verwaltet zugewiesene Teams',
  },
  collaborator: {
    label: 'Helfer',
    description: 'Kann Ergebnisse eingeben',
  },
  viewer: {
    label: 'Zuschauer',
    description: 'Kann nur ansehen',
  },
};

/**
 * Globale Rollen-Bezeichnungen
 */
export const GLOBAL_ROLE_LABELS: Record<GlobalRole, { label: string; description: string }> = {
  guest: {
    label: 'Gast',
    description: 'Nicht angemeldet, nur lokale Daten',
  },
  user: {
    label: 'Benutzer',
    description: 'Standard-Account',
  },
  admin: {
    label: 'Administrator',
    description: 'Globale Verwaltung',
  },
};
