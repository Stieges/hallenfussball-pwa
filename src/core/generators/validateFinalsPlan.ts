/**
 * A-12b – Prüfung der Herkunft einer Finalrunde (Record Turniermodi, @TM-013 und @TM-002; Befund C-TOP4-ZU-WENIG-TEAMS).
 *
 * `validateFinalsPlan(matches, groups)` prüft die Herkunft ALLER Plätze einer Finalrunde, ohne etwas zu verändern:
 *  - `DUPLICATE_IN_PHASE`      dieselbe Herkunft kommt in einer Phase zweimal vor (ein Team würde doppelt spielen),
 *  - `UNKNOWN_GROUP`           die Herkunft nennt eine Gruppe, die es im Turnier nicht gibt (@TM-002),
 *  - `RANK_EXCEEDS_GROUP`      der Rang ist größer als die Zahl der Teams der Gruppe (z. B. „Vierter“ bei 3 Teams),
 *  - `CYCLE`                   die Herkunft führt über Sieger/Verlierer im Kreis zurück auf das Spiel selbst,
 *  - `MORE_PLACES_THAN_TEAMS`  eine Phase hat mehr Plätze als das Turnier Teams (z. B. Achtelfinale mit 16 Plätzen bei 8 Teams),
 *  - `UNKNOWN_MATCH`           der Verweis zeigt auf ein Spiel, das es im Plan nicht gibt.
 * Jeder Fehler nennt Spiel, Seite und die Stelle als Text („Halbfinale 2, Gastseite“); `formatFinalsPlanError` macht die
 * Meldung für Menschen daraus. Framework-frei (core). Dieselben Fehlerfälle prüft die Fixture `finals-plan-errors.json`
 * ab A-15a auch gegen `set_slot_source` (Server-Zwilling).
 *
 * Phase eines Spiels: Schlüsselwort der Bezeichnung („Viertelfinale“, „Halbfinale“ …) vor `phase` vor „Finale“. Die
 * Bezeichnung geht vor, weil `Match.phase` im Bestand für Halbfinale noch „final“ lautet (C-FINALPHASE-AUS-ID, A-12a).
 */
import type { Match } from '../../types/tournament';
import { slotSource } from '../models/matchSlot';
import type { SlotSource } from '../models/schemas/MatchSlotSchema';

export type FinalsPlanErrorCode =
  | 'DUPLICATE_IN_PHASE'
  | 'UNKNOWN_GROUP'
  | 'RANK_EXCEEDS_GROUP'
  | 'CYCLE'
  | 'MORE_PLACES_THAN_TEAMS'
  | 'UNKNOWN_MATCH';

export type FinalsPlanPhase = 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

/** Was die Prüfung von einem Spiel der Finalrunde braucht (auch `Match` und `ScheduledMatch` passen). */
export type FinalsPlanMatch = Pick<Match, 'id' | 'slotA' | 'slotB' | 'originA' | 'originB' | 'label' | 'phase'>;

export interface FinalsPlanGroup {
  id: string;
  teamCount: number;
}

export interface FinalsPlanError {
  code: FinalsPlanErrorCode;
  matchId: string;
  /** `A` = Heimseite, `B` = Gastseite; fehlt bei Fehlern der ganzen Phase. */
  side?: 'A' | 'B';
  phase: FinalsPlanPhase;
  /** Stelle als Text, z. B. „Halbfinale 2, Gastseite“ bzw. „Achtelfinale“ (ganze Phase). */
  position: string;
  /** Herkunft der Seite als Text, z. B. „Erster Gruppe A“. */
  sourceText?: string;
  group?: string;
  teamCount?: number;
  places?: number;
  teams?: number;
}

export type FinalsPlanResult = { ok: true } | { ok: false; errors: FinalsPlanError[] };

const PHASE_ORDER: Record<FinalsPlanPhase, number> = { roundOf16: 0, quarterfinal: 1, semifinal: 2, final: 3 };
const PHASE_NAME: Record<FinalsPlanPhase, string> = {
  roundOf16: 'Achtelfinale', quarterfinal: 'Viertelfinale', semifinal: 'Halbfinale', final: 'Finalspiele',
};
const LABEL_PHASES: ReadonlyArray<readonly [RegExp, FinalsPlanPhase]> = [
  [/achtelfinale/i, 'roundOf16'], [/viertelfinale/i, 'quarterfinal'], [/halbfinale/i, 'semifinal'],
];
const RANK_WORD: Record<number, string> = { 1: 'Erster', 2: 'Zweiter', 3: 'Dritter', 4: 'Vierter' };
const SIDES = ['A', 'B'] as const;
type Side = (typeof SIDES)[number];

