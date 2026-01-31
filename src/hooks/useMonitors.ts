/**
 * useMonitors Hook - Monitor-Konfigurator Verwaltung
 *
 * MON-KONF-01: Ermöglicht die Konfiguration beliebig vieler Display-Setups
 * mit individuellen Diashows aus verschiedenen Slide-Typen.
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P1-03
 */

import { useCallback, useMemo } from 'react';
import type { Tournament } from '../types/tournament';
import type {
  TournamentMonitor,
  MonitorSlide,
  SlideType,
  SlideConfig,
  TransitionType,
  PerformanceMode,
} from '../types/monitor';
import { DEFAULT_MONITOR, DEFAULT_SLIDE_CONFIG } from '../types/monitor';

// =============================================================================
// TYPES
// =============================================================================

export interface UseMonitorsResult {
  /** Alle Monitore des Turniers */
  monitors: TournamentMonitor[];

  /** Monitor nach ID finden */
  getMonitorById: (id: string) => TournamentMonitor | undefined;

  /** Neuen Monitor erstellen */
  createMonitor: (name: string, options?: Partial<CreateMonitorOptions>) => Promise<TournamentMonitor>;

  /** Monitor aktualisieren */
  updateMonitor: (id: string, updates: Partial<MonitorUpdate>) => Promise<TournamentMonitor | undefined>;

  /** Monitor löschen */
  deleteMonitor: (id: string) => Promise<boolean>;

  /** Monitor duplizieren */
  duplicateMonitor: (id: string, newName?: string) => Promise<TournamentMonitor | undefined>;

  /** Slide zu Monitor hinzufügen */
  addSlide: (monitorId: string, slideType: SlideType, config?: Partial<SlideConfig>) => Promise<MonitorSlide | undefined>;

  /** Slide aktualisieren */
  updateSlide: (monitorId: string, slideId: string, updates: Partial<SlideUpdate>) => Promise<MonitorSlide | undefined>;

  /** Slide entfernen */
  removeSlide: (monitorId: string, slideId: string) => Promise<boolean>;

  /** Slide-Reihenfolge ändern */
  reorderSlides: (monitorId: string, slideIds: string[]) => Promise<boolean>;

  /** Display-URL für einen Monitor generieren */
  getDisplayUrl: (monitorId: string) => string;
}

export interface CreateMonitorOptions {
  defaultSlideDuration: number;
  transition: TransitionType;
  transitionDuration: number;
  performanceMode: PerformanceMode;
}

export interface MonitorUpdate {
  name: string;
  defaultSlideDuration: number;
  transition: TransitionType;
  transitionDuration: number;
  performanceMode: PerformanceMode;
  overscanPx?: number;
  templateId?: string;
  templateVariables?: Record<string, string>;
}

