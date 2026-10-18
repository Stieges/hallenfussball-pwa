/**
 * toScoreboardModel (Aufgabe 2.4) -- Testwerte und Wortlaut aus dem Gherkin der Anforderung
 * `2026-10-02_spiel-leiten.md` (Beispielturnier „Hallencup Süd“: 2 × 6 Minuten, Halbzeitpause 1 Minute,
 * Verlängerung 3 Minuten) und `2026-10-02_zuschauer-und-monitor.md` (@ZM-139). Der Code wurde erst danach gelesen.
 * Die Übersetzung ist ein Schlüssel-Stub: geprüft wird der Inhalt (Zahl, Team, Schlüssel), nicht der Wortlaut.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, formatUhr, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);

const min = (m: number, s = 0): number => (m * 60 + s) * 1000;

/** Spiel 11 FC Nord – SV Süd, zweiter Abschnitt zu 6 Minuten, die Uhr läuft (falls nicht anders gesagt). */
function input(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}, matchStatus: 'RUNNING' | 'FINISHED' = 'RUNNING'): ScoreboardInput {
  const v = makePhaseView({ sectionLimitMs: min(6), ...view });
  return {
    match: makeLiveMatch({ homeScore: 1, awayScore: 0 }),
    phase: cockpitPhaseOf({ view: v, matchStatus, leer: null }),
    view: v, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten',
    eintraegeWarten: 0, helferAnfragen: 0, jetztMs: Date.parse('2026-11-28T10:20:00.000Z'),
    ...extra,
  };
}

describe('toScoreboardModel: Restzeit und Spielzeit', () => {
  it('@ZM-139 zweiter Abschnitt bei gespielten 4:10: die Uhr steht bei 1:50 Restzeit, die Spielzeit steht klein darunter', () => {
    const m = toScoreboardModel(input({ sectionElapsedMs: min(4, 10) }), t);
    expect(m.uhr).toMatchObject({ rest: '1:50', gespielt: '4:10' });
  });

  it('formatUhr: Minuten ohne führende Null, Sekunden zweistellig, nie negativ', () => {
    expect([formatUhr(0), formatUhr(59), formatUhr(60), formatUhr(110), formatUhr(600), formatUhr(-5)]).toEqual(['0:00', '0:59', '1:00', '1:50', '10:00', '0:00']);
  });

  it('@SL-004 angehaltene Uhr: sie steht bei gespielten 4:10, markiert, mit dem Hinweis „Uhr steht“; der Zustand bleibt Live', () => {
    const m = toScoreboardModel(input({ status: 'paused', sectionElapsedMs: min(4, 10) }), t);
    expect(m.uhr).toMatchObject({ gespielt: '4:10', rest: '1:50', steht: true, hervorgehoben: true });
    expect(m.zustandText).toBe('tafel.zustand.live');
    expect(m.hinweise).toContain('tafel.uhrSteht');
  });

  it('@SL-004 Gegenbeispiel: eine laufende Uhr steht nicht und trägt keinen Hinweis „Uhr steht“', () => {
    const m = toScoreboardModel(input({ sectionElapsedMs: min(4, 10) }), t);
    expect(m.uhr?.steht).toBe(false);
    expect(m.hinweise).not.toContain('tafel.uhrSteht');
  });
});

