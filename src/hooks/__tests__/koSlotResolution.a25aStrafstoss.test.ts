/**
 * A-25a T2-UI (b, Ersatz für den Playwright-Teil „Folgespiel“): Nach dem Direkteintrag Halbfinale 1 2:2 mit
 * Strafstoßschießen 4:3 für das Heimteam besetzt die lokale K.-o.-Auflösung das Finale mit dem Heimteam statt
 * „Sieger Halbfinale 1“ (@FU-094 „Sieger Heimteam“, @ZM-049/@ZM-147 Folgerunde). Echter Weg: Engine-Ansicht →
 * `withEngineResult` (Zwischenspeicher-Spalten) → `slotUpdatesAfterResult` (Resolver).
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../../core/match';
import type { MatchEngineView } from '../../core/match/client';
import { pendingSlot, slotTeamId, teamSlot } from '../../core/models/matchSlot';
import { createMockMatch } from '../../test/factories';
import { FC_NORD, GAST, HALBFINALE_1, HEIM, scheduleTournament } from '../../test/scheduleEngineHarness';
import { buildValidMatches } from '../engineMatchModel';
import { slotUpdatesAfterResult, withEngineResult } from '../koSlotResolution';

const HF1_ID = '00000000-0000-4000-8000-0000000025a1';
const SIEGER_HF1 = { kind: 'matchResult' as const, matchId: HF1_ID, role: 'winner' as const };

function turnier() {
  const finale = createMockMatch({
    id: 'finale-a25a', matchNumber: 12, group: undefined, phase: 'final', isFinal: true,
    slotA: pendingSlot(SIEGER_HF1), originA: SIEGER_HF1, slotB: teamSlot(FC_NORD), matchStatus: 'scheduled',
  });
  return scheduleTournament({ [HALBFINALE_1]: { id: HF1_ID } }, [finale]);
}

/** Team auf Platz A des Finales nach der Auflösung (undefined = nicht besetzt). */
function finaleHeim(updates: ReturnType<typeof slotUpdatesAfterResult>): string | undefined {
  const finale = updates.find((update) => update.id === 'finale-a25a');
  return finale?.slotA ? slotTeamId(finale.slotA) : undefined;
}

function nachDirekteintrag(payload: Record<string, unknown>) {
  const tournament = turnier();
  const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === HF1_ID);
  if (!entry) {
    throw new Error('Halbfinale 1 fehlt');
  }
  const result = reduceMatch([{
    id: '0000a25a-0000-4000-8000-0000000000f1', type: 'RESULT_ENTRY', actor: 'leitung', at: 1000, section: null, clockMs: null, payload,
  }], entry.ctx);
  const view: MatchEngineView = { result: { state: result.state, localRejected: [], needsFullReload: false }, log: [], confirmedCount: 1 };
  return slotUpdatesAfterResult(withEngineResult(tournament, entry, view));
}

describe('@FU-094 Folgespiel nach Direkteintrag mit Strafstoßschießen', () => {
  it('@FU-094 Halbfinale 1 2:2, Strafstoß 4:3 für das Heimteam → Finale mit dem Heimteam statt „Sieger Halbfinale 1“', () => {
    const updates = nachDirekteintrag({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 4, [GAST]: 3 } });
    expect(finaleHeim(updates)).toBe(HEIM);
  });

  it('@FU-094 Strafstoß 3:4 → Finale mit dem Auswärtsteam', () => {
    const updates = nachDirekteintrag({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 3, [GAST]: 4 } });
    expect(finaleHeim(updates)).toBe(GAST);
  });

  it('@FU-094 Gegenbeispiel: 2:2 ohne Strafstoßergebnis → kein Sieger, Finale bleibt offen (nichts wird geraten)', () => {
    const updates = nachDirekteintrag({ scores: { [HEIM]: 2, [GAST]: 2 } });
    expect(updates.find((update) => update.id === 'finale-a25a')).toBeUndefined();
  });
});
