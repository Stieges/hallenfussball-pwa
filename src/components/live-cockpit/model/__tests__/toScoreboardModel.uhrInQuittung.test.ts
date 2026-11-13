/**
 * @SL-240 Endstand am Handy mit der Leibchen-Karte (Daniel „Variante A“, 2026-11-13): kein großer Uhr-Bereich in der Tafel, jede Angabe daraus
 * (@SL-169: „Gespielt 9:00“, „Gespielt 11:20 von 14:00“, Ergebnis des Strafstoßschießens) steht in der Quittungszeile; „Ende – eingetragen im Spielplan“
 * bleibt, wo es war. Ohne das Flag (ohne Karte, Tablet, Desktop) bleibt alles wie in @SL-169. Testwerte aus @SL-240/@SL-169, Übersetzung = Schlüssel-Stub.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../../../core/match/client/phaseView';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const min = (m: number, s = 0): number => (m * 60 + s) * 1000;

function ende(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}): ScoreboardInput {
  const v = makePhaseView({ status: 'finished', section: 2, sections: 2, sectionLimitMs: min(7), sectionElapsedMs: min(7), quittungRestMs: 20_000, ...view });
  return {
    match: makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1 }),
    phase: cockpitPhaseOf({ view: v, matchStatus: 'FINISHED', leer: null }),
    view: v, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten',
    eintraegeWarten: 0, helferAnfragen: 0, jetztMs: Date.parse('2026-11-28T10:20:00.000Z'),
    ...extra,
  };
}
const quittung = 'tafel.quittung:{"links":2,"rechts":1}';

describe('@SL-240 der Uhr-Bereich wandert in die Quittungszeile', () => {
  it('nach Ablauf der Spielzeit mit 2:1: kein Uhr-Bereich, Quittung „Abgepfiffen · 2:1 gespeichert · gespielt 9:00“', () => {
    const m = toScoreboardModel(ende({ playedMs: min(9), plannedMs: min(9) }, { uhrInQuittung: true }), t);
    expect(m.uhr).toBeNull();
    expect(m.quittungText).toBe(`${quittung} · tafel.quittungZusatz.gespielt:{"zeit":"9:00"}`);
  });

  it('vorzeitig abgepfiffen (bei 2:40 Restzeit): „gespielt 11:20 von 14:00“ in der Quittungszeile', () => {
    const m = toScoreboardModel(ende({ playedMs: min(11, 20), plannedMs: min(14) }, { uhrInQuittung: true }), t);
    expect(m.uhr).toBeNull();
    expect(m.quittungText).toBe(`${quittung} · tafel.quittungZusatz.gespieltVon:{"zeit":"11:20","geplant":"14:00"}`);
  });

  it('nach Strafstoßschießen 4:3: das Ergebnis des Strafstoßschießens steht in der Quittungszeile, kein Uhr-Bereich', () => {
    const match = makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 2, penaltyScoreA: 4, penaltyScoreB: 3 });
    const m = toScoreboardModel(ende({ phase: 'shootout', playedMs: min(14), plannedMs: min(14) }, { match, uhrInQuittung: true }), t);
    expect(m.uhr).toBeNull();
    expect(m.quittungText).toBe('tafel.quittung:{"links":2,"rechts":2} · tafel.quittungZusatz.strafstoss:{"ergebnis":"4:3"}');
  });

  it('nach Verlängerung 3:2: die ganze gespielte Zeit (17:00) in der Quittungszeile', () => {
    const m = toScoreboardModel(ende({ phase: 'overtime', section: 3, sectionLimitMs: min(3), sectionElapsedMs: min(3), playedMs: min(17), plannedMs: min(17) }, { uhrInQuittung: true }), t);
    expect(m.quittungText).toContain('tafel.quittungZusatz.gespielt:{"zeit":"17:00"}');
    expect(m.abschnittText).toBe('tafel.nachEnde.verlaengerung'); // „nach Verlängerung“ bleibt im Kopf
  });

  it('im Spielplan beendet und eingetragen: kein Uhr-Bereich wie bisher, keine Quittung, „Ende – eingetragen im Spielplan“ bleibt im Kopf', () => {
    const m = toScoreboardModel(ende({ eingetragenImSpielplan: 'event-1', playedMs: 0, plannedMs: min(14) }, { uhrInQuittung: true }), t);
    expect(m.uhr).toBeNull();
    expect(m.quittungText).toBeNull();
    expect(m.abschnittText).toBe('tafel.nachEnde.eingetragen');
  });

  it('nach den 30 Sekunden (Quittung vorbei) geht die Angabe nicht verloren: „gespielt 9:00“ steht allein', () => {
    const m = toScoreboardModel(ende({ playedMs: min(9), plannedMs: min(9), quittungRestMs: 0 }, { uhrInQuittung: true }), t);
    expect(m.quittungText).toBe('tafel.quittungZusatz.gespielt:{"zeit":"9:00"}');
  });
});

describe('@SL-240 Gegenbeispiele: ohne Karte, Tablet und Desktop bleibt der Uhr-Bereich wie in @SL-169', () => {
  it('ohne das Flag: Uhr-Bereich „Gespielt 9:00“, die Quittung ohne Zusatz', () => {
    const m = toScoreboardModel(ende({ playedMs: min(9), plannedMs: min(9) }), t);
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.gespielt', rest: '9:00' });
    expect(m.quittungText).toBe(quittung);
  });

  it('mit dem Flag, aber im laufenden Spiel: nichts wandert (die Uhr läuft)', () => {
    const v = makePhaseView({ status: 'running', section: 1, sections: 2, sectionLimitMs: min(7), sectionElapsedMs: min(1) });
    const m = toScoreboardModel({ ...ende({}), phase: cockpitPhaseOf({ view: v, matchStatus: 'RUNNING', leer: null }), view: v, uhrInQuittung: true }, t);
    expect(m.uhr).not.toBeNull();
    expect(String(m.quittungText ?? '')).not.toContain('quittungZusatz');
  });

  it('Strafstoßschießen ohne das Flag: Uhr-Bereich mit dem Ergebnis wie bisher', () => {
    const match = makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 2, penaltyScoreA: 4, penaltyScoreB: 3 });
    const m = toScoreboardModel(ende({ phase: 'shootout', playedMs: min(14), plannedMs: min(14) }, { match }), t);
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.strafstoss', rest: '4:3' });
  });
});