describe('toScoreboardModel: Hinweis und Farbe der Uhr nach Uhr-Art', () => {
  // @SL-003 (Szenariogrundriss, zweiter Abschnitt zu 6 Minuten, Schlussphase 1 Minute)
  it.each<[string, ScoreboardInput['uhrArt'], number, boolean, boolean]>([
    ['„durchlaufend, letzte Minute angehalten“ bei 4:59: kein Hinweis, ohne Hervorhebung', 'durchlaufend-letzte-minute-angehalten', min(4, 59), false, false],
    ['„durchlaufend, letzte Minute angehalten“ bei 5:00: Schlussphasen-Farbe, ohne Zusatztext', 'durchlaufend-letzte-minute-angehalten', min(5), false, true],
    ['„immer angehalten“ bei 1:00: Hinweis zum Anhalten, ohne Schlussphasen-Farbe', 'immer-angehalten', min(1), true, false],
    ['„immer angehalten“ bei 5:30: Hinweis bleibt, eine Schlussphase gibt es nicht', 'immer-angehalten', min(5, 30), true, false],
    ['„immer durchlaufend“ bei 5:30: kein Hinweis, ohne Hervorhebung', 'immer-durchlaufend', min(5, 30), false, false],
  ])('@SL-003 %s', (_name, uhrArt, elapsed, hinweisText, schlussphase) => {
    const m = toScoreboardModel(input({ sectionElapsedMs: elapsed }, { uhrArt }), t);
    expect(m.hinweise.includes('tafel.uhrHaelt')).toBe(hinweisText);
    expect(m.uhr?.schlussphase).toBe(schlussphase);
    if (!hinweisText && !schlussphase) { expect(m.uhr?.hervorgehoben).toBe(false); }
  });

  it('@SL-069 im ersten Abschnitt gibt es bei 5:00 keinen Hinweis zum Anhalten und keine Schlussphase', () => {
    const m = toScoreboardModel(input({ section: 1, isLastRegularSection: false, sectionElapsedMs: min(5) }), t);
    expect(m.hinweise).not.toContain('tafel.uhrHaelt');
    expect(m.uhr?.schlussphase).toBe(false);
    expect(m.uhr?.hervorgehoben).toBe(false);
  });

  it('@SL-136 Schlussphase von 2 Minuten: bei 3:59 kein Hinweis und keine Hervorhebung, ab 4:00 die Schlussphasen-Farbe', () => {
    const davor = toScoreboardModel(input({ sectionElapsedMs: min(3, 59) }, { schlussphaseMinuten: 2 }), t);
    expect(davor.hinweise).not.toContain('tafel.uhrHaelt');
    expect(davor.uhr).toMatchObject({ schlussphase: false, hervorgehoben: false });
    const ab = toScoreboardModel(input({ sectionElapsedMs: min(4) }, { schlussphaseMinuten: 2 }), t);
    expect(ab.uhr?.schlussphase).toBe(true);
    expect(ab.hinweise).not.toContain('tafel.uhrHaelt');
  });

  it('@SL-136 Gegenbeispiel: mit der Vorgabe von 1 Minute beginnt die Schlussphase nicht schon bei 4:00', () => {
    expect(toScoreboardModel(input({ sectionElapsedMs: min(4) }), t).uhr?.schlussphase).toBe(false);
  });

  it('@SL-081 Verlängerung von 3 Minuten: bei 2:00 beginnt die Schlussphase, bei 1:59 noch nicht', () => {
    const verl = { phase: 'overtime' as const, tiebreakMode: 'overtime-then-shootout' as const, section: 3, isLastRegularSection: true, sectionLimitMs: min(3) };
    const bei2 = toScoreboardModel(input({ ...verl, sectionElapsedMs: min(2) }), t);
    expect(bei2.uhr).toMatchObject({ schlussphase: true, rest: '1:00' });
    expect(toScoreboardModel(input({ ...verl, sectionElapsedMs: min(1, 59) }), t).uhr?.schlussphase).toBe(false);
  });

  it('@SL-081 Gegenbeispiel: in der Verlängerung gilt die Uhr-Art – „immer durchlaufend“ hat dort keine Schlussphase', () => {
    const m = toScoreboardModel(input({ phase: 'overtime', tiebreakMode: 'overtime-then-shootout', section: 3, sectionLimitMs: min(3), sectionElapsedMs: min(2) }, { uhrArt: 'immer-durchlaufend' }), t);
    expect(m.uhr?.schlussphase).toBe(false);
  });
});

