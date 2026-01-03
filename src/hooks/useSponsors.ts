/**
 * useSponsors Hook - Sponsoren-Verwaltung
 *
 * MON-KONF-01: Zentrale Sponsoren-Verwaltung (Single Source of Truth)
 *
 * Sponsoren werden im Tournament-Objekt gespeichert.
 * In Slides wird nur die sponsorId referenziert.
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-01
 */

import { useCallback, useMemo } from 'react';
import type { Tournament } from '../types/tournament';
import type { Sponsor, SponsorTier } from '../types/sponsor';
import { DEFAULT_SPONSOR } from '../types/sponsor';

// =============================================================================
// TYPES
// =============================================================================

export interface UseSponsorResult {
  /** Alle Sponsoren des Turniers */
  sponsors: Sponsor[];

  /** Sponsoren nach Tier gruppiert */
  sponsorsByTier: Record<SponsorTier, Sponsor[]>;

  /** Sponsor nach ID finden */
  getSponsorById: (id: string) => Sponsor | undefined;

  /** Neuen Sponsor hinzufügen */
  addSponsor: (sponsor: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Sponsor>;

  /** Sponsor aktualisieren */
  updateSponsor: (id: string, updates: Partial<Omit<Sponsor, 'id' | 'createdAt'>>) => Promise<Sponsor | undefined>;

  /** Sponsor löschen */
  deleteSponsor: (id: string) => Promise<DeleteSponsorResult>;

  /** Prüft ob Sponsor in Slides verwendet wird */
  isSponsorUsedInSlides: (id: string) => boolean;
}

export interface DeleteSponsorResult {
  success: boolean;
  wasUsedInSlides: boolean;
  affectedSlideCount: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generiert eine eindeutige Sponsor-ID
 */
function generateSponsorId(): string {
  return `sponsor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Findet alle Slides die einen bestimmten Sponsor referenzieren
 */
function findSlidesUsingSponsor(tournament: Tournament, sponsorId: string): number {
  let count = 0;

  const monitors = tournament.monitors ?? [];
  for (const monitor of monitors) {
    for (const slide of monitor.slides) {
      if (slide.type === 'sponsor' && slide.config.sponsorId === sponsorId) {
        count++;
      }
    }
  }

  return count;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook für Sponsoren-Verwaltung
 *
 * @param tournament - Das aktuelle Turnier
 * @param saveTournament - Callback zum Speichern des Turniers
 * @returns Sponsoren-API
 *
 * @example
 * const { sponsors, addSponsor, updateSponsor, deleteSponsor } = useSponsors(tournament, saveTournament);
 */
export function useSponsors(
  tournament: Tournament | null | undefined,
  saveTournament: (tournament: Tournament) => Promise<void>
): UseSponsorResult {
  // Sponsors aus Tournament (oder leeres Array)
  const sponsors = useMemo(
    () => tournament?.sponsors ?? [],
    [tournament?.sponsors]
  );

  // Sponsors nach Tier gruppiert
  const sponsorsByTier = useMemo(() => {
    const result: Record<SponsorTier, Sponsor[]> = {
      gold: [],
      silver: [],
      bronze: [],
    };

    for (const sponsor of sponsors) {
      const tier = sponsor.tier ?? 'bronze';
      result[tier].push(sponsor);
    }

    return result;
  }, [sponsors]);

  // Sponsor nach ID finden
  const getSponsorById = useCallback(
    (id: string) => sponsors.find(s => s.id === id),
    [sponsors]
  );

  // Prüft ob Sponsor in Slides verwendet wird
  const isSponsorUsedInSlides = useCallback(
    (id: string) => {
      if (!tournament) {return false;}
      return findSlidesUsingSponsor(tournament, id) > 0;
    },
    [tournament]
  );

  // Neuen Sponsor hinzufügen
  const addSponsor = useCallback(
    async (sponsorData: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const now = new Date().toISOString();
      const newSponsor: Sponsor = {
        ...DEFAULT_SPONSOR,
        ...sponsorData,
        id: generateSponsorId(),
        createdAt: now,
        updatedAt: now,
      };

      const updatedTournament: Tournament = {
        ...tournament,
        sponsors: [...sponsors, newSponsor],
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return newSponsor;
    },
    [tournament, sponsors, saveTournament]
  );

  // Sponsor aktualisieren
  const updateSponsor = useCallback(
    async (id: string, updates: Partial<Omit<Sponsor, 'id' | 'createdAt'>>): Promise<Sponsor | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const existingSponsor = sponsors.find(s => s.id === id);
      if (!existingSponsor) {
        console.warn(`Sponsor mit ID ${id} nicht gefunden`);
        return undefined;
      }

      const now = new Date().toISOString();
      const updatedSponsor: Sponsor = {
        ...existingSponsor,
        ...updates,
        id: existingSponsor.id, // ID kann nicht geändert werden
        createdAt: existingSponsor.createdAt, // createdAt bleibt gleich
        updatedAt: now,
      };

      const updatedSponsors = sponsors.map(s =>
        s.id === id ? updatedSponsor : s
      );

      const updatedTournament: Tournament = {
        ...tournament,
        sponsors: updatedSponsors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return updatedSponsor;
    },
    [tournament, sponsors, saveTournament]
  );

  // Sponsor löschen
  const deleteSponsor = useCallback(
    async (id: string): Promise<DeleteSponsorResult> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      // Prüfen ob Sponsor in Slides verwendet wird
      const affectedSlideCount = findSlidesUsingSponsor(tournament, id);
      const wasUsedInSlides = affectedSlideCount > 0;

      const now = new Date().toISOString();

      // Sponsor aus Liste entfernen
      const updatedSponsors = sponsors.filter(s => s.id !== id);

      // Wenn in Slides verwendet: sponsorId in betroffenen Slides auf undefined setzen
      let updatedMonitors = tournament.monitors ?? [];
      if (wasUsedInSlides) {
        updatedMonitors = updatedMonitors.map(monitor => ({
          ...monitor,
          slides: monitor.slides.map(slide => {
            if (slide.type === 'sponsor' && slide.config.sponsorId === id) {
              return {
                ...slide,
                config: {
                  ...slide.config,
                  sponsorId: undefined,
                },
              };
            }
            return slide;
          }),
        }));
      }

      const updatedTournament: Tournament = {
        ...tournament,
        sponsors: updatedSponsors,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);

      return {
        success: true,
        wasUsedInSlides,
        affectedSlideCount,
      };
    },
    [tournament, sponsors, saveTournament]
  );

  return {
    sponsors,
    sponsorsByTier,
    getSponsorById,
    addSponsor,
    updateSponsor,
    deleteSponsor,
    isSponsorUsedInSlides,
  };
}

export default useSponsors;
