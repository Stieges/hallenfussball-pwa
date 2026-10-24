/**
 * Wahre Eckwerte eines Turniers für die Anzeige (@W5-038, C-ADMIN-DASHBOARD-ZAHLEN).
 *
 * Einstellungen, Feld-Management und Dashboard lesen die Werte aus derselben Funktion. Gespeicherte Werte
 * bleiben unverändert (Generator, Monitor und Helfer hängen daran); nur die Anzeige wird abgeleitet:
 * - „Jeder gegen jeden“ ist immer eine Gruppe, auch wenn `numberOfGroups` vom Anlegen 2 trägt (@OB-069).
 * - Fehlt die Feldliste, zählen die Felder, auf denen Spiele liegen, sonst `numberOfFields`.
 */
import { tournamentFieldList } from '../services/monitorConfigTransferChecks';
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
 * Felder des Turniers, eine Regel mit dem Monitor-Editor (`tournamentFieldList`): die gespeicherte Liste;
 * sonst field-1 … field-N mit N = größter Wert aus `numberOfFields` und dem höchsten Spielfeld
 * (ein Turnier ohne Anzahl, dessen Spiele auf Feld 1 liegen, hat Feld 1). Ohne beides keine Felder.
 */
export function effectiveFields(tournament: TournamentFactsInput): EffectiveField[] {
  const stored = tournament.fields ?? [];
  if (stored.length > 0) { return stored.map((field) => ({ ...field, stored: true })); }
  const highestUsed = Math.max(0, ...(tournament.matches ?? []).map((match) => (Number.isInteger(match.field) ? match.field : 0)));
  const count = Math.max(tournament.numberOfFields ?? 0, highestUsed);
  if (count < 1) { return []; }
  return tournamentFieldList({ numberOfFields: count }).map((field) => ({ ...field, stored: false }));
}

export function effectiveFieldCount(tournament: TournamentFactsInput): number {
  return effectiveFields(tournament).length;
}