describe('toScoreboardModel: Zustand, Abschnitt und Stand', () => {
  it('@SL-005 Halbzeitpause: „Halbzeit“ mit der Pausen-Restzeit von 1:00; die Uhr der Pause zeigt keine Spielzeit', () => {
    const m = toScoreboardModel(input({ status: 'section_break', section: 1, isLastRegularSection: false, breakRemainingMs: min(1) }), t);
    expect(m.zustandText).toBe('tafel.zustand.halbzeit');
    expect(m.uhr).toMatchObject({ rest: '1:00', gespielt: null });
    expect(m.hinweise).not.toContain('tafel.wiederanpfiffJetzt');
  });

  it('@SL-070 ist die Pausen-Restzeit 0:00, bleibt sie dort stehen und die Tafel weist deutlich auf den Wiederanpfiff hin', () => {
    const m = toScoreboardModel(input({ status: 'section_break', section: 1, isLastRegularSection: false, breakRemainingMs: 0 }), t);
    expect(m.uhr).toMatchObject({ rest: '0:00', hervorgehoben: true });
    expect(m.hinweise).toContain('tafel.wiederanpfiffJetzt');
  });

  it('@SL-009 @SL-073 abgepfiffen mit 2:1: die Tafel zeigt „Abgepfiffen“ mit dem Endstand, auch ohne Ton', () => {
    const m = toScoreboardModel(input({ status: 'finished', sectionElapsedMs: min(6) }, { match: makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1 }) }, 'FINISHED'), t);
    expect(m.zustandText).toBe('tafel.zustand.abgepfiffen');
    expect(m.ton).toBe('ende');
    expect([m.links.tore, m.rechts.tore]).toEqual([2, 1]);
    expect(m.ariaStand).toBe('tafel.ariaStand:{"links":"FC Nord","linksTore":2,"rechts":"SV Süd","rechtsTore":1}');
  });

  it('@SL-082 Golden Goal: der Abschnitt heißt „Golden Goal“, der Zustand bleibt Live', () => {
    const m = toScoreboardModel(input({ phase: 'overtime', tiebreakMode: 'goldenGoal', sectionLimitMs: min(3), sectionElapsedMs: min(1) }), t);
    expect(m.abschnittText).toBe('tafel.abschnitt.goldenGoal');
    expect(m.zustandText).toBe('tafel.zustand.live');
    expect(m.ton).toBe('live');
  });

  it('@SL-081 Verlängerung: der Abschnitt heißt „Verlängerung“', () => {
    const m = toScoreboardModel(input({ phase: 'overtime', tiebreakMode: 'overtime-then-shootout', sectionLimitMs: min(3), sectionElapsedMs: min(1) }), t);
    expect(m.abschnittText).toBe('tafel.abschnitt.verlaengerung');
  });

  it('@SL-053 Strafstoßschießen beginnt: die Tafel zeigt „Strafstoßschießen“, die Schüsse als Stand und wer am Schuss ist', () => {
    const view = { status: 'shootout' as const, phase: 'shootout' as const,
      shootout: { kicks: { 'fc-nord': 3, 'sv-sued': 2 }, goals: { 'fc-nord': 2, 'sv-sued': 1 }, winner: null, nextTeam: 'sv-sued' } };
    const m = toScoreboardModel(input(view, { match: makeLiveMatch({ homeScore: 1, awayScore: 1 }) }), t);
    expect(m.zustandText).toBe('tafel.zustand.strafstoss');
    expect(m.uhr).toMatchObject({ rest: '2:1', unterzeile: 'tafel.unterzeile.amSchuss:{"team":"SV Süd"}' });
  });

  it('@FU-072 bei drei Abschnitten steht „Abschnitt 2 von 3“ statt „2. Halbzeit“', () => {
    const m = toScoreboardModel(input({ section: 2, sections: 3, isLastRegularSection: false }), t);
    expect(m.abschnittText).toBe('tafel.abschnitt.vonN:{"nummer":2,"gesamt":3}');
  });

  it('bei zwei Abschnitten heißt der zweite „2. Halbzeit“', () => {
    expect(toScoreboardModel(input({ section: 2 }), t).abschnittText).toBe('tafel.abschnitt.halbzeit:{"nummer":2}');
  });

  it('@SL-065 getauschte Seiten: links steht SV Süd mit seinem Stand, rechts FC Nord (Stand weiter 1:0 für FC Nord)', () => {
    const m = toScoreboardModel(input({}, { links: 'away', rechts: 'home' }), t);
    expect(m.links).toMatchObject({ name: 'SV Süd', tore: 0 });
    expect(m.rechts).toMatchObject({ name: 'FC Nord', tore: 1 });
  });

  it('der Stand zählt die Verlängerung mit (Endstand = regulär + Verlängerung)', () => {
    const m = toScoreboardModel(input({}, { match: makeLiveMatch({ homeScore: 1, awayScore: 1, overtimeScoreA: 1, overtimeScoreB: 0 }) }), t);
    expect([m.links.tore, m.rechts.tore]).toEqual([2, 1]);
  });
});

describe('toScoreboardModel: Abzeichen', () => {
  it('@HE-051 eine Helfer-Anfrage steht als Abzeichen („1 Helfer-Anfrage“)', () => {
    const m = toScoreboardModel(input({}, { helferAnfragen: 1 }), t);
    expect(m.helferAnfragenText).toBe('tafel.helferAnfragen:{"count":1}');
  });

  it('RF4 zwei wartende Einträge stehen als Abzeichen', () => {
    expect(toScoreboardModel(input({}, { eintraegeWarten: 2 }), t).eintraegeWartenText).toBe('tafel.eintraegeWarten:{"count":2}');
  });

  it('Gegenbeispiel: ohne wartende Einträge und Anfragen keine Abzeichen', () => {
    const m = toScoreboardModel(input({}), t);
    expect(m.eintraegeWartenText).toBeNull();
    expect(m.helferAnfragenText).toBeNull();
  });
});
