/**
 * Leibchenfarben des Turniers und Regel „Bei gleicher Farbe zieht“ (@W3-029, @W3-041) im `tournaments.config`-JSON – keine eigene Spalte, keine
 * Migration. Bis zu zwei Hallenfarben (`bibColors`, in der Reihenfolge der Eintragung: die erste ist die erste Wahl) und die Regel `bibRule`
 * (`home` = die im Spielplan erstgenannte Mannschaft, Vorgabe; `away` = Gast). Das alte einzelne `bibColor` wird als erste Hallenfarbe gelesen und
 * bleibt als erste Farbe mitgeschrieben (ältere Stände lesen es noch). Schreiben und Lesen normalisieren auf `#RRGGBB`; Ungültiges entfällt.
 */
import { normalizeKitColor, MAX_HALLEN_FARBEN } from '../models/kit';
import type { Tournament } from '../../types/tournament';

type BibFields = Pick<Tournament, 'bibColor' | 'bibColors' | 'bibRule'>;

function cleanColors(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const out: string[] = [];
  for (const value of values) {
    const hex = normalizeKitColor(value);
    if (hex !== undefined && !out.includes(hex)) {
      out.push(hex);
    }
  }
  return out.slice(0, MAX_HALLEN_FARBEN);
}

function colorsOf(config: { bibColors?: unknown; bibColor?: unknown }): string[] {
  const list = cleanColors(config.bibColors);
  return list.length > 0 ? list : cleanColors([config.bibColor]);
}

/** Lesen aus `config` (beliebiges JSON). */
export function bibColorFromConfig(config: object): BibFields {
  const raw = config as { bibColors?: unknown; bibColor?: unknown; bibRule?: unknown };
  const colors = colorsOf(raw);
  return {
    ...(colors.length === 0 ? {} : { bibColor: colors[0], bibColors: colors }),
    ...(raw.bibRule === 'home' || raw.bibRule === 'away' ? { bibRule: raw.bibRule } : {}),
  };
}

/** Schreiben nach `config`: nur gültige Einstellungen, normalisiert. */
export function bibColorToConfig(tournament: BibFields): { bibColor?: string; bibColors?: string[]; bibRule?: 'home' | 'away' } {
  const colors = colorsOf(tournament);
  return {
    ...(colors.length === 0 ? {} : { bibColor: colors[0], bibColors: colors }),
    ...(tournament.bibRule === 'home' || tournament.bibRule === 'away' ? { bibRule: tournament.bibRule } : {}),
  };
}
