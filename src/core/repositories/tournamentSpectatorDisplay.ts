/**
 * Einstellung „Anzeige für Zuschauer“ (Spielanzeige 2.1, @ZM-152) im `tournaments.config`-JSON – keine eigene Spalte,
 * keine Migration. Lesen und Schreiben normalisieren je Schlüssel (`parseSpectatorDisplay`, RF1); ohne Eintrag bleibt
 * das Feld leer und die Ansicht nimmt die Vorbelegung. Ausgelagert, damit `supabaseMappers.ts` nicht wächst (R-SA1).
 */
import { parseSpectatorDisplay, type SpectatorDisplaySettings } from '../models/spectatorDisplay';
import type { Tournament } from '../../types/tournament';

/** Lesen aus `config` (beliebiges JSON): Eintrag vorhanden → `{ spectatorDisplay }` (je Schlüssel repariert), sonst `{}`. */
export function spectatorDisplayFromConfig(config: object): Pick<Tournament, 'spectatorDisplay'> {
  const raw = (config as { spectatorDisplay?: unknown }).spectatorDisplay;
  return raw === undefined || raw === null ? {} : { spectatorDisplay: parseSpectatorDisplay(raw) };
}

/** Schreiben nach `config`: nur eine gesetzte Einstellung, normalisiert. */
export function spectatorDisplayToConfig(tournament: Pick<Tournament, 'spectatorDisplay'>): { spectatorDisplay?: SpectatorDisplaySettings } {
  return tournament.spectatorDisplay === undefined ? {} : { spectatorDisplay: parseSpectatorDisplay(tournament.spectatorDisplay) };
}
