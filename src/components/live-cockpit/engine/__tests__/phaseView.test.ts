/**
 * phaseViewOf (B-08a): Abschnitt, Phase, Pausen-Restzeit, laufende Strafen, Strafstoß, Uhr-Korrekturen,
 * Entscheidungsart aus dem Engine-Zustand. Testwerte stammen aus den Gherkin-Szenarien
 * (docs/anforderungen/2026-10-02_spiel-leiten.md, Fundament @FU-073/074/075); der Code ist nur der Ansatzpunkt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveScoreFor } from '../../../../core/match';
import { viewDurationSeconds } from '../../../../core/match/client/viewDuration';
import { phaseViewOf, type PhaseView } from '../phaseView';
import {
  REGEL_2X6,
  REGEL_2X10,
  aktualisiereB,
  geraetBNeuLaden,
  spielAnlegen,
  zu,
  type EngineSpiel,
  type Geraet,
} from '../../__tests__/enginePhaseFixture';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
});

afterEach(() => {
  vi.useRealTimers();
});

function sichtAuf(geraet: Geraet, spiel: EngineSpiel): PhaseView {
  const view = geraet.engine.view(spiel.matchId);
  if (!view) {
    throw new Error('keine Engine-Ansicht');
  }
  return phaseViewOf(view.result.state, spiel.ctx, geraet.engine.serverNow());
}

function ereignisId(geraet: Geraet, spiel: EngineSpiel, type: string): string {
  const event = geraet.engine.view(spiel.matchId)?.log.find((candidate) => candidate.type === type);
  if (!event) {
    throw new Error(`kein ${type}-Ereignis`);
  }
  return event.id;
}

describe('phaseViewOf (B-08a)', () => {
  it('@SL-013 Die Uhr läuft weiter, während das Gerät gesperrt ist: 3:30, Strafe Rest 0:30', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(120_000);
    // Strafe seit 2:00, Standard-Dauer 2 Minuten (Record @SL-013 korrigiert).
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(210_000); // 90 Sekunden gesperrt, nichts gerendert
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.sectionElapsedMs).toBe(210_000);
    expect(phase.penalties).toHaveLength(1);
    expect(phase.penalties[0].remainingMs).toBe(30_000);
  });

  it('@FU-075 Gerät B neu geladen bei 6:00 zeigt Strafe Rest 1:00; angehalten bleibt sie stehen', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X6);
    zu(300_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(360_000);
    const b = await geraetBNeuLaden(spiel);
    const beiB = sichtAuf(b, spiel);
    expect(beiB.sectionElapsedMs).toBe(360_000);
    expect(beiB.penalties[0].remainingMs).toBe(60_000);

    await spiel.a.commands.pause(spiel.matchId, spiel.ctx, 'leitung');
    await aktualisiereB(spiel, b);
    zu(420_000);
    expect(sichtAuf(b, spiel).penalties[0].remainingMs).toBe(60_000);
    await spiel.a.commands.resume(spiel.matchId, spiel.ctx, 'leitung');
    await aktualisiereB(spiel, b);
    zu(450_000);
    expect(sichtAuf(b, spiel).penalties[0].remainingMs).toBe(30_000);
  });

  it('@FU-073 Strafe läuft über die Abschnittspause: Rest 1:00 in der Pause, 60 s Pause, Ende nach 1:00', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(540_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(600_000);
    const pause = sichtAuf(spiel.a, spiel);
    expect(pause.status).toBe('section_break');
    expect(pause.breakRemainingMs).toBe(60_000);
    expect(pause.penalties[0].remainingMs).toBe(60_000);

    zu(660_000);
    expect(sichtAuf(spiel.a, spiel).breakRemainingMs).toBe(0);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    expect(sichtAuf(spiel.a, spiel).penalties[0].remainingMs).toBe(60_000);

    zu(719_999);
    expect(sichtAuf(spiel.a, spiel).penalties[0].remainingMs).toBe(1);
    zu(720_000);
    expect(sichtAuf(spiel.a, spiel).penalties).toEqual([]);
  });

  it('Klemme: Pausen-Restzeit bleibt 0, wenn die Pause länger als breakSeconds dauert', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(900_000);
    expect(sichtAuf(spiel.a, spiel).breakRemainingMs).toBe(0);
  });

  it('@FU-074 Strafe läuft in die Verlängerung: 30 s vor Ende begonnen, Verlängerung zeigt Rest 1:30', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X10, knockout: true, tiebreak: 'overtime-then-shootout' as const };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(1_170_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(1_200_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    const overtime = sichtAuf(spiel.a, spiel);
    expect(overtime.phase).toBe('overtime');
    expect(overtime.penalties[0].remainingMs).toBe(90_000);
  });

  it('@SL-081 In der Verlängerung zählt die Grenze 3 Minuten ab dem Anpfiff; bei 2:00 steht die Uhr bei 2:00 von 3:00', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X10, knockout: true, tiebreak: 'overtime-then-shootout' as const };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(1_200_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(1_320_000);
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.sectionElapsedMs).toBe(120_000);
    expect(phase.sectionLimitMs).toBe(180_000);
  });

  it('Verlängerung mit Überhang der Regelzeit: Anpfiff bei 10:45, Grenze 13:45, wie viewDuration (#244)', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X6, sections: 1 as const, sectionSeconds: 600, knockout: true, tiebreak: 'overtime-then-shootout' as const };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(645_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(675_000);
    const state = spiel.a.engine.view(spiel.matchId)?.result.state;
    if (!state) {
      throw new Error('kein Zustand');
    }
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.sectionElapsedMs).toBe(30_000);
    expect(phase.sectionLimitMs).toBe(180_000);
    expect(viewDurationSeconds(state) * 1000).toBe(825_000);
  });

  it('B1 Verlängerung mit Bruchteil-Anpfiff (10:45,5): Grenze 3:00, Tafel-Sekunde gleich Monitor (viewDuration)', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X6, sections: 1 as const, sectionSeconds: 600, knockout: true, tiebreak: 'overtime-then-shootout' as const };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(645_500);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    const state = spiel.a.engine.view(spiel.matchId)?.result.state;
    if (!state) {
      throw new Error('kein Zustand');
    }
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.sectionLimitMs).toBe(180_000);
    expect(Math.floor(state.sectionStartMs / 1000) * 1000 + phase.sectionLimitMs).toBe(viewDurationSeconds(state) * 1000);
    // Tafel (Restsekunde aus Grenze und Abschnittszeit) gegen Monitor (viewDuration − floor(Spielzeit)),
    // je einmal knapp nach dem Anpfiff, nahe der Sekundengrenze und kurz davor.
    for (const elapsedMs of [645_500, 646_200, 646_700]) {
      zu(elapsedMs);
      const beiZeit = sichtAuf(spiel.a, spiel);
      const tafelRest = beiZeit.sectionLimitMs / 1000 - Math.floor(beiZeit.sectionElapsedMs / 1000);
      const monitorRest = viewDurationSeconds(state) - Math.floor(elapsedMs / 1000);
      expect(tafelRest).toBe(monitorRest);
    }
  });

  it('@SL-097 Abpfiff bei 6:00 im zweiten Abschnitt beendet die Strafe von 5:00: keine Strafe mehr', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(660_000);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(960_000); // 5:00 im zweiten Abschnitt
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    zu(1_020_000); // 6:00 im zweiten Abschnitt
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.status).toBe('finished');
    expect(phase.sectionElapsedMs).toBe(360_000);
    expect(phase.penalties).toEqual([]);
  });
  it('Gegenbeispiel: zurückgenommene Strafe erscheint nicht, auch nicht auf Gerät B', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(300_000);
    await spiel.a.commands.timePenalty(spiel.matchId, spiel.ctx, 'leitung', 'teamb');
    await spiel.a.commands.retract(spiel.matchId, spiel.ctx, 'leitung', ereignisId(spiel.a, spiel, 'TIME_PENALTY'));
    zu(360_000);
    expect(sichtAuf(spiel.a, spiel).penalties).toEqual([]);
    const b = await geraetBNeuLaden(spiel);
    expect(sichtAuf(b, spiel).penalties).toEqual([]);
  });

  it('Gruppenspiel: Entscheidungsart ist null, auch wenn die Regel eine nennt', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', { ...REGEL_2X6, tiebreak: 'shootout' });
    zu(720_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.status).toBe('finished');
    expect(phase.tiebreakMode).toBeNull();
  });

  it('@SL-053 Unentschieden 1:1 bei Ablauf: Strafstoßschießen beginnt, Entscheidungsart shootout', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X6, knockout: true, tiebreak: 'shootout' as const, shootersPerTeam: 1 };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(100_000);
    await spiel.a.commands.goal(spiel.matchId, spiel.ctx, 'leitung', 'teama', false);
    zu(200_000);
    await spiel.a.commands.goal(spiel.matchId, spiel.ctx, 'leitung', 'teamb', false);
    zu(720_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    const state = spiel.a.engine.view(spiel.matchId)?.result.state;
    expect(state && effectiveScoreFor(state, 'teama')).toBe(1);
    expect(state && effectiveScoreFor(state, 'teamb')).toBe(1);
    const phase = sichtAuf(spiel.a, spiel);
    expect(phase.status).toBe('shootout');
    expect(phase.tiebreakMode).toBe('shootout');
    expect(phase.shootout).toEqual({
      kicks: { teama: 0, teamb: 0 },
      goals: { teama: 0, teamb: 0 },
      winner: null,
      nextTeam: 'teama',
    });
  });
  it('Strafstoßschießen: Sieger nach einem Treffer gegen einen Fehlschuss, dann kein nächster Schütze', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X6, knockout: true, tiebreak: 'shootout' as const, shootersPerTeam: 1 };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(720_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    await spiel.a.commands.recordShot(spiel.matchId, spiel.ctx, 'leitung', 'teama', true);
    await spiel.a.commands.recordShot(spiel.matchId, spiel.ctx, 'leitung', 'teamb', false);
    const shootout = sichtAuf(spiel.a, spiel).shootout;
    expect(shootout?.goals.teama).toBe(1);
    expect(shootout?.winner).toBe('teama');
    expect(shootout?.nextTeam).toBeNull();
  });

  it('@TM-051 Entscheidungsart je Runde: Golden Goal in der K.-o.-Runde', async () => {
    const spiel = await spielAnlegen();
    const ko = { ...REGEL_2X6, knockout: true, tiebreak: 'goldenGoal' as const };
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', ko);
    zu(720_000);
    await spiel.a.commands.finish(spiel.matchId, spiel.ctx, 'leitung');
    expect(sichtAuf(spiel.a, spiel).tiebreakMode).toBe('goldenGoal');
  });

  it('Uhr-Korrektur: earliestAdjustMs folgt dem letzten Ereignis des Abschnitts, Korrektur steht im Log', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(120_000);
    await spiel.a.commands.goal(spiel.matchId, spiel.ctx, 'leitung', 'teama', false);
    zu(200_000);
    expect(sichtAuf(spiel.a, spiel).earliestAdjustMs).toBe(120_000);

    await spiel.a.commands.adjustClock(spiel.matchId, spiel.ctx, 'leitung', 110_000, 200_000);
    expect(sichtAuf(spiel.a, spiel).clockAdjustments).toEqual([
      expect.objectContaining({ clockMs: 110_000, previousClockMs: 200_000 }),
    ]);
  });

  // Befund (Spur A, ZA-3): CLOCK_ADJUST ist nicht rücknehmbar (RETRACTABLE_EVENT_TYPES, @SL-109).
  // Der Test bleibt rot, bis die Engine die Rücknahme kann; er wird nicht an den Code angepasst.
  it.fails('@SL-109 zurückgenommene Uhr-Korrektur fällt aus clockAdjustments (Befund ZA-3)', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(200_000);
    await spiel.a.commands.adjustClock(spiel.matchId, spiel.ctx, 'leitung', 110_000, 200_000);
    await spiel.a.commands.retract(spiel.matchId, spiel.ctx, 'leitung', ereignisId(spiel.a, spiel, 'CLOCK_ADJUST'));
    expect(sichtAuf(spiel.a, spiel).clockAdjustments).toEqual([]);
  });

  it('@SL-014 Neustart bei 4:00: Anzeige 4:00, Stand 1:0, das Tor steht im bestätigten Log', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(130_000);
    await spiel.a.commands.goal(spiel.matchId, spiel.ctx, 'leitung', 'teama', false);
    zu(180_000); // Tablet geht bei 3:00 aus, es wird nichts geschrieben
    zu(240_000); // Neustart bei 4:00
    const neu = await geraetBNeuLaden(spiel);
    expect(sichtAuf(neu, spiel).sectionElapsedMs).toBe(240_000);
    const state = neu.engine.view(spiel.matchId)?.result.state;
    expect(state && effectiveScoreFor(state, 'teama')).toBe(1);
    expect(state && effectiveScoreFor(state, 'teamb')).toBe(0);
    expect(state?.goals).toHaveLength(1);
  });

  it('Gegenbeispiel: zurückgenommenes Tor bestimmt earliestAdjustMs nicht mehr', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    zu(120_000);
    await spiel.a.commands.goal(spiel.matchId, spiel.ctx, 'leitung', 'teama', false);
    zu(200_000);
    expect(sichtAuf(spiel.a, spiel).earliestAdjustMs).toBe(120_000);
    await spiel.a.commands.retract(spiel.matchId, spiel.ctx, 'leitung', ereignisId(spiel.a, spiel, 'GOAL'));
    expect(sichtAuf(spiel.a, spiel).earliestAdjustMs).toBe(0);
  });

  it('Abschnittsfelder: letzter regulärer Abschnitt und Abschnittszahl', async () => {
    const spiel = await spielAnlegen();
    await spiel.a.commands.start(spiel.matchId, spiel.ctx, 'leitung', REGEL_2X10);
    const erster = sichtAuf(spiel.a, spiel);
    expect(erster).toMatchObject({ section: 1, sections: 2, isLastRegularSection: false, sectionLimitMs: 600_000 });
    expect(erster.breakRemainingMs).toBeNull();
    zu(600_000);
    await spiel.a.commands.endSection(spiel.matchId, spiel.ctx, 'leitung');
    zu(660_000);
    await spiel.a.commands.startSection(spiel.matchId, spiel.ctx, 'leitung');
    // Die Uhr setzt bei 10:00 wieder an: der Abschnitt beginnt bei 0, die Pause ist vorbei.
    expect(sichtAuf(spiel.a, spiel)).toMatchObject({ section: 2, isLastRegularSection: true, sectionElapsedMs: 0 });
    zu(690_000);
    expect(sichtAuf(spiel.a, spiel)).toMatchObject({ sectionElapsedMs: 30_000, breakRemainingMs: null });
  });
});
