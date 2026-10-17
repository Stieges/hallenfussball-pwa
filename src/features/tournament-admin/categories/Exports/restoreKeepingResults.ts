/**
 * keepResultsOnRestore (A-08f3e4 Punkt 2): Sicherung wiederherstellen, ohne Ergebnisse von Spielen mit Einträgen zu
 * überschreiben (@FU-091, `plattform/2026-09-24_fundament-gemeinsamer-stand.md`). Spielplan- und Turnierdaten kommen wie
 * bisher aus der Sicherung; die server-geführten Spielfelder (Ergebnis, Status, Entscheidung, abgesetzt) bleiben beim
 * aktuellen Stand.
 *
 * F2 (Controller, Vorschlag gilt bis Widerspruch): Bei Konto-Turnieren stellt die Sicherung KEINE Ergebnisse wieder her --
 * ein Ergebnis ohne Eintrag kennt der Server nicht und spränge durch Regel S Stufe 2 nach ≤ 5 s zurück (Falle F4). Ein
 * Spiel, das es nur in der Sicherung gibt, kommt dort ohne Ergebnis. Gast: nur Spiele mit Einträgen behalten ihr Ergebnis.
 * Ist die Quelle der Einträge nicht lesbar, gilt das Konto-Verhalten (sichere Richtung).
 */
import type { Tournament } from '../../../../types/tournament';
import {
  SERVER_LED_MATCH_FIELDS,
  applyServerLedPatch,
  serverLedFieldsOf,
  type ServerLedMatchPatch,
} from '../../../../core/repositories/serverLedMatchFields';
import type { MatchEntryReading } from '../../../../hooks/useMatchEntryGuard';

/** Spiel ohne Ergebnis, geplant (für Spiele, die es nur in der Sicherung gibt). */
const NO_RESULT: ServerLedMatchPatch = {
  ...Object.fromEntries(SERVER_LED_MATCH_FIELDS.map((field) => [field, undefined])),
  matchStatus: 'scheduled',
};

export function keepResultsOnRestore(
  current: Tournament,
  restored: Tournament,
  entries: MatchEntryReading,
  isGuest: boolean,
): { restored: Tournament; keptCount: number } {
  const withEntries = new Set(entries.matches.map((match) => match.id));
  const keepAll = !isGuest || entries.unreadable;
  const currentById = new Map(current.matches.map((match) => [match.id, match]));
  const patch = new Map<string, ServerLedMatchPatch>();
  for (const match of restored.matches) {
    const now = currentById.get(match.id);
    if (now && (keepAll || withEntries.has(match.id))) {
      patch.set(match.id, serverLedFieldsOf(now));
    } else if (!now && keepAll) {
      patch.set(match.id, NO_RESULT);
    }
  }
  const keptCount = restored.matches.filter((match) => withEntries.has(match.id)).length;
  return { restored: { ...restored, matches: applyServerLedPatch(restored.matches, patch) }, keptCount };
}
