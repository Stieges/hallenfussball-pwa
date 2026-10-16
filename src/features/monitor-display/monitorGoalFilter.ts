/**
 * Tor-Einblendung nach Feld (B-16e1, @ZM-083). Ein Monitor mit Live-Folie auf einem Feld zeigt nur Tore
 * von Spielen dieses Felds; ohne Feldbindung (Übersicht, Eingang) gelten alle Tore.
 */
import type { GoalEventInfo } from '../../hooks/useLiveMatches';
import type { Match } from '../../types/tournament';
import type { MonitorSlide } from '../../types/monitor';
import { fieldIdToNumber } from './monitorDisplayHelpers';

/** Feldnummern der Live-Folien mit fieldId; leer = ungebunden. */
export function boundFieldNumbers(slides: readonly MonitorSlide[]): ReadonlySet<number> {
  const fields = new Set<number>();
  for (const slide of slides) {
    if (slide.type === 'live' && slide.config.fieldId) {
      fields.add(fieldIdToNumber(slide.config.fieldId));
    }
  }
  return fields;
}

/** Das Tor, wenn es zu einem gebundenen Feld gehört (oder der Monitor ungebunden ist); sonst null. */
export function visibleGoal(
  goal: GoalEventInfo | null,
  matches: readonly Match[] | undefined,
  boundFields: ReadonlySet<number>,
): GoalEventInfo | null {
  if (!goal || boundFields.size === 0) { return goal; }
  const match = matches?.find(m => m.id === goal.matchId);
  return match && boundFields.has(match.field) ? goal : null;
}
