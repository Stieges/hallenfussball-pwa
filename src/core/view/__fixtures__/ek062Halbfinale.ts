/**
 * SW (@EK-062): Halbfinale 1 FC Nord (Heim) gegen DJK Berg (Gast) im „Hallencup Nord“, per Direkteintrag 2:2 + Strafstoß
 * 4:3 für FC Nord eingetragen, wieder eröffnet, optional Tor DJK Berg, Abpfiff -- über die echte Kette `reduceMatch` →
 * `cacheColumns` (Cloud-Zeile, TS == SQL laut match-engine-parity.sh 68a/68b) bzw. `engineOverlayFields` (eigenes Gerät).
 * Gemeinsam für die Ansichts-, Monitor- und Spielkarten-Tests (keine von Hand gebaute Zeile).
 */
import { BERG, GAME, NORD, publishHallencup, withCloudColumns, type Hallencup } from './hallencupNord';
import { resolveSlot } from '../../models/matchSlot';
import { reduceMatch } from '../../match/reduceMatch';
import { cacheColumns } from '../../match/client/cacheColumns';
import { engineOverlayFields } from '../../match/client/applyEngineOverlay';
import type { EngineEvent, MatchContext } from '../../match/types';

/** Halbfinale 1 mit FC Nord (Heim) gegen DJK Berg (Gast) besetzen, wie der Resolver es tut. */
export async function halbfinale1NordBerg(): Promise<Hallencup> {
  const cup = await publishHallencup();
  const matches = cup.tournament.matches.map((m, i) =>
    i === GAME.HF1 && m.originA !== undefined && m.originB !== undefined
      ? { ...m, slotA: resolveSlot(m.originA, NORD), slotB: resolveSlot(m.originB, BERG) }
      : m,
  );
  return { ...cup, tournament: { ...cup.tournament, matches } };
}

function ev(n: number, type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent {
  return { id: `0000e062-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`, type, actor: 'leitung', at, section: null, clockMs: null, payload: {}, ...extra };
}

/** Direkteintrag 2:2 + 4:3 für FC Nord, wieder eröffnet, optional Tor DJK Berg, Abpfiff. */
function ablauf(mitTorDjkBerg: boolean): EngineEvent[] {
  return [
    ev(1, 'RESULT_ENTRY', 1000, { payload: { scores: { [NORD]: 2, [BERG]: 2 }, shootout: { [NORD]: 4, [BERG]: 3 } } }),
    ev(2, 'REOPEN', 2000),
    ...(mitTorDjkBerg ? [ev(3, 'GOAL', 3000, { section: 1, clockMs: 0, teamId: BERG })] : []),
    ev(4, 'MATCH_END', 5000, { section: 1, clockMs: 0 }),
  ];
}

export async function gespielt(mitTorDjkBerg: boolean) {
  const base = await halbfinale1NordBerg();
  const hf1Id = base.tournament.matches[GAME.HF1].id;
  const ctx: MatchContext = { matchId: hf1Id, teamAId: NORD, teamBId: BERG };
  const { state } = reduceMatch(ablauf(mitTorDjkBerg), ctx);
  // Nur die Ergebnis-/Status-Spalten (wie `playMatch` in hallencupNord.ts); Zeitstempel und live_state braucht die Ansicht nicht.
  const { running: _running, started: _started, anchor_at: _anchor, finished_at: _finished, live_state: _live,
    skipped_at: _skippedAt, skipped_reason: _reason, ...columns } = cacheColumns(state, ctx);
  const cup = withCloudColumns(base, GAME.HF1, columns);
  const lokal = engineOverlayFields({ result: { state, localRejected: [], needsFullReload: false }, log: [], confirmedCount: 0 }, ctx);
  return { cup, hf1: cup.tournament.matches[GAME.HF1], lokal };
}
