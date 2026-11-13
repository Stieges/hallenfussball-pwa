/**
 * AdminCategoryContent - wählt die Kategorie des Admin Centers (aus TournamentAdminCenter herausgelöst, H4-8, Verhalten gleich).
 *
 * Zuständigkeit: Kategorie-ID → lazy geladene Kategorie. Layout, Navigation und Daten bleiben im Admin Center.
 */

import { lazy } from 'react';
import type { MatchUpdate } from '../../../core/models/types';
import type { Tournament } from '../../../types/tournament';
import type { AdminCategoryId } from '../types/admin.types';

// =============================================================================
// LAZY LOADED CATEGORIES
// =============================================================================

// Dashboard
const DashboardCategory = lazy(() =>
  import('../categories/Dashboard').then((m) => ({ default: m.DashboardCategory }))
);

// Management
const ActivityLogCategory = lazy(() =>
  import('../categories/ActivityLog').then((m) => ({ default: m.ActivityLogCategory }))
);
const ExportsCategory = lazy(() =>
  import('../categories/Exports').then((m) => ({ default: m.ExportsCategory }))
);
const TeamHelpersCategory = lazy(() =>
  import('../categories/TeamHelpers').then((m) => ({ default: m.TeamHelpersCategory }))
);
const SponsorsCategory = lazy(() =>
  import('../categories/Sponsors').then((m) => ({ default: m.SponsorsCategory }))
);

// Settings
const SettingsCategory = lazy(() =>
  import('../categories/Settings').then((m) => ({ default: m.SettingsCategory }))
);
const MatchCockpitCategory = lazy(() =>
  import('../categories/MatchCockpit').then((m) => ({ default: m.MatchCockpitCategory }))
);
const VisibilityCategory = lazy(() =>
  import('../categories/Visibility').then((m) => ({ default: m.VisibilityCategory }))
);
const MetadataCategory = lazy(() =>
  import('../categories/Metadata').then((m) => ({ default: m.MetadataCategory }))
);

// Danger Zone
const DangerZoneCategory = lazy(() =>
  import('../categories/DangerZone').then((m) => ({ default: m.DangerZoneCategory }))
);

// =============================================================================
// PROPS + COMPONENT
// =============================================================================

export interface AdminCategoryContentProps {
  category: AdminCategoryId;
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
  /** A2 Fixrunde 1: DangerZone und Exports brauchen diese beiden für den Ergebnis-/Status-Pfad. */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
  onReload: () => void;
}

export function AdminCategoryContent({ category, ...categoryProps }: AdminCategoryContentProps) {
  switch (category) {
    case 'dashboard':
      return <DashboardCategory {...categoryProps} />;
    case 'activity-log':
      return <ActivityLogCategory {...categoryProps} />;
    case 'exports':
      return <ExportsCategory {...categoryProps} />;
    // @OB-005: „Team & Helfer" bleibt vorbereitet — sichtbar erst mit dem Einstieg per QR-Code.
    case 'team-helpers':
      return <TeamHelpersCategory {...categoryProps} />;
    case 'sponsors':
      return <SponsorsCategory {...categoryProps} />;
    case 'settings':
      return <SettingsCategory {...categoryProps} />;
    case 'match-cockpit':
      return <MatchCockpitCategory {...categoryProps} />;
    case 'visibility':
      return <VisibilityCategory {...categoryProps} />;
    case 'metadata':
      return <MetadataCategory {...categoryProps} />;
    case 'danger-zone':
      return <DangerZoneCategory {...categoryProps} />;
    default:
      return <DashboardCategory {...categoryProps} />;
  }
}
