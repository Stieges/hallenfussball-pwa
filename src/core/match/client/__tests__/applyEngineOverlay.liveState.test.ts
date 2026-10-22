/**
 * C-OVERLAY-LIVESTATE-BLEIBT (@OB-066): Nach dem Abpfiff trägt das Spiel im lokalen Weg kein
 * Feinstatus-Abzeichen mehr.
 *
 * @OB-066 Zeile „Spiel 1 beendet 2:0 -> das Abzeichen „Ende““: Der Server leert `live_state` beim Beenden.
 * Der lokale Weg (`applyEngineOverlay`) übernimmt Stand und Status, ließ aber den alten Feinstatus
 * („Halbzeit“) am Datensatz stehen -- geschützt nur durch die Sicht-Regel „Feinstatus nur bei
 * running/paused“. Jetzt wird er am Datensatz geleert, wie am Server.
 *
 * Gegenbeispiel: Läuft das Spiel noch, bleibt der Feinstatus unberührt (gleiche Objektreferenz).
 */
import { describe, it, expect } from 'vitest';
import { initialState } from '../../applyEvent';
import { reduceMatch } from '../../reduceMatch';
import type { MatchState } from '../../types';
import { badgeDetailFromLiveState } from '../../../view/badge';
import { applyEngineOverlay, engineOverlayFields, type OverlayableMatch } from '../applyEngineOverlay';
import { ctx, start } from './fixtures';
import type { MatchEngineView } from '../MatchEngine';

function viewFromState(state: MatchState): MatchEngineView {
  return { result: { state, localRejected: [], needsFullReload: false }, log: [], confirmedCount: 0 };
}

const HALBZEIT_LIVE_STATE = {
  engine: true,
  status: 'section_break',
  phase: 'regular',
  section: 1,
  sections: 2,
};

function finishedState(): MatchState {
  return {
    ...initialState(ctx),
    status: 'finished',
    phase: 'regular',
    finishedAt: 9999,
    decidedBy: 'regular',
    baseDecidedBy: 'regular',
    scores: {
      [ctx.teamAId]: { regular: 2, overtime: 0, shootout: 0 },
      [ctx.teamBId]: { regular: 0, overtime: 0, shootout: 0 },
    },
  };
}

describe('C-OVERLAY-LIVESTATE-BLEIBT: reines Aufräumen, Feinstatus nach dem Abpfiff (Bezug @OB-066)', () => {
  it('@OB-066 (Bezug) beendet 2:0: der alte Feinstatus „Halbzeit“ ist am Datensatz geleert, das Abzeichen ist „Ende“', () => {
    const fields = engineOverlayFields(viewFromState(finishedState()), ctx);
    const stale: OverlayableMatch = {
      id: ctx.matchId,
      scoreA: 1,
      scoreB: 0,
      matchStatus: 'running',
      liveState: HALBZEIT_LIVE_STATE,
    };

    const result = applyEngineOverlay({ matches: [stale] }, new Map([[ctx.matchId, fields]]));

    expect(result.matches[0]).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 0 });
    expect(result.matches[0].liveState).toBeUndefined();
    expect(badgeDetailFromLiveState(result.matches[0].liveState, 0)).toBeUndefined();
    expect(stale.liveState).toBe(HALBZEIT_LIVE_STATE);
  });

  it('@OB-066 (Bezug) beendet und bereits ohne Feinstatus: Tournament-Objekt bleibt dieselbe Referenz', () => {
    const fields = engineOverlayFields(viewFromState(finishedState()), ctx);
    const match: OverlayableMatch = {
      id: ctx.matchId,
      scoreA: fields.scoreA,
      scoreB: fields.scoreB,
      matchStatus: fields.matchStatus,
      decidedBy: fields.decidedBy,
      kit: fields.kit,
    };
    const tournament = { matches: [match] };

    expect(applyEngineOverlay(tournament, new Map([[ctx.matchId, fields]]))).toBe(tournament);
  });

  it('Gegenbeispiel: das Spiel läuft noch, der Feinstatus bleibt unberührt', () => {
    const { state } = reduceMatch([start()], ctx);
    const fields = engineOverlayFields(viewFromState(state), ctx);
    const running: OverlayableMatch = {
      id: ctx.matchId,
      scoreA: 0,
      scoreB: 0,
      matchStatus: 'scheduled',
      liveState: HALBZEIT_LIVE_STATE,
    };

    const result = applyEngineOverlay({ matches: [running] }, new Map([[ctx.matchId, fields]]));

    expect(result.matches[0]).toMatchObject({ matchStatus: 'running' });
    expect(result.matches[0].liveState).toBe(HALBZEIT_LIVE_STATE);
  });
});
