/**
 * Zeilen des Blocks „Nicht änderbare Einstellungen“ (@W5-038): Werte des Turniers, Begriffe übersetzt
 * (nie „classic“ roh). Gruppen und Felder kommen aus der gemeinsamen Ableitung in core/view.
 */
import { effectiveFieldCount, effectiveGroupCount } from '../../core/view';
import type { MatchStartState } from '../../utils/matchStartState';
import type { Tournament } from '../../types/tournament';

const P = 'settings.immutableSettings';

/** Übersetzungsschlüssel der Anzeigebegriffe (Spielsystem, Spielmodus, Turniertyp). */
export const IMMUTABLE_VALUE_KEYS = {
  roundRobin: `${P}.values.roundRobin`,
  groupsAndFinals: `${P}.values.groupsAndFinals`,
  classic: `${P}.values.classic`,
  miniFussball: `${P}.values.miniFussball`,
  bambini: `${P}.values.bambini`,
} as const;
export type ImmutableValueKey = (typeof IMMUTABLE_VALUE_KEYS)[keyof typeof IMMUTABLE_VALUE_KEYS];

export interface ImmutableFact {
  key: string;
  labelKey:
    | 'settings.immutableSettings.numberOfTeams'
    | 'settings.immutableSettings.numberOfGroups'
    | 'settings.immutableSettings.numberOfFields'
    | 'settings.immutableSettings.groupSystem'
    | 'settings.immutableSettings.gameMode'
    | 'settings.immutableSettings.tournamentType';
  params: Record<string, string | number>;
}

/** `word` übersetzt einen Begriffs-Schlüssel in den Anzeigebegriff. */
export function immutableFacts(tournament: Tournament, word: (key: ImmutableValueKey) => string): ImmutableFact[] {
  const facts: ImmutableFact[] = [
    { key: 'teams', labelKey: `${P}.numberOfTeams`, params: { count: tournament.numberOfTeams } },
    { key: 'groups', labelKey: `${P}.numberOfGroups`, params: { count: effectiveGroupCount(tournament) } },
    { key: 'fields', labelKey: `${P}.numberOfFields`, params: { count: effectiveFieldCount(tournament) } },
  ];
  if (tournament.groupSystem) {
    facts.push({ key: 'system', labelKey: `${P}.groupSystem`, params: { system: word(IMMUTABLE_VALUE_KEYS[tournament.groupSystem]) } });
  }
  facts.push(
    { key: 'mode', labelKey: `${P}.gameMode`, params: { mode: word(IMMUTABLE_VALUE_KEYS[tournament.mode]) } },
    { key: 'type', labelKey: `${P}.tournamentType`, params: { type: word(IMMUTABLE_VALUE_KEYS[tournament.tournamentType]) } },
  );
  return facts;
}

/**
 * Erklärtext je Zustand: Startzustand (Anpfiff) und Recht `restructure`. Nur `'started'` sagt „seit dem ersten
 * Anpfiff fest“; bei `'unknown'` (offline, lädt) bleibt der Text neutral, denn angepfiffen ist dann nicht belegt.
 */
export function immutableDescriptionKey(
  startState: MatchStartState,
  canRestructure: boolean,
): 'settings.immutableSettings.descriptionAfterStart' | 'settings.immutableSettings.descriptionBeforeStart' | 'settings.immutableSettings.description' {
  if (startState === 'started') { return `${P}.descriptionAfterStart`; }
  return startState === 'not-started' && canRestructure ? `${P}.descriptionBeforeStart` : `${P}.description`;
}
