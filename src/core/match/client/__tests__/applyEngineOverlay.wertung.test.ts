/**
 * Review A-25c, „Muss für G1a/A-25n“: `forfeitAbsent` gehört in `EngineOverlayFields`/`applyEngineOverlay`. Solange der
 * lokale Eintrag der Turnierleitung vor der Server-Zeile gilt, kommt das Merkmal nur über die Überlagerung in die
 * Turnierkopie – fehlt es, zählt die Tabelle (A-25c, `matchOutcome`) eine Wertung beider (0:0) als Remis.
 *
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-09-27_wizard-regelinhalte.md):
 *  - @W2A-024 / @TM-063 „Team C und Team D treten … beide nicht an … beide Teams 0 Punkte … keines erhält einen Sieg …
 *    in allen Ansichten … als Wertung gekennzeichnet“.
 *  - @W2A-022 „nicht angetreten“ für Team C → 2:0 für Team D (eine Seite fehlt).
 *  - @W2A-026 „Wertung zurücknehmen … das Spiel ist wieder offen und die Tabelle neu berechnet“.
 * Gegenbeispiele: gespieltes 0:0 (kein Merkmal), Rücknahme räumt ein altes Merkmal ab, neue Wertung ersetzt es.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../../reduceMatch';
import type { EngineEvent, MatchContext } from '../../types';
import { applyEngineOverlay, engineOverlayFields, type OverlayableMatch } from '../applyEngineOverlay';
import type { MatchEngineView } from '../MatchEngine';

const C = 'team-c';
const D = 'team-d';
const ctx: MatchContext = { matchId: 'spiel-c-d', teamAId: C, teamBId: D };

let seq = 0;
function ev(type: EngineEvent['type'], payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent {
  seq += 1;
  return {
    id: `0000a25c-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    type, actor: 'leitung', at: 1000 * seq, section: null, clockMs: null, payload, ...extra,
  };
}
const wertung = (absent: 'A' | 'B' | 'both', a: number, b: number) =>
  ev('RESULT_ENTRY', { scores: { [C]: a, [D]: b }, forfeit: { absent } });

function overlayFor(log: EngineEvent[]) {
  const { state } = reduceMatch(log, ctx);
  const view: MatchEngineView = { result: { state, localRejected: [], needsFullReload: false }, log, confirmedCount: 0 };
  return engineOverlayFields(view, ctx);
}

/** Turnierkopie mit der noch alten Zeile (Server hat den Eintrag noch nicht zurückgemeldet). */
function kopieMit(match: OverlayableMatch) {
  return { matches: [match] };
}

describe('Review A-25c: forfeitAbsent in der Überlagerung (lokaler Eintrag vor der Server-Zeile)', () => {
  it('@W2A-024 @TM-063 Wertung beider: die Kopie trägt 0:0, beendet, decidedBy forfeit und forfeitAbsent both – kein gespieltes Remis', () => {
    const vorher: OverlayableMatch = { id: ctx.matchId, matchStatus: 'scheduled' };
    const result = applyEngineOverlay(kopieMit(vorher), new Map([[ctx.matchId, overlayFor([wertung('both', 0, 0)])]]));
    expect(result.matches[0]).toMatchObject({ scoreA: 0, scoreB: 0, matchStatus: 'finished', decidedBy: 'forfeit', forfeitAbsent: 'both' });
  });

  it('@W2A-022 eine Seite fehlt (Team C): forfeitAbsent A, Stand 0:2', () => {
    const result = applyEngineOverlay(kopieMit({ id: ctx.matchId }), new Map([[ctx.matchId, overlayFor([wertung('A', 0, 2)])]]));
    expect(result.matches[0]).toMatchObject({ scoreA: 0, scoreB: 2, decidedBy: 'forfeit', forfeitAbsent: 'A' });
  });

  it('@W2A-024 Gegenbeispiel: ein gespieltes 0:0 trägt kein Merkmal (decidedBy regular, forfeitAbsent leer)', () => {
    const rules = {
      sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: false, tiebreak: null, overtimeSeconds: 0,
      shootersPerTeam: 0, suddenDeathAfter: 0, penaltySeconds: 0,
    };
    const fields = overlayFor([
      ev('MATCH_START', { rules }, { actor: 'helper', section: 1, clockMs: 0 }),
      ev('MATCH_END', {}, { actor: 'helper', section: 1, clockMs: 600000 }),
    ]);
    expect(fields).toMatchObject({ scoreA: 0, scoreB: 0, decidedBy: 'regular', forfeitAbsent: undefined });
  });

  it('@W2A-026 Gegenbeispiel: nach der Rücknahme räumt die Überlagerung ein altes Merkmal ab (Spiel wieder offen)', () => {
    const alt: OverlayableMatch = { id: ctx.matchId, scoreA: 0, scoreB: 0, matchStatus: 'finished', decidedBy: 'forfeit', forfeitAbsent: 'both' };
    const fields = overlayFor([wertung('both', 0, 0), ev('REOPEN')]);
    const result = applyEngineOverlay(kopieMit(alt), new Map([[ctx.matchId, fields]]));
    expect(result.matches[0]).toMatchObject({ matchStatus: 'scheduled', decidedBy: undefined, forfeitAbsent: undefined });
  });

  it('@W2A-026 Gegenbeispiel: Wertung beider → Rücknahme → Wertung für Team C: aus „both“ wird „B“, Team C gewinnt 2:0', () => {
    const alt: OverlayableMatch = { id: ctx.matchId, scoreA: 0, scoreB: 0, matchStatus: 'finished', decidedBy: 'forfeit', forfeitAbsent: 'both' };
    const fields = overlayFor([wertung('both', 0, 0), ev('REOPEN'), wertung('B', 2, 0)]);
    const result = applyEngineOverlay(kopieMit(alt), new Map([[ctx.matchId, fields]]));
    expect(result.matches[0]).toMatchObject({ scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' });
  });

  it('@W2A-026 Gegenbeispiel: Wertung A → Rücknahme → Wertung beider: aus „A“ wird „both“', () => {
    const alt: OverlayableMatch = { id: ctx.matchId, scoreA: 0, scoreB: 2, matchStatus: 'finished', decidedBy: 'forfeit', forfeitAbsent: 'A' };
    const fields = overlayFor([wertung('A', 0, 2), ev('REOPEN'), wertung('both', 0, 0)]);
    const result = applyEngineOverlay(kopieMit(alt), new Map([[ctx.matchId, fields]]));
    expect(result.matches[0]).toMatchObject({ scoreA: 0, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'both' });
  });

  it('nur das Merkmal weicht ab: die Überlagerung erkennt es (neues Objekt), sonst bliebe das alte „A“ stehen', () => {
    const fields = overlayFor([wertung('both', 0, 0)]);
    const fastGleich: OverlayableMatch = { id: ctx.matchId, scoreA: 0, scoreB: 0, matchStatus: 'finished', decidedBy: 'forfeit', forfeitAbsent: 'A' };
    const tournament = kopieMit(fastGleich);
    const result = applyEngineOverlay(tournament, new Map([[ctx.matchId, fields]]));
    expect(result).not.toBe(tournament);
    expect(result.matches[0].forfeitAbsent).toBe('both');
  });
});
