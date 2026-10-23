/**
 * `kitFromEvents` (A-30a Schritt 2): TS-Gegenstück zum Server-Trigger `matches_kit_from_match_start`
 * (supabase/migrations/20261028_004_match_kit_colors.sql). Gerät und Monitor der Leitung zeigen damit ohne Netz
 * dieselbe getragene Farbe wie später die Spalten `kit_color_a/kit_color_b/bib_side`.
 *
 * Regeln wie der Trigger:
 * - nur MATCH_START; jeder gespeicherte MATCH_START, dessen `payload.kit` ein Objekt ist, setzt alle drei Werte neu
 *   (auch auf „keine Farbe“). Ein MATCH_START ohne kit-Objekt ändert nichts. Andere Ereignistypen ändern nichts.
 * - Farbe: Großbuchstaben, nur `#RRGGBB`, sonst keine Farbe; Leibchen-Seite nur `a`/`b`. Nie ein Abbruch.
 * Rein (keine Rechenfunktion, kein Zustand): liest nur den Log.
 */
import type { EngineEvent } from '../types';
import type { MatchKit } from '../../models/kit';

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

/** Getragene Farben aus dem jüngsten MATCH_START mit kit-Objekt; ohne solchen MATCH_START `undefined`. */
export function kitFromEvents(log: readonly EngineEvent[]): MatchKit | undefined {
  let kit: MatchKit | undefined;
  for (const event of log) {
    const raw: unknown = event.type === 'MATCH_START' ? event.payload.kit : undefined;
    if (!isKitObject(raw)) {
      continue;
    }
    const a = serverColor(raw.a);
    const b = serverColor(raw.b);
    const bibSide = raw.bibSide === 'a' || raw.bibSide === 'b' ? raw.bibSide : undefined;
    kit = { ...(a !== undefined && { a }), ...(b !== undefined && { b }), ...(bibSide !== undefined && { bibSide }) };
  }
  return kit;
}
