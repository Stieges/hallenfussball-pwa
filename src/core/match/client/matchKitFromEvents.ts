/**
 * `kitFromEvents` (A-30a Schritt 2) und die Projektion der Leibchen-Wahl (Leibchen 2b): TS-Gegenstück zum Server-Trigger
 * `matches_kit_from_match_start` (Fassung 20261124_002_leibchen_schritt2.sql). Gerät und Monitor der Leitung zeigen damit ohne Netz
 * dieselbe getragene Farbe wie später die Spalten `kit_color_a/kit_color_b/bib_side/kit_decision`.
 *
 * Regeln wie der Trigger:
 * - nur MATCH_START; jeder MATCH_START, dessen `payload.kit` ein Objekt ist, setzt die Werte neu. Ein MATCH_START ohne kit-Objekt ändert nichts.
 *   Andere Ereignistypen ändern nichts.
 * - Farbe: Großbuchstaben, nur `#RRGGBB`, sonst keine Farbe; Leibchen-Seite nur `a`/`b`. Nie ein Abbruch.
 * - Wahl (`decision`): mit Leibchen-Seite `bib`; ausdrücklich `bibSide: null` → `none`; sonst bleibt sie, wie sie war (@SL-210).
 * - Behalte-Regel (@SL-216, @SL-220): war die Wahl schon `bib` und der Anpfiff nennt nichts zum Leibchen, bleiben Seite und Leibchenfarbe stehen,
 *   die andere Seite bekommt die Trikotfarbe des Anpfiffs.
 * Rein (keine Rechenfunktion, kein Zustand): liest nur den Log.
 */
import type { EngineEvent } from '../types';
import type { KitDecision, MatchKit } from '../../models/kit';

const SERVER_HEX = /^#[0-9A-F]{6}$/;

/** Wie `upper(v_kit ->> 'a')` + Formprüfung im Trigger (Zahlen/Wahrheitswerte werden Text und fallen durch). */
function serverColor(value: unknown): string | undefined {
  if (value === null || value === undefined || typeof value === 'object') {
    return undefined;
  }
  const upper = String(value).toUpperCase();
  return SERVER_HEX.test(upper) ? upper : undefined;
}

function isKitObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Ein Anpfiff mit `kit`-Objekt, gelesen wie der Trigger: Farben und Seite geprüft, `none` = ausdrücklich `bibSide: null`. */
export interface KitStart {
  a: string | undefined;
  b: string | undefined;
  bibSide: 'a' | 'b' | undefined;
  none: boolean;
  /** Der Server hat den Anpfiff schon bestätigt (Teil des bestätigten Logs): seine Zeile gilt dann. */
  confirmed: boolean;
}

/** Stand der Wahl am Spiel: wie die Spalten (`kit` = getragene Farben + Leibchen-Seite, `decision` = `kit_decision`). */
export interface KitState {
  kit?: MatchKit;
  decision?: KitDecision;
}

/** Alle Anpfiffe mit kit-Objekt in Reihenfolge; `confirmedCount` = Länge des bestätigten Anfangs des Logs (`MatchEngineView.confirmedCount`). */
export function kitStartsOf(log: readonly EngineEvent[], confirmedCount = 0): KitStart[] {
  const starts: KitStart[] = [];
  log.forEach((event, index) => {
    const raw: unknown = event.type === 'MATCH_START' ? event.payload.kit : undefined;
    if (!isKitObject(raw)) {
      return;
    }
    const side = raw.bibSide;
    starts.push({
      a: serverColor(raw.a),
      b: serverColor(raw.b),
      bibSide: side === 'a' || side === 'b' ? side : undefined,
      none: 'bibSide' in raw && side === null,
      confirmed: index < confirmedCount,
    });
  });
  return starts;
}

function compact(a: string | undefined, b: string | undefined, bibSide: 'a' | 'b' | undefined): MatchKit {
  return { ...(a !== undefined && { a }), ...(b !== undefined && { b }), ...(bibSide !== undefined && { bibSide }) };
}

/** Ein Anpfiff auf einen Stand, wie `matches_kit_from_match_start` ihn auf die Zeile anwendet. */
function applyStart(state: KitState, start: KitStart): KitState {
  const keep = state.decision === 'bib' && start.bibSide === undefined && !start.none;
  const old = state.kit;
  const a = keep && old?.bibSide === 'a' ? old.a : start.a;
  const b = keep && old?.bibSide === 'b' ? old.b : start.b;
  const bibSide = keep ? old?.bibSide : start.bibSide;
  const decision: KitDecision | undefined = start.bibSide !== undefined || keep ? 'bib' : start.none ? 'none' : state.decision;
  return { kit: compact(a, b, bibSide), ...(decision === undefined ? {} : { decision }) };
}

/** Die Anpfiffe der Reihe nach auf einen Stand. */
export function foldKitStarts(state: KitState, starts: readonly KitStart[]): KitState {
  return starts.reduce(applyStart, state);
}

/** Getragene Farben aus dem jüngsten MATCH_START mit kit-Objekt; ohne solchen MATCH_START `undefined`. */
export function kitFromEvents(log: readonly EngineEvent[]): MatchKit | undefined {
  const starts = kitStartsOf(log);
  return starts.length === 0 ? undefined : foldKitStarts({}, starts).kit;
}

/**
 * Stand der Wahl am Spiel mit den Anpfiffen des eigenen Logs (Behalte-Regel wie in der Server-Projektion, C-KIT-OVERLAY-UEBERSCHREIBT-VOR-ANPFIFF):
 * - kein Anpfiff mit kit-Objekt: der Stand der Zeile bleibt, wie er ist (eine vor dem Anpfiff bestätigte Wahl geht nicht verloren, @SL-216);
 * - vom Server bestätigte Anpfiffe: die Zeile gilt (ein Nachtrag im laufenden Spiel, @SL-150, bleibt sichtbar); nur was ihr noch fehlt,
 *   ergänzt der Anpfiff – damit die Anzeige zwischen „bestätigt“ und der nächsten Zeile nicht flackert;
 * - noch nicht bestätigte Anpfiffe: wirken auf den Stand wie der Trigger später am Server (Anpfiff ohne Netz).
 */
export function projectKitState(row: KitState, starts: readonly KitStart[]): KitState {
  if (starts.length === 0) {
    return row;
  }
  const confirmed = foldKitStarts(row, starts.filter((start) => start.confirmed));
  const decided = row.decision !== undefined;
  const rowKit = row.kit;
  const afterConfirmed: KitState = {
    kit: compact(rowKit?.a ?? confirmed.kit?.a, rowKit?.b ?? confirmed.kit?.b, decided ? rowKit?.bibSide : confirmed.kit?.bibSide),
    ...((row.decision ?? confirmed.decision) === undefined ? {} : { decision: row.decision ?? confirmed.decision }),
  };
  return foldKitStarts(afterConfirmed, starts.filter((start) => !start.confirmed));
}
