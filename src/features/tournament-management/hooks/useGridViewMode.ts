/**
 * useGridViewMode – darf der Spielplan die Rasteransicht anbieten? (@ZP-111)
 *
 * Ja nur ab 1280 Bildpunkten Fensterbreite (`breakpointValues.wide`) UND ab zwei Feldern; sonst gibt es keinen Umschalter
 * und immer die Liste. Die Breite folgt dem Fenster (Größe ändern, Drehen), damit ein Wechsel ohne Neuladen greift.
 */
import { useEffect, useState } from 'react';
import type { ScheduleViewMode } from '../components/ScheduleToolbar';
import { breakpointValues } from '../../../design-tokens/breakpoints';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export function useGridViewAllowed(numberOfFields: number): boolean {
  const { width } = useBreakpoint();
  return width >= breakpointValues.wide && numberOfFields >= 2;
}

/** Gewählte Ansicht samt Regel: ohne Raster-Erlaubnis immer „table“; fällt sie weg, springt die Wahl auf die Liste zurück. */
export function useGridViewMode(numberOfFields: number): { gridAllowed: boolean; viewMode: ScheduleViewMode; setViewMode: (mode: ScheduleViewMode) => void } {
  const gridAllowed = useGridViewAllowed(numberOfFields);
  const [chosen, setViewMode] = useState<ScheduleViewMode>('table');
  useEffect(() => { if (!gridAllowed) { setViewMode('table'); } }, [gridAllowed]);
  return { gridAllowed, viewMode: gridAllowed ? chosen : 'table', setViewMode };
}
