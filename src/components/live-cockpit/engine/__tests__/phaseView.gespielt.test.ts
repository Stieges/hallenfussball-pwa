/**
 * phaseViewOf: ganze gespielte und geplante Zeit für die Tafel nach dem Ende (@SL-169). Spiel 2 × 6 Minuten, 1 Minute Pause.
 * Die gespielte Zeit zählt alle Abschnitte (Pausen nicht), die geplante Zeit alle regulären Abschnitte.
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

/** Erster Abschnitt voll, eine Minute Pause, zweiter Abschnitt beginnt bei Wanduhr 420 s (Spieluhr 360 s). */
async function zweiterAbschnitt(spiel: EngineSpiel): Promise<void> {
  await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
  zu(360_000);
  await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung', { clockMs: 360_000, at: T0 + 360_000 });
  zu(420_000);
  await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
}

describe('phaseViewOf: playedMs und plannedMs (@SL-169)', () => {
  it('@SL-169 Abpfiff in der 2. Halbzeit nach 4:00 Spielzeit des Abschnitts: gespielt 10:00 von geplant 12:00 (die Pause zählt nicht)', async () => {
    const spiel = await spielAnlegen();
    await zweiterAbschnitt(spiel);
    zu(420_000 + 240_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const phase = sicht(spiel);
    expect(phase.status).toBe('finished');
    expect(phase.playedMs).toBe(600_000);
    expect(phase.plannedMs).toBe(720_000);
    expect(phase.sectionElapsedMs).toBe(240_000); // der Abschnitt allein wäre 4:00: die Tafel darf ihn nicht als gespielte Zeit zeigen
  });

  it('@SL-169 Abpfiff von Hand im ersten Abschnitt nach 3:00: gespielt 3:00 von geplant 12:00', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(180_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const phase = sicht(spiel);
    expect([phase.playedMs, phase.plannedMs]).toEqual([180_000, 720_000]);
  });

  it('@SL-169 Gegenbeispiel: die gespielte Zeit läuft nach dem Abpfiff nicht weiter', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(180_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    zu(900_000);
    expect(sicht(spiel).playedMs).toBe(180_000);
  });
});
