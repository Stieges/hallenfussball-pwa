/**
 * toScoreboardModel: die Tafel nach dem Ende (@SL-169, Cockpit-Spec Nachtrag 2026-10-21, Vorschlag A).
 * Testwerte aus dem Szenariogrundriss „Nach dem Ende zeigt die Tafel, wie das Spiel endete und wie lange gespielt wurde“
 * (Spiel 11, 2 × 7 Minuten). Der Code wurde erst danach gelesen. Die Übersetzung ist ein Schlüssel-Stub.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { PhaseView } from '../../engine/phaseView';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const min = (m: number, s = 0): number => (m * 60 + s) * 1000;

/** Spiel 11, 2 × 7 Minuten, beendet; `view` überschreibt die Engine-Ansicht. */
function ende(view: Partial<PhaseView>, extra: Partial<ScoreboardInput> = {}): ScoreboardInput {
  const v = makePhaseView({ status: 'finished', section: 2, sections: 2, sectionLimitMs: min(7), sectionElapsedMs: min(7), ...view });
  return {
    match: makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1 }),
    phase: cockpitPhaseOf({ view: v, matchStatus: 'FINISHED', leer: null }),
    view: v, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten',
    eintraegeWarten: 0, helferAnfragen: 0, jetztMs: Date.parse('2026-11-28T10:20:00.000Z'),
    ...extra,
  };
}

describe('@SL-169 Tafel nach Ende: Zusatz und Uhr-Bereich', () => {
  it('nach Ablauf der Spielzeit mit 2:1: „Ende“, kein Abschnitt, kein Zusatz, „Gespielt 14:00“', () => {
    const m = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14) }), t);
    expect(m.badge).toEqual({ kind: 'badge', state: 'ended' });
    expect(m.abschnittText).toBeNull();
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.gespielt', rest: '14:00', unterzeile: null });
  });

  it('Gegenbeispiel: der Abschnitt „2. Halbzeit“ steht nur im laufenden Spiel, nicht nach dem Ende', () => {
    const laeuft = toScoreboardModel(ende({ status: 'running' }, { phase: cockpitPhaseOf({ view: makePhaseView({ status: 'running', section: 2, sections: 2 }), matchStatus: 'RUNNING', leer: null }) }), t);
    expect(laeuft.abschnittText).toBe('tafel.abschnitt.halbzeit:{"nummer":2}');
    const beendet = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14) }), t);
    expect(beendet.abschnittText).toBeNull();
  });

  it('in der 2. Halbzeit nach 4:20 gespielter Zeit abgepfiffen: „Gespielt 11:20 von 14:00“, kein Zusatz', () => {
    const m = toScoreboardModel(ende({ sectionElapsedMs: min(4, 20), playedMs: min(11, 20), plannedMs: min(14) }), t);
    expect(m.abschnittText).toBeNull();
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.gespielt', rest: '11:20', unterzeile: 'tafel.unterzeile.vonGeplant:{"zeit":"14:00"}' });
  });

  it('Gegenbeispiel: regulär zu Ende gespielt trägt kein „von 14:00“', () => {
    const m = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14) }), t);
    expect(m.uhr?.unterzeile).toBeNull();
  });

  it('die gespielte Zeit zählt alle Abschnitte, nicht nur den letzten (7:00 des letzten Abschnitts wären falsch)', () => {
    const m = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14), sectionElapsedMs: min(7) }), t);
    expect(m.uhr?.rest).not.toBe('7:00');
    expect(m.uhr?.rest).toBe('14:00');
  });

  it('nach Verlängerung 3:2: „nach Verlängerung“ und die ganze gespielte Zeit (14 + 3 Minuten)', () => {
    const m = toScoreboardModel(ende({ phase: 'overtime', section: 3, tiebreakMode: 'overtime-then-shootout', sectionLimitMs: min(3), sectionElapsedMs: min(3), playedMs: min(17), plannedMs: min(17) }), t);
    expect(m.abschnittText).toBe('tafel.nachEnde.verlaengerung');
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.gespielt', rest: '17:00', unterzeile: null });
  });

  it('Golden Goal nach 1:10 der Verlängerung: „nach Verlängerung“, „Gespielt 15:10“ ohne „von“', () => {
    const m = toScoreboardModel(ende({ phase: 'overtime', section: 3, tiebreakMode: 'goldenGoal', sectionLimitMs: min(3), sectionElapsedMs: min(1, 10), playedMs: min(15, 10), plannedMs: min(17) }), t);
    expect(m.abschnittText).toBe('tafel.nachEnde.verlaengerung');
    expect(m.uhr).toMatchObject({ rest: '15:10', unterzeile: null });
  });

  it('nach Strafstoßschießen 4:3: „nach Strafstoßschießen“ und dessen Ergebnis im Uhr-Bereich, nicht die gespielte Zeit', () => {
    const match = makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 2, penaltyScoreA: 4, penaltyScoreB: 3 });
    const m = toScoreboardModel(ende({ phase: 'shootout', playedMs: min(14), plannedMs: min(14) }, { match }), t);
    expect(m.abschnittText).toBe('tafel.nachEnde.strafstoss');
    expect(m.uhr).toMatchObject({ label: 'tafel.uhr.strafstoss', rest: '4:3' });
  });

  it('Gegenbeispiel: ohne Verlängerung und ohne Strafstoßschießen steht kein „nach …“', () => {
    const m = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14) }), t);
    expect(String(m.abschnittText)).not.toContain('nachEnde');
  });

  it('mit Turnierkopf (Eingabe „vor“) steht neben „Ende“ nicht der Turniername als Abschnitt', () => {
    const m = toScoreboardModel(ende({ playedMs: min(14), plannedMs: min(14) }, {
      tournamentName: 'Hallencup Süd', vor: { anstoss: '10:00', mindestpause: null, sperrHinweise: [], leer: null, uebernahmeVon: null },
    }), t);
    expect(m.abschnittText).toBeNull();
  });

  it('ein ausgefallenes Spiel zeigt keine „Gespielt“-Zeit (Gegenbeispiel)', () => {
    const m = toScoreboardModel(ende({ status: 'skipped', playedMs: 0, plannedMs: min(14) }), t);
    expect(m.uhr).toBeNull();
  });
});
