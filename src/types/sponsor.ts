/**
 * Sponsor Types - Zentrales Sponsoren-Management
 *
 * MON-KONF-01: Sponsoren werden zentral verwaltet (Single Source of Truth).
 * In Monitor-Slides wird nur die sponsorId referenziert, keine Inline-Daten.
 *
 * @see MONITOR-KONFIGURATOR-KONZEPT-v2.md Kapitel 4
 */

// =============================================================================
// SPONSOR TYPES
// =============================================================================

/**
 * Sponsor Tier für Kategorisierung und Anzeige-Priorisierung
 */
export type SponsorTier = 'gold' | 'silver' | 'bronze';

/**
 * Sponsor - Zentrale Sponsoren-Definition
 *
 * Phase 1: Logo als Base64 (logoBase64)
 * Phase 3+: Logo als Supabase Storage URL (logoUrl)
 */
export interface Sponsor {
  id: string;
  name: string;

  // Logo - Phase 1: Base64, Phase 3+: Supabase Storage URL
  logoBase64?: string;           // Base64-encoded Logo (max 500KB, resized to 500x500)
  logoUrl?: string;              // URL zum Logo (Phase 3+, Supabase Storage)

  // Optional fields
  websiteUrl?: string;           // Ziel für QR-Code
  tier?: SponsorTier;            // Gold / Silber / Bronze

  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

// =============================================================================
// SPONSOR DEFAULTS
// =============================================================================

/**
 * Default values for new sponsors
 */
export const DEFAULT_SPONSOR: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  tier: 'bronze',
};

/**
 * Logo upload constraints
 */
export const SPONSOR_LOGO_CONSTRAINTS = {
  maxFileSizeBytes: 500 * 1024,  // 500KB
  maxDimension: 500,              // 500x500 pixels
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
} as const;
