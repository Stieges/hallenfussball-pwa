/**
 * Leibchenfarbe des Turniers (A-30a Fixrunde 1, Review B2, @W3-029) im `tournaments.config`-JSON – keine eigene
 * Spalte, keine Migration. Schreiben und Lesen normalisieren auf `#RRGGBB`; ein ungültiger Wert wird weggelassen
 * (dann gilt die Vorgabe Gelb, `DEFAULT_BIB_COLOR`). Ausgelagert, damit `supabaseMappers.ts` nicht wächst.
 */
import { normalizeKitColor } from '../models/kit';
import type { Tournament } from '../../types/tournament';

/** Lesen aus `config` (beliebiges JSON): gültige Farbe → `{ bibColor }`, sonst `{}`. */
export function bibColorFromConfig(config: object): Pick<Tournament, 'bibColor'> {
  const bibColor = normalizeKitColor((config as { bibColor?: unknown }).bibColor);
  return bibColor === undefined ? {} : { bibColor };
}

/** Schreiben nach `config`: nur eine gültige Einstellung, normalisiert. */
export function bibColorToConfig(tournament: Pick<Tournament, 'bibColor'>): { bibColor?: string } {
  const bibColor = normalizeKitColor(tournament.bibColor);
  return bibColor === undefined ? {} : { bibColor };
}
