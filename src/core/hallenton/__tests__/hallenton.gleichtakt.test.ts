/**
 * Gleichtakt mit Cockpit und Monitor: @HT-004, @HT-005, @HT-006, @HT-010, @HT-029 (Logik-Teil) und der Gleichlauf-Test
 * „Cockpit und Lautsprecher berechnen für dieselbe Lage dieselbe Grenze“. Testskelett aus dem Gherkin.
 * Grenze des Cockpits = `PhaseView.limitAt` (danach endet der Abschnitt von selbst, `useAutoSectionEnd`), 00:00 am Monitor =
 * `monitorUhrOf` aus `live_state` (`cacheColumns`).
 */
import { describe, expect, it } from 'vitest';
import { ClockSync } from '../../match/client/ClockSync';
import { cacheColumns } from '../../match/client/cacheColumns';
import { phaseViewOf } from '../../match/client/phaseView';
import { monitorUhrOf } from '../../view/monitorUhr';
import type { ClockMode } from '../../match/clockDisplay';
import type { EngineEvent, MatchContext, MatchState } from '../../match';
import { LEERES_GEDAECHTNIS, planeHallToene, uhrsprungMs, type FeldStand } from '..';
import {
  ABSCHNITT_MS, CTX_11, CTX_HF, ENDE_A2, T0, ev, koRegeln, lauf, server, stand, stateAus, zweiterAbschnitt,
} from './hallentonFixtures';

/** Zeitpunkt des geplanten Tons für einen Stand (Stand am Server, frische Antwort). */
function tonZeit(state: MatchState, ctx: MatchContext, serverNow: number): number | undefined {
  const plan = planeHallToene({ felder: [stand(state, ctx, server(0), serverNow)], serverNow }, LEERES_GEDAECHTNIS);
  return plan.toene[0]?.at;
}

/** Erster Zeitpunkt in [von, bis] (Raster 10 ms), an dem der Monitor 00:00 zeigt. */
function monitorNullUm(state: MatchState, ctx: MatchContext, clockMode: ClockMode, von: number, bis: number): number | null {
  const rules = state.rules;
  if (!rules) {
    return null;
  }
  const liveState = cacheColumns(state, ctx).live_state;
  const clockRules = { sections: rules.sections, sectionSeconds: rules.sectionSeconds, overtimeSeconds: rules.overtimeSeconds, clockMode };
  for (let jetzt = von; jetzt <= bis; jetzt += 10) {
    const uhr = monitorUhrOf({ match: { isLive: true, clockRules }, liveState, nowMs: jetzt });
    if (uhr?.restSekunden === 0) {
      return jetzt;
    }
  }
  return null;
}

/** Lagen für den Gleichlauf: laufend, nach Pause, nach Korrektur, in der Verlängerung mit krummem Anpfiff. */
function gleichlaufLagen(): Array<{ name: string; ctx: MatchContext; log: EngineEvent[]; jetzt: number }> {
  const zweiter = zweiterAbschnitt();
  const pause = ENDE_A2 - 8000;
  const koLog = [
    ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln('overtime-then-shootout') } }),
    ev('SECTION_END', T0 + 300_000, 1, 300_000),
    ev('SECTION_START', T0 + 360_000, 2, null),
    // Abpfiff von Hand 437 ms nach Ablauf: die Verlängerung beginnt bei krummer Spielzeit
    ev('MATCH_END', T0 + 660_437, 2, 600_437),
    ev('SECTION_START', T0 + 720_000, 3, null),
  ];
  return [
    { name: 'zweiter Abschnitt läuft', ctx: CTX_11, log: zweiter, jetzt: ENDE_A2 - 60_000 },
    {
      name: 'nach 20 s Pause weiter',
      ctx: CTX_11,
      log: [...zweiter, ev('PAUSE', pause, 2, null), ev('RESUME', pause + 20_000, 2, null)],
      jetzt: pause + 21_000,
    },
    { name: 'Uhr korrigiert', ctx: CTX_11, log: [...zweiter, ev('CLOCK_ADJUST', ENDE_A2 - 90_000, 2, 2 * ABSCHNITT_MS - 120_000)], jetzt: ENDE_A2 - 80_000 },
    { name: 'Verlängerung mit krummem Anpfiff', ctx: CTX_HF, log: koLog, jetzt: T0 + 800_000 },
  ];
}

describe('Gleichlauf: Cockpit und Lautsprecher berechnen für dieselbe Lage dieselbe Grenze', () => {
  for (const lage of gleichlaufLagen()) {
    it(`@HT-004 ${lage.name}: Ton des Lautsprechers genau auf der Grenze des Cockpits`, () => {
      const state = stateAus(lage.log, lage.ctx);
      const cockpitGrenze = phaseViewOf(state, lage.ctx, lage.jetzt).limitAt;
      expect(cockpitGrenze).not.toBeNull();
      expect(tonZeit(state, lage.ctx, lage.jetzt)).toBe(cockpitGrenze);
    });

    it(`@HT-004 ${lage.name}: Ton höchstens 1 s neben der 00:00 am Monitor`, () => {
      const state = stateAus(lage.log, lage.ctx);
      const ton = tonZeit(state, lage.ctx, lage.jetzt);
      expect(ton).toBeDefined();
      const null00 = monitorNullUm(state, lage.ctx, 'immer-durchlaufend', lage.jetzt, (ton ?? 0) + 2000);
      expect(null00).not.toBeNull();
      expect(Math.abs((ton ?? 0) - (null00 ?? 0))).toBeLessThanOrEqual(1000);
    });
  }
});