export interface SlideUpdate {
  type: SlideType;
  config: SlideConfig;
  duration: number | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generiert eine eindeutige ID mit crypto.randomUUID() oder Fallback
 */
function generateUniqueId(): string {
  // Use crypto.randomUUID if available
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Generiert eine eindeutige Monitor-ID
 */
function generateMonitorId(): string {
  return `mon-${generateUniqueId()}`;
}

/**
 * Generiert eine eindeutige Slide-ID
 */
function generateSlideId(): string {
  return `slide-${generateUniqueId().substring(0, 12)}`;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook für Monitor-Konfigurator Verwaltung
 *
 * @param tournament - Das aktuelle Turnier
 * @param saveTournament - Callback zum Speichern des Turniers
 * @returns Monitors-API
 *
 * @example
 * const { monitors, createMonitor, addSlide, updateMonitor } = useMonitors(tournament, saveTournament);
 */
export function useMonitors(
  tournament: Tournament | null | undefined,
  saveTournament: (tournament: Tournament) => Promise<void>
): UseMonitorsResult {
  // Monitors aus Tournament (oder leeres Array)
  const monitors = useMemo(
    () => tournament?.monitors ?? [],
    [tournament?.monitors]
  );

  // Monitor nach ID finden
  const getMonitorById = useCallback(
    (id: string) => monitors.find(m => m.id === id),
    [monitors]
  );

  // Display-URL generieren
  // HashRouter requires /#/ prefix for all routes
  const getDisplayUrl = useCallback(
    (monitorId: string): string => {
      if (!tournament) {return '#';}
      return `/#/display/${tournament.id}/${monitorId}`;
    },
    [tournament]
  );

  // Neuen Monitor erstellen
  const createMonitor = useCallback(
    async (name: string, options?: Partial<CreateMonitorOptions>): Promise<TournamentMonitor> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const now = new Date().toISOString();
      const newMonitor: TournamentMonitor = {
        ...DEFAULT_MONITOR,
        id: generateMonitorId(),
        name: name.trim() || 'Neuer Monitor',
        defaultSlideDuration: options?.defaultSlideDuration ?? DEFAULT_MONITOR.defaultSlideDuration,
        transition: options?.transition ?? DEFAULT_MONITOR.transition,
        transitionDuration: options?.transitionDuration ?? DEFAULT_MONITOR.transitionDuration,
        performanceMode: options?.performanceMode ?? DEFAULT_MONITOR.performanceMode,
        slides: [],
        createdAt: now,
        updatedAt: now,
      };

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: [...monitors, newMonitor],
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return newMonitor;
    },
    [tournament, monitors, saveTournament]
  );

  // Monitor aktualisieren
  const updateMonitor = useCallback(
    async (id: string, updates: Partial<MonitorUpdate>): Promise<TournamentMonitor | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const existingMonitor = monitors.find(m => m.id === id);
      if (!existingMonitor) {
        console.warn(`Monitor mit ID ${id} nicht gefunden`);
        return undefined;
      }

      const now = new Date().toISOString();
      const updatedMonitor: TournamentMonitor = {
        ...existingMonitor,
        name: updates.name !== undefined ? updates.name.trim() : existingMonitor.name,
        defaultSlideDuration: updates.defaultSlideDuration ?? existingMonitor.defaultSlideDuration,
        transition: updates.transition ?? existingMonitor.transition,
        transitionDuration: updates.transitionDuration ?? existingMonitor.transitionDuration,
        performanceMode: updates.performanceMode ?? existingMonitor.performanceMode,
        overscanPx: updates.overscanPx ?? existingMonitor.overscanPx,
        templateId: updates.templateId ?? existingMonitor.templateId,
        templateVariables: updates.templateVariables ?? existingMonitor.templateVariables,
        updatedAt: now,
      };

      const updatedMonitors = monitors.map(m =>
        m.id === id ? updatedMonitor : m
      );

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return updatedMonitor;
    },
    [tournament, monitors, saveTournament]
  );

  // Monitor löschen
  const deleteMonitor = useCallback(
    async (id: string): Promise<boolean> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const updatedMonitors = monitors.filter(m => m.id !== id);

      if (updatedMonitors.length === monitors.length) {
        // Nichts gelöscht
        return false;
      }

      const now = new Date().toISOString();
      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return true;
    },
    [tournament, monitors, saveTournament]
  );

