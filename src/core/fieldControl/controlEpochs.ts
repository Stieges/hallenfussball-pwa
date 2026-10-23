/**
 * Steuer-Epoche beim Speichern eines Eintrags (B-49, Brief A-34 L7 „Epoche stempeln“, Review #341 A1).
 *
 * Der Server (A-34, `append_match_events` c3) prüft `controlEpoch` nur beim Halter: Ist sie gesetzt und ungleich der aktuellen
 * Epoche, lehnt er mit NOT_CONTROLLER/STALE_EPOCH ab; `null` zählt. Gestempelt wird deshalb nur, was dieses Gerät als
 * steuerndes Gerät mit bekannter Epoche erzeugt (`view === 'mine' ? epoch : null`):
 * - Ein Eintrag aus einer früheren Steuerzeit (offline erzeugt, inzwischen hat jemand übernommen und dieses Gerät wieder
 *   zurückgeholt) trägt die alte Epoche und wird nicht still angenommen (kein doppeltes Tor).
 * - Nach einem Anspruch per Anpfiff (Feld war frei, Epoche 0 → 1) tragen die Einträge bis zum nächsten Lesen `null` und werden
 *   angenommen – auch in einem späteren Stapel (mehr als 50 Einträge, verlorene Antwort).
 *
 * Quelle ist das Cockpit (`useCockpitFieldControl`), das für sein aktuelles Spiel die Epoche setzt; ohne Eintrag (Spielplan,
 * Gast, unbekannter Stand) bleibt `controlEpoch` weg. Zustand im Modul, je Spiel-ID.
 */
import type { EngineEvent } from '../match/types';

/** Ein Eintrag mit Steuer-Epoche, wie der Server ihn annimmt (`AppendableEvent.controlEpoch`). */
export type StampedEngineEvent = EngineEvent & { controlEpoch?: number | null };

const epochs = new Map<string, number>();

/** Epoche, mit der Einträge dieses Spiels gestempelt werden; `null` = nicht stempeln. */
export function setControlEpoch(matchId: string, epoch: number | null): void {
  if (epoch === null) {
    epochs.delete(matchId);
  } else {
    epochs.set(matchId, epoch);
  }
}

export function controlEpochFor(matchId: string): number | null {
  return epochs.get(matchId) ?? null;
}

/** Stempelt die Einträge eines Befehls beim Speichern (nur mit bekannter eigener Epoche). */
export function withControlEpoch(matchId: string, events: readonly EngineEvent[]): readonly StampedEngineEvent[] {
  const epoch = controlEpochFor(matchId);
  return epoch === null ? events : events.map((event): StampedEngineEvent => ({ ...event, controlEpoch: epoch }));
}

/** Nur für Tests. */
export function resetControlEpochsForTests(): void {
  epochs.clear();
}
