/**
 * Ziehen und Tauschen im Spielplan (Gruppenphase und Finalrunde, @ZP-100).
 *
 * - Reihenfolge der Liste = Uhrzeit, dann Feld, dann Spielnummer. Nach einem Tausch steht die Liste deshalb wieder nach
 *   Uhrzeit sortiert (kein `arrayMove`, das Spiele nur verschob, statt ihre Plätze zu tauschen).
 * - Am Handy: der Griff hat `touch-action: none` (sonst übernimmt der Browser die Geste zum Scrollen und bricht den Zug
 *   mit `pointercancel` ab). Das Mitscrollen am Rand ist gedrosselt, damit das Ziel nicht davonläuft.
 */
import { useCallback, useMemo, useState } from 'react';
import { PointerSensor, useSensor, useSensors, type AutoScrollOptions, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import type { ScheduledMatch } from '../../core/generators';

/** Mitscrollen beim Ziehen: langsamer als die Vorgabe (dort ≈ 2000 px/s am Handy), Randzone 15 % */
export const SCHEDULE_AUTO_SCROLL: AutoScrollOptions = { acceleration: 2, threshold: { x: 0, y: 0.15 } };

const startMs = (m: ScheduledMatch): number => new Date(m.startTime).getTime();

/** Spielplan-Reihenfolge der Anzeige: Uhrzeit, Feld, Spielnummer */
export function compareShownOrder(a: ScheduledMatch, b: ScheduledMatch): number {
  return startMs(a) - startMs(b) || a.field - b.field || a.matchNumber - b.matchNumber;
}

export function useScheduleDrag(matches: readonly ScheduledMatch[], onMatchSwap?: (matchId1: string, matchId2: string) => boolean) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const sortedMatches = useMemo(() => [...matches].sort(compareShownOrder), [matches]);

  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveId(String(event.active.id)); }, []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) { return; }
    // Tausch im Entwurf; `false` = abgelehnt (@ZP-093), dann bleibt die Anzeige stehen
    onMatchSwap?.(String(active.id), String(over.id));
  }, [onMatchSwap]);
  const handleDragCancel = useCallback(() => { setActiveId(null); }, []);

  const activeMatch = activeId ? sortedMatches.find((m) => m.id === activeId) ?? null : null;
  return { sensors, sortedMatches, activeMatch, handleDragStart, handleDragEnd, handleDragCancel };
}