  // Monitor duplizieren
  const duplicateMonitor = useCallback(
    async (id: string, newName?: string): Promise<TournamentMonitor | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const sourceMonitor = monitors.find(m => m.id === id);
      if (!sourceMonitor) {
        console.warn(`Monitor mit ID ${id} nicht gefunden`);
        return undefined;
      }

      const now = new Date().toISOString();
      const duplicatedMonitor: TournamentMonitor = {
        ...sourceMonitor,
        id: generateMonitorId(),
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty trimmed name should use fallback
        name: newName?.trim() || `${sourceMonitor.name} (Kopie)`,
        slides: sourceMonitor.slides.map(slide => ({
          ...slide,
          id: generateSlideId(),
        })),
        createdAt: now,
        updatedAt: now,
      };

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: [...monitors, duplicatedMonitor],
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return duplicatedMonitor;
    },
    [tournament, monitors, saveTournament]
  );

  // Slide zu Monitor hinzufügen
  const addSlide = useCallback(
    async (
      monitorId: string,
      slideType: SlideType,
      config?: Partial<SlideConfig>
    ): Promise<MonitorSlide | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) {
        console.warn(`Monitor mit ID ${monitorId} nicht gefunden`);
        return undefined;
      }

      const newSlide: MonitorSlide = {
        id: generateSlideId(),
        type: slideType,
        config: {
          ...DEFAULT_SLIDE_CONFIG,
          ...config,
        },
        duration: null, // Verwendet Monitor-Default
        order: monitor.slides.length,
      };

      const now = new Date().toISOString();
      const updatedMonitor: TournamentMonitor = {
        ...monitor,
        slides: [...monitor.slides, newSlide],
        updatedAt: now,
      };

      const updatedMonitors = monitors.map(m =>
        m.id === monitorId ? updatedMonitor : m
      );

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return newSlide;
    },
    [tournament, monitors, saveTournament]
  );

  // Slide aktualisieren
  const updateSlide = useCallback(
    async (
      monitorId: string,
      slideId: string,
      updates: Partial<SlideUpdate>
    ): Promise<MonitorSlide | undefined> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) {
        console.warn(`Monitor mit ID ${monitorId} nicht gefunden`);
        return undefined;
      }

      const slideIndex = monitor.slides.findIndex(s => s.id === slideId);
      if (slideIndex === -1) {
        console.warn(`Slide mit ID ${slideId} nicht gefunden`);
        return undefined;
      }

      const existingSlide = monitor.slides[slideIndex];
      const updatedSlide: MonitorSlide = {
        ...existingSlide,
        type: updates.type ?? existingSlide.type,
        config: updates.config !== undefined
          ? { ...existingSlide.config, ...updates.config }
          : existingSlide.config,
        duration: updates.duration !== undefined ? updates.duration : existingSlide.duration,
      };

      const now = new Date().toISOString();
      const updatedSlides = [...monitor.slides];
      updatedSlides[slideIndex] = updatedSlide;

      const updatedMonitor: TournamentMonitor = {
        ...monitor,
        slides: updatedSlides,
        updatedAt: now,
      };

      const updatedMonitors = monitors.map(m =>
        m.id === monitorId ? updatedMonitor : m
      );

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return updatedSlide;
    },
    [tournament, monitors, saveTournament]
  );

  // Slide entfernen
  const removeSlide = useCallback(
    async (monitorId: string, slideId: string): Promise<boolean> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) {
        console.warn(`Monitor mit ID ${monitorId} nicht gefunden`);
        return false;
      }

      const updatedSlides = monitor.slides
        .filter(s => s.id !== slideId)
        .map((s, idx) => ({ ...s, order: idx })); // Reorder

      if (updatedSlides.length === monitor.slides.length) {
        return false; // Nichts entfernt
      }

      const now = new Date().toISOString();
      const updatedMonitor: TournamentMonitor = {
        ...monitor,
        slides: updatedSlides,
        updatedAt: now,
      };

      const updatedMonitors = monitors.map(m =>
        m.id === monitorId ? updatedMonitor : m
      );

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return true;
    },
    [tournament, monitors, saveTournament]
  );

  // Slide-Reihenfolge ändern
  const reorderSlides = useCallback(
    async (monitorId: string, slideIds: string[]): Promise<boolean> => {
      if (!tournament) {
        throw new Error('Kein Turnier ausgewählt');
      }

      const monitor = monitors.find(m => m.id === monitorId);
      if (!monitor) {
        console.warn(`Monitor mit ID ${monitorId} nicht gefunden`);
        return false;
      }

      // Erstelle Map von id -> slide
      const slideMap = new Map(monitor.slides.map(s => [s.id, s]));

      // Sortiere nach neuer Reihenfolge
      const reorderedSlides = slideIds
        .map(id => slideMap.get(id))
        .filter((s): s is MonitorSlide => s !== undefined)
        .map((s, idx) => ({ ...s, order: idx }));

      if (reorderedSlides.length !== monitor.slides.length) {
        console.warn('Ungültige Slide-IDs beim Umordnen');
        return false;
      }

      const now = new Date().toISOString();
      const updatedMonitor: TournamentMonitor = {
        ...monitor,
        slides: reorderedSlides,
        updatedAt: now,
      };

      const updatedMonitors = monitors.map(m =>
        m.id === monitorId ? updatedMonitor : m
      );

      const updatedTournament: Tournament = {
        ...tournament,
        monitors: updatedMonitors,
        updatedAt: now,
      };

      await saveTournament(updatedTournament);
      return true;
    },
    [tournament, monitors, saveTournament]
  );

  return {
    monitors,
    getMonitorById,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    duplicateMonitor,
    addSlide,
    updateSlide,
    removeSlide,
    reorderSlides,
    getDisplayUrl,
  };
}

export default useMonitors;
