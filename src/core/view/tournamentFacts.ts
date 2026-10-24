/**
 * Wahre Eckwerte eines Turniers für die Anzeige (@W5-038, C-ADMIN-DASHBOARD-ZAHLEN).
 *
 * Einstellungen, Feld-Management und Dashboard lesen die Werte aus derselben Funktion. Gespeicherte Werte
 * bleiben unverändert (Generator, Monitor und Helfer hängen daran); nur die Anzeige wird abgeleitet:
 * - „Jeder gegen jeden“ ist immer eine Gruppe, auch wenn `numberOfGroups` vom Anlegen 2 trägt (@OB-069).
 * - Fehlt die Feldliste, zählen die Felder, auf denen Spiele liegen, sonst `numberOfFields`.
 */
import type { Match, Tournament, TournamentField } from '../../types/tournament';

export interface TournamentFactsInput {
  groupSystem?: Tournament['groupSystem'];
  numberOfGroups?: number;
  numberOfFields?: number;
  fields?: readonly TournamentField[];
  matches?: ReadonlyArray<Pick<Match, 'field'>>;
}

/** Anzahl Gruppen, wie sie das Turnier wirklich spielt. */
export function effectiveGroupCount(tournament: Pick<TournamentFactsInput, 'groupSystem' | 'numberOfGroups'>): number {
  if (tournament.groupSystem === 'roundRobin') { return 1; }
  return tournament.numberOfGroups ?? 1;
}

/** Eine Feldzeile der Anzeige. `stored` heißt: gehört zur gespeicherten Feldliste (bearbeitbar). */
export interface EffectiveField {
  id: string;
  defaultName: string;
  customName?: string;
  shortCode?: string;
  stored: boolean;
}

/**
 * Felder des Turniers: die gespeicherte Liste; ohne sie die Felder, auf denen Spiele liegen
 * (Feld 1 bei einem Turnier ohne Feldliste); ohne Spiele `numberOfFields` Felder.
 */
export function effectiveFields(tournament: TournamentFactsInput): EffectiveField[] {
  const stored = tournament.fields ?? [];
  if (stored.length > 0) { return stored.map((field) => ({ ...field, stored: true })); }
  const used = [...new Set((tournament.matches ?? []).map((match) => match.field).filter((n) => Number.isInteger(n) && n > 0))]
    .sort((a, b) => a - b);
  const numbers = used.length > 0
    ? used
    : Array.from({ length: Math.max(0, tournament.numberOfFields ?? 0) }, (_, i) => i + 1);
  return numbers.map((n) => ({ id: `field-${n}`, defaultName: `Feld ${n}`, stored: false }));
}

export function effectiveFieldCount(tournament: TournamentFactsInput): number {
  return effectiveFields(tournament).length;
}
