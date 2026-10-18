/**
 * phaseViewOf (B-08b): Grenze des Abschnitts als absolute Spieluhr (`limitClockMs`) und als Wanduhr-Zeitpunkt
 * (`limitAt`), `reopenCount`. Testwerte aus @SL-005 (2 x 6 Minuten, 1 Minute Pause), @SL-006, @SL-008.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseViewOf, type PhaseView } from '../phaseView';
import { REGEL_2X6, T0, spielAnlegen, zu, type EngineSpiel } from '../../__tests__/enginePhaseFixture';

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

describe('phaseViewOf: Grenze des Abschnitts (B-08b)', () => {
  it('@SL-005 erster Abschnitt 2 x 6 Minuten: Grenze bei Uhr 360000 ms, Wanduhr T0 + 360000', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(1_000);
    const phase = sicht(spiel);
    expect(phase.limitClockMs).toBe(360_000);
    expect(phase.limitAt).toBe(T0 + 360_000);
  });

  it('die Grenze wandert mit Pause und Weiter: 100 s gespielt, 100 s Pause -> Wanduhr T0 + 460000, Uhr bleibt 360000', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(100_000);
    await spiel.a.commands.pause(spiel.matchId, spiel.ctx, 'leitung');
    zu(200_000);
    await spiel.a.commands.resume(spiel.matchId, spiel.ctx, 'leitung');
    zu(201_000);
    const phase = sicht(spiel);
    expect(phase.limitClockMs).toBe(360_000);
    expect(phase.limitAt).toBe(T0 + 460_000);
  });

  it('Gegenbeispiel: angehalten gibt es keinen Zeitpunkt der Grenze', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(100_000);
    await spiel.a.commands.pause(spiel.matchId, spiel.ctx, 'leitung');
    zu(150_000);
    expect(sicht(spiel).limitAt).toBeNull();
  });

  it('@SL-006 zweiter Abschnitt beginnt bei Uhr 360000: Grenze bei 720000', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(360_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung', { clockMs: 360_000, at: T0 + 360_000 });
    zu(420_000);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(421_000);
    const phase = sicht(spiel);
    expect(phase.section).toBe(2);
    expect(phase.limitClockMs).toBe(720_000);
  });

  it('reopenCount zählt das Wiedereröffnen des Spiels', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(10_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    expect(sicht(spiel).reopenCount).toBe(0);
    zu(20_000);
    await spiel.a.commands.reopen(spiel.matchId, spiel.ctx, 'leitung');
    expect(sicht(spiel).reopenCount).toBe(1);
  });
});
