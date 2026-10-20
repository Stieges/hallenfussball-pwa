/**
 * phaseViewOf: Restzeit der Quittung nach dem Abpfiff (@SL-152, 30 Sekunden). Testwerte: Spiel 2 x 6 Minuten, Abpfiff
 * von Hand bei 4 Minuten; die Quittung beginnt mit dem Abpfiff-Ereignis (`finishedAt`) und dauert 30 Sekunden.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseViewOf, type PhaseView } from '../phaseView';
import { REGEL_2X6, spielAnlegen, zu, type EngineSpiel } from '../../__tests__/enginePhaseFixture';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
});
afterEach(() => {
  vi.useRealTimers();
});

function sicht(spiel: EngineSpiel): PhaseView {
  const view = spiel.a.engine.view(spiel.matchId);
  if (!view) { throw new Error('keine Engine-Ansicht'); }
  return phaseViewOf(view.result.state, spiel.ctx, spiel.a.engine.serverNow());
}

async function abgepfiffenNach(spiel: EngineSpiel, ms: number): Promise<void> {
  await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
  zu(ms);
  await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
}

describe('phaseViewOf: quittungRestMs (@SL-152)', () => {
  it('@SL-152 12 Sekunden nach dem Abpfiff sind noch 18 Sekunden Quittung übrig', async () => {
    const spiel = await spielAnlegen();
    await abgepfiffenNach(spiel, 240_000);
    zu(252_000);
    const phase = sicht(spiel);
    expect(phase.status).toBe('finished');
    expect(phase.quittungRestMs).toBe(18_000);
  });

  it('@SL-152 Gegenbeispiel: 30 Sekunden nach dem Abpfiff ist die Quittung vorbei (0), nie negativ', async () => {
    const spiel = await spielAnlegen();
    await abgepfiffenNach(spiel, 240_000);
    zu(270_000);
    expect(sicht(spiel).quittungRestMs).toBe(0);
    zu(600_000);
    expect(sicht(spiel).quittungRestMs).toBe(0);
  });

  it('@SL-152 Gegenbeispiel: solange das Spiel läuft, gibt es keine Quittung', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(100_000);
    expect(sicht(spiel).quittungRestMs).toBeNull();
  });
});
