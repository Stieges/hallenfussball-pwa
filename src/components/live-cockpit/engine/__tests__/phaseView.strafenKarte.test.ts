/**
 * phaseViewOf: Dauer und Beginn der Zeitstrafe für die Strafen-Karte (Plan Cockpit v2 B3, @SL-186).
 * Testwerte aus dem Gherkin: @SL-013/@SL-029 (Strafe seit 2:00, Dauer aus den Turnierregeln), @SL-186 („Zeitstrafe 2 Min · seit Spielzeit …“).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseViewOf, type PhaseView } from '../phaseView';
import { REGEL_2X10, REGEL_2X6, spielAnlegen, zu, type EngineSpiel, type Geraet } from '../../__tests__/enginePhaseFixture';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); zu(0); });
afterEach(() => { vi.useRealTimers(); });

function sichtAuf(geraet: Geraet, spiel: EngineSpiel): PhaseView {
  const view = geraet.engine.view(spiel.matchId);
  if (!view) { throw new Error('keine Engine-Ansicht'); }
  return phaseViewOf(view.result.state, spiel.ctx, geraet.engine.serverNow());
}

describe('phaseViewOf: Zeitstrafe mit Dauer und Beginn', () => {
  it('@SL-186 Strafe bei 2:00, Dauer 2 Minuten: Dauer 120 s, seit Spielzeit 2:00, Rest sinkt mit der Uhr', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(120_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(150_000);
    const strafe = sichtAuf(spiel.a, spiel).penalties[0];
    expect(strafe.durationMs).toBe(120_000);
    expect(strafe.seitMs).toBe(120_000);
    expect(strafe.remainingMs).toBe(90_000);
  });

  it('@SL-186 Strafe aus der 1. Halbzeit (bei 9:00), jetzt läuft die 2.: kein „seit“ im Abschnitt, aber die Spielzeit des Beginns in der 1. Halbzeit', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(540_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(660_000);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    const strafe = sichtAuf(spiel.a, spiel).penalties[0];
    expect(strafe.seitMs).toBeNull();
    expect(strafe.seitErsteHalbzeitMs).toBe(540_000);
  });

  it('Gegenbeispiel: ohne Strafe ist die Liste leer, und außerhalb der Pause gibt es keine Pausenlänge', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(60_000);
    const sicht = sichtAuf(spiel.a, spiel);
    expect(sicht.penalties).toEqual([]);
    expect(sicht.breakTotalMs ?? null).toBeNull();
  });
});