function phaseOf(match: FinalsPlanMatch): FinalsPlanPhase {
  const byLabel = LABEL_PHASES.find(([pattern]) => pattern.test(match.label ?? ''));
  if (byLabel !== undefined) { return byLabel[1]; }
  const declared = match.phase;
  return declared === 'roundOf16' || declared === 'quarterfinal' || declared === 'semifinal' ? declared : 'final';
}

function sourceOfSide(match: FinalsPlanMatch, side: Side): SlotSource | undefined {
  return side === 'A' ? (match.originA ?? slotSource(match.slotA)) : (match.originB ?? slotSource(match.slotB));
}

const sourceKey = (source: SlotSource): string =>
  source.kind === 'groupRank' ? `g:${source.group}:${source.rank}` : `m:${source.matchId}:${source.role}`;

interface Named { phase: FinalsPlanPhase; name: string }

/** Name des Spiels: „Halbfinale 2“ (Nummer aus der Bezeichnung, sonst Reihenfolge der Phase) bzw. die Bezeichnung selbst. */
function nameMatches(matches: readonly FinalsPlanMatch[]): Map<string, Named> {
  const seen = new Map<FinalsPlanPhase, number>();
  return new Map(matches.map((match): [string, Named] => {
    const phase = phaseOf(match);
    const index = (seen.get(phase) ?? 0) + 1;
    seen.set(phase, index);
    const label = match.label?.trim() ?? '';
    if (phase === 'final') { return [match.id, { phase, name: label === '' ? 'Finale' : label }]; }
    const number = /\d+/.exec(label)?.[0] ?? String(index);
    return [match.id, { phase, name: `${PHASE_NAME[phase]} ${number}` }];
  }));
}

function describeSource(source: SlotSource, names: ReadonlyMap<string, Named>): string {
  if (source.kind === 'groupRank') {
    return `${RANK_WORD[source.rank] ?? `Platz ${source.rank}`} Gruppe ${source.group}`;
  }
  const target = names.get(source.matchId)?.name ?? 'unbekanntem Spiel';
  return `${source.role === 'winner' ? 'Sieger' : 'Verlierer'} ${target}`;
}

/** Ids der Spiele, auf die eine Seite des Spiels per Sieger/Verlierer verweist (nur Spiele, die es im Plan gibt). */
function resultTargets(match: FinalsPlanMatch, known: ReadonlySet<string>): string[] {
  return SIDES.flatMap((side) => {
    const source = sourceOfSide(match, side);
    return source?.kind === 'matchResult' && known.has(source.matchId) ? [source.matchId] : [];
  });
}

/** Zusammenhangskomponenten des Verweis-Graphen (Tarjan): Spiele derselben Komponente liegen auf einem Kreis. */
function componentsOf(matches: readonly FinalsPlanMatch[]): Map<string, number> {
  const known = new Set(matches.map((m) => m.id));
  const targets = new Map(matches.map((m) => [m.id, resultTargets(m, known)]));
  let components = 0;
  const order = new Map<string, number>();
  const low = new Map<string, number>();
  const component = new Map<string, number>();
  const stack: string[] = [];
  const visit = (id: string): void => {
    order.set(id, order.size);
    low.set(id, order.get(id) ?? 0);
    stack.push(id);
    for (const next of targets.get(id) ?? []) {
      if (!order.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id) ?? 0, low.get(next) ?? 0));
      } else if (!component.has(next)) {
        low.set(id, Math.min(low.get(id) ?? 0, order.get(next) ?? 0));
      }
    }
    if (low.get(id) === order.get(id)) {
      let member = stack.pop();
      while (member !== undefined) {
        component.set(member, components);
        if (member === id) { break; }
        member = stack.pop();
      }
      components += 1;
    }
  };
  matches.forEach((m) => { if (!order.has(m.id)) { visit(m.id); } });
  return component;
}