describe('@HT-004 Der Hallenton liegt höchstens etwa 1 Sekunde neben dem Cockpit-Ton', () => {
  it('@HT-004 Uhr-Art „immer durchlaufend“, Toms Handy hat Netz: Abpfiff-Ton höchstens 1 s neben Toms Cockpit und der 00:00 am Monitor', () => {
    const log = zweiterAbschnitt();
    const state = stateAus(log);
    const cockpit = phaseViewOf(state, CTX_11, ENDE_A2 - 10_000).limitAt ?? 0;
    const ende = [...log, ev('MATCH_END', cockpit, 2, 2 * ABSCHNITT_MS)];
    const felder = (jetzt: number): FeldStand[] =>
      [stand(stateAus(jetzt < cockpit + 300 ? log : ende), CTX_11, server(0), jetzt < cockpit + 300 ? T0 : cockpit + 300)];
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, ENDE_A2 + 5000);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpit)).toBeLessThanOrEqual(1000);
    const monitor = monitorNullUm(state, CTX_11, 'immer-durchlaufend', ENDE_A2 - 3000, ENDE_A2 + 3000) ?? 0;
    expect(Math.abs(gespielt[0].at - monitor)).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-005 Angehaltene Uhr kurz vor Schluss verschiebt den Hallenton mit', () => {
  // zweiter Abschnitt bei 5:50 → 10 s vor dem Ende; Tom hält bei 5:52 für 20 Sekunden an
  const log = zweiterAbschnitt();
  const bei552 = ENDE_A2 - 8000;
  const angehalten = [...log, ev('PAUSE', bei552, 2, null)];
  const weiter = [...angehalten, ev('RESUME', bei552 + 20_000, 2, null)];
  const cockpitEnde = phaseViewOf(stateAus(weiter), CTX_11, bei552 + 20_000).limitAt ?? 0;
  const felder = (jetzt: number): FeldStand[] => {
    if (jetzt < bei552 + 300) {
      return [stand(stateAus(log), CTX_11, server(0), T0)];
    }
    if (jetzt < bei552 + 20_300) {
      return [stand(stateAus(angehalten), CTX_11, server(0), bei552 + 300)];
    }
    return [stand(stateAus(weiter), CTX_11, server(0), bei552 + 20_300)];
  };

  it('@HT-005 während der angehaltenen 20 Sekunden ertönt kein Ton', () => {
    expect(lauf(felder, ENDE_A2 - 10_000, bei552 + 20_000, 100).gespielt).toEqual([]);
  });

  it('@HT-005 der Abpfiff-Ton ertönt höchstens 1 s vor oder nach dem Abpfiff-Ton in Toms Cockpit', () => {
    const { gespielt } = lauf(felder, ENDE_A2 - 10_000, cockpitEnde + 5000, 100);
    expect(gespielt).toHaveLength(1);
    expect(cockpitEnde).toBe(ENDE_A2 + 20_000);
    expect(Math.abs(gespielt[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
  });

  it('@HT-005 ab etwa 15 Sekunden vor dem errechneten Ende fragt das Gerät jede Sekunde nach (Im Einzelnen)', () => {
    const plan = (jetzt: number) => planeHallToene({ felder: felder(jetzt), serverNow: jetzt }, LEERES_GEDAECHTNIS);
    expect(plan(ENDE_A2 - 30_000).abfrageTaktMs).toBeNull();
    expect(plan(ENDE_A2 - 15_000).abfrageTaktMs).toBe(1000);
  });

  it('@HT-005 während der angehaltenen 20 Sekunden fragt das Gerät jede Sekunde nach (Uhr steht 8 s vor dem Ende)', () => {
    const plan = (jetzt: number) => planeHallToene({ felder: felder(jetzt), serverNow: jetzt }, LEERES_GEDAECHTNIS);
    for (const jetzt of [bei552 + 1000, bei552 + 10_000, bei552 + 19_000]) {
      expect(plan(jetzt).abfrageTaktMs).toBe(1000);
    }
  });

  it('@HT-005 Gegenprobe: steht die Uhr weit vor dem Ende, bleibt der normale Takt', () => {
    const frueh = [...log, ev('PAUSE', ENDE_A2 - 120_000, 2, null)];
    const plan = planeHallToene({ felder: [stand(stateAus(frueh), CTX_11, server(0), ENDE_A2 - 119_700)], serverNow: ENDE_A2 - 100_000 }, LEERES_GEDAECHTNIS);
    expect(plan.abfrageTaktMs).toBeNull();
  });
});

describe('@HT-006 Eine korrigierte Uhr verschiebt den Hallenton', () => {
  it('@HT-006 bei 4:30 auf 4:00 korrigiert: Abpfiff-Ton erst bei Ablauf der korrigierten Spielzeit, höchstens 1 s neben Toms Cockpit', () => {
    const log = zweiterAbschnitt();
    const bei430 = ENDE_A2 - 90_000;
    const korrigiert = [...log, ev('CLOCK_ADJUST', bei430, 2, ABSCHNITT_MS + 240_000)];
    const cockpitEnde = phaseViewOf(stateAus(korrigiert), CTX_11, bei430).limitAt ?? 0;
    expect(cockpitEnde).toBe(ENDE_A2 + 30_000);
    const felder = (jetzt: number): FeldStand[] =>
      [jetzt < bei430 + 300 ? stand(stateAus(log), CTX_11, server(0), T0) : stand(stateAus(korrigiert), CTX_11, server(0), bei430 + 300)];
    const { gespielt } = lauf(felder, ENDE_A2 - 5000, cockpitEnde + 5000, 100);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-010 Eine falsch gehende Uhr am Lautsprecher-Gerät verschiebt den Ton nicht', () => {
  it('@HT-010 die Uhr des Rechners geht 20 s vor: Abpfiff-Ton höchstens 1 s neben Toms Cockpit', async () => {
    const state = stateAus(zweiterAbschnitt());
    const cockpitEnde = phaseViewOf(state, CTX_11, ENDE_A2 - 60_000).limitAt ?? 0;
    // Gerät geht 20 s vor; der Abgleich mit dem Server (Laufzeit 0) misst den Abstand
    let geraet = ENDE_A2 - 60_000 + 20_000;
    const sync = new ClockSync(async () => geraet - 20_000, () => geraet, { get: () => null, set: () => undefined });
    expect(await sync.sync()).toBe(true);
    const plan = planeHallToene({ felder: [stand(state, CTX_11, server(0), sync.serverNow())], serverNow: sync.serverNow() }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toHaveLength(1);
    // der Ton ist in Serverzeit geplant; fällig wird er, wenn die abgeglichene Uhr ihn erreicht
    expect(Math.abs(plan.toene[0].at - cockpitEnde)).toBeLessThanOrEqual(1000);
    geraet = plan.toene[0].at + 20_000;
    expect(Math.abs(sync.serverNow() - cockpitEnde)).toBeLessThanOrEqual(1000);
  });

  it('@HT-010 springt die Geräteuhr im Spiel um 20 s vor, erkennt das Gerät den Sprung; nach neuem Abgleich liegt der Ton wieder auf der Grenze', async () => {
    const state = stateAus(zweiterAbschnitt());
    const cockpitEnde = phaseViewOf(state, CTX_11, ENDE_A2 - 60_000).limitAt ?? 0;
    let server = ENDE_A2 - 60_000;
    let sprung = 0;
    let mono = 0;
    const sync = new ClockSync(async () => server, () => server + sprung, { get: () => null, set: () => undefined });
    await sync.sync();
    const vorher = { wandMs: server + sprung, monoMs: mono };
    // 5 s später stellt das System die Uhr 20 s vor
    server += 5000;
    mono += 5000;
    sprung = 20_000;
    expect(uhrsprungMs(vorher, { wandMs: server + sprung, monoMs: mono })).toBe(20_000);
    // ohne neuen Abgleich läge die Planzeit 20 s daneben; nach dem Abgleich plant das Gerät wieder genau
    expect(sync.serverNow() - server).toBe(20_000);
    await sync.sync();
    const jetzt = sync.serverNow();
    const plan = planeHallToene({ felder: [stand(state, CTX_11, { art: 'server', antwortAlterMs: 0 }, jetzt)], serverNow: jetzt }, LEERES_GEDAECHTNIS);
    expect(plan.toene[0].at).toBe(cockpitEnde);
    expect(jetzt).toBe(server);
  });
});

describe('@HT-029 Der Lautsprecher gibt den Abpfiff-Ton auch minimiert oder verdeckt (Logik-Teil)', () => {
  it('@HT-029 hält Tom die Uhr zwischendurch 30 Sekunden an, ertönt er entsprechend 30 Sekunden später, genau einmal', () => {
    const log = zweiterAbschnitt();
    const halt = ENDE_A2 - 100_000;
    const weiter = [...log, ev('PAUSE', halt, 2, null), ev('RESUME', halt + 30_000, 2, null)];
    const felder = (jetzt: number): FeldStand[] =>
      [jetzt < halt + 300 ? stand(stateAus(log), CTX_11, server(0), T0) : stand(stateAus(weiter), CTX_11, server(0), halt + 30_300)];
    const { gespielt } = lauf(felder, ENDE_A2 - 2000, ENDE_A2 + 35_000, 100);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - (ENDE_A2 + 30_000))).toBeLessThanOrEqual(1000);
  });
});
