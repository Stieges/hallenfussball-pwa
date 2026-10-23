/**
 * Test-Helfer A-12b: liest die gemeinsame Fixture `finals-plan-errors.json` (Fehlerfälle für `validateFinalsPlan`,
 * Import und ab A-15a `set_slot_source`) und baut daraus Spiele bzw. eine Importdatei. Nur Testumgebung.
 */
import fixtureJson from '../__fixtures__/finals-plan-errors.json';
import type { Match } from '../../../types/tournament';
import { pendingSlot } from '../../models/matchSlot';
import type { SlotSource } from '../../models/schemas/MatchSlotSchema';
import { testUuid } from '../../../test/testIds';

export type FileSource =
  | { kind: 'groupRank'; group: string; rank: number }
  | { kind: 'matchResult'; match: string; role: 'winner' | 'loser' };

export interface FilePlanMatch {
  id: string;
  label: string;
  phase: string;
  finalType?: string;
  sourceA: FileSource;
  sourceB: FileSource;
}

export interface FixtureError {
  match: string;
  side?: 'A' | 'B';
  code: string;
  position: string;
}

export interface FixtureCase {
  id: string;
  szenario: string;
  gegenbeispiel?: boolean;
  befund?: string;
  beschreibung: string;
  groups: { id: string; teamCount: number }[];
  plan: string;
  set?: { match: string; side: 'A' | 'B'; source: FileSource }[];
  expect: { ok: boolean; only?: boolean; errors?: FixtureError[] };
}

const fixture = fixtureJson as unknown as { plans: Record<string, FilePlanMatch[]>; cases: FixtureCase[] };

export const FIXTURE_CASES: readonly FixtureCase[] = fixture.cases;
export const INVALID_CASES = FIXTURE_CASES.filter((c) => !c.expect.ok);
export const VALID_CASES = FIXTURE_CASES.filter((c) => c.expect.ok);

/** Plan des Falls mit den Änderungen aus `set` (Seiten werden überschrieben). */
export function planOf(fixtureCase: FixtureCase): FilePlanMatch[] {
  const plan = fixture.plans[fixtureCase.plan].map((m) => ({ ...m }));
  for (const change of fixtureCase.set ?? []) {
    const target = plan.find((m) => m.id === change.match);
    if (target === undefined) { throw new Error(`Fixture: Spiel ${change.match} fehlt im Plan`); }
    target[change.side === 'A' ? 'sourceA' : 'sourceB'] = change.source;
  }
  return plan;
}

/** Importdatei zum Fall: Teams je Gruppe, Plan als Finalspiele. */
export function importFileOf(fixtureCase: FixtureCase, plan: FilePlanMatch[] = planOf(fixtureCase)): string {
  return JSON.stringify({
    title: 'Hallencup Nord',
    teams: fixtureCase.groups.flatMap((g) =>
      Array.from({ length: g.teamCount }, (_, n) => ({ id: `${g.id}${n + 1}`, name: `Team ${g.id}${n + 1}`, group: g.id })),
    ),
    matches: plan.map((m, index) => ({ ...m, round: index + 1, field: 1, isFinal: true })),
  });
}

/** Spiele (mit festen UUIDs) zum Fall – wie sie nach dem Import bzw. aus dem Generator im Speicher liegen. */
export function matchesOf(fixtureCase: FixtureCase, plan: FilePlanMatch[] = planOf(fixtureCase)): Match[] {
  const ids = new Map(plan.map((m, index) => [m.id, testUuid(100 + index)]));
  const toSource = (source: FileSource): SlotSource => {
    if (source.kind === 'groupRank') { return source; }
    const matchId = ids.get(source.match);
    if (matchId === undefined) { throw new Error(`Fixture: Spiel ${source.match} fehlt im Plan`); }
    return { kind: 'matchResult', matchId, role: source.role };
  };
  return plan.map((m, index) => ({
    id: testUuid(100 + index),
    round: index + 1,
    field: 1,
    slotA: pendingSlot(toSource(m.sourceA)),
    slotB: pendingSlot(toSource(m.sourceB)),
    originA: toSource(m.sourceA),
    originB: toSource(m.sourceB),
    isFinal: true,
    label: m.label,
    phase: m.phase,
    finalType: m.finalType as Match['finalType'],
  }));
}

/** Kurz-ID des Spiels in der Fixture ↔ UUID in `matchesOf`. */
export const matchIdOf = (plan: readonly FilePlanMatch[], shortId: string): string => {
  const index = plan.findIndex((m) => m.id === shortId);
  if (index < 0) { throw new Error(`Fixture: Spiel ${shortId} fehlt im Plan`); }
  return testUuid(100 + index);
};