/** Seiten, deren Verweis auf Sieger/Verlierer einen Kreis schließt (Schlüssel `<Spiel-ID>:<Seite>`). */
function cycleSides(matches: readonly FinalsPlanMatch[], names: ReadonlyMap<string, Named>): Set<string> {
  const component = componentsOf(matches);
  const phaseRank = (id: string): number => PHASE_ORDER[names.get(id)?.phase ?? 'final'];
  const edges = matches.flatMap((match) => SIDES.flatMap((side) => {
    const source = sourceOfSide(match, side);
    const inCycle = source?.kind === 'matchResult' && names.has(source.matchId)
      && component.get(match.id) === component.get(source.matchId);
    return inCycle ? [{ key: `${match.id}:${side}`, from: match.id, to: source.matchId }] : [];
  }));
  // Fehlerhaft ist der Verweis nach vorn (auf dasselbe oder ein späteres Spiel); gibt es keinen, alle Verweise des Kreises.
  const forward = edges.filter((edge) => phaseRank(edge.to) >= phaseRank(edge.from));
  return new Set((forward.length > 0 ? forward : edges).map((edge) => edge.key));
}

/** Prüft die Herkunft aller Plätze der Finalrunde. `groups`: alle Gruppen des Turniers mit ihrer Teamzahl. */
export function validateFinalsPlan(matches: readonly FinalsPlanMatch[], groups: readonly FinalsPlanGroup[]): FinalsPlanResult {
  const names = nameMatches(matches);
  const cycles = cycleSides(matches, names);
  const totalTeams = groups.reduce((sum, group) => sum + group.teamCount, 0);
  const seenInPhase = new Map<FinalsPlanPhase, Set<string>>();
  const placesInPhase = new Map<FinalsPlanPhase, { count: number; firstMatchId: string }>();
  const errors: FinalsPlanError[] = [];

  for (const match of matches) {
    const { phase, name } = names.get(match.id) ?? { phase: 'final' as const, name: match.id };
    for (const side of SIDES) {
      const source = sourceOfSide(match, side);
      if (source === undefined) { continue; }
      const place = placesInPhase.get(phase);
      placesInPhase.set(phase, { count: (place?.count ?? 0) + 1, firstMatchId: place?.firstMatchId ?? match.id });
      const error = (code: FinalsPlanErrorCode, extra: Partial<FinalsPlanError> = {}): void => {
        errors.push({
          code, matchId: match.id, side, phase, position: `${name}, ${side === 'A' ? 'Heimseite' : 'Gastseite'}`,
          sourceText: describeSource(source, names), ...extra,
        });
      };
      const phaseKeys = seenInPhase.get(phase) ?? new Set<string>();
      seenInPhase.set(phase, phaseKeys);
      if (phaseKeys.has(sourceKey(source))) { error('DUPLICATE_IN_PHASE'); }
      phaseKeys.add(sourceKey(source));
      if (source.kind === 'groupRank') {
        const group = groups.find((candidate) => candidate.id === source.group);
        if (group === undefined) { error('UNKNOWN_GROUP', { group: source.group }); }
        else if (source.rank > group.teamCount) { error('RANK_EXCEEDS_GROUP', { group: group.id, teamCount: group.teamCount }); }
      } else if (!names.has(source.matchId)) {
        error('UNKNOWN_MATCH');
      } else if (cycles.has(`${match.id}:${side}`)) {
        error('CYCLE');
      }
    }
  }

  for (const [phase, { count, firstMatchId }] of placesInPhase) {
    if (count > totalTeams) {
      errors.push({
        code: 'MORE_PLACES_THAN_TEAMS', matchId: firstMatchId, phase, position: PHASE_NAME[phase], places: count, teams: totalTeams,
      });
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function reasonOf(error: FinalsPlanError): string {
  const source = `„${error.sourceText ?? ''}“`;
  switch (error.code) {
    case 'DUPLICATE_IN_PHASE': return `${source} kommt in dieser Phase schon vor`;
    case 'UNKNOWN_GROUP': return `Gruppe ${error.group ?? ''} gibt es im Turnier nicht`;
    case 'RANK_EXCEEDS_GROUP':
      return `${source}: Gruppe ${error.group ?? ''} hat nur ${error.teamCount ?? 0} ${error.teamCount === 1 ? 'Team' : 'Teams'}`;
    case 'CYCLE': return `${source} hängt vom eigenen Ergebnis ab (Herkunft im Kreis)`;
    case 'MORE_PLACES_THAN_TEAMS': return `${error.places ?? 0} Plätze, aber nur ${error.teams ?? 0} Teams`;
    case 'UNKNOWN_MATCH': return `${source}: das Vorgängerspiel gibt es nicht`;
  }
}

/** Meldung für Menschen: Stelle und Grund, z. B. „Halbfinale 1, Gastseite: Gruppe C gibt es im Turnier nicht“. */
export function formatFinalsPlanError(error: FinalsPlanError): string {
  return `${error.position}: ${reasonOf(error)}`;
}
