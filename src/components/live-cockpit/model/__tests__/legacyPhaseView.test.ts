/**
 * Ersatz-Ansicht ohne Engine-Kopie (Aufgabe 2.4): die Tafel zeigt die Zeit auch dann, wenn keine `PhaseView` vorliegt.
 * Werte aus @SL-081 (Verlängerung 3 Minuten, bei 2:00 noch 1:00) und @SL-004 (angehalten bei 4:10).
 */
import { describe, it, expect } from 'vitest';
import { legacyPhaseViewOf } from '../legacyPhaseView';
import { cockpitPhaseOf } from '../cockpitPhase';
import { toScoreboardModel } from '../toScoreboardModel';
import { makeLiveMatch } from '../../__tests__/cockpitFixtures';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);

function modell(match: ReturnType<typeof makeLiveMatch>, elapsed: number) {
  const view = legacyPhaseViewOf(match, elapsed);
  const phase = cockpitPhaseOf({ view, matchStatus: match.status, leer: null });
  return toScoreboardModel({ match, phase, view, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0, jetztMs: 0 }, t);
}

describe('legacyPhaseViewOf', () => {
  it('@SL-081 Verlängerung von 3 Minuten bei Spielzeit 2:00: Restzeit 1:00, Abschnitt „Verlängerung“, Schlussphase', () => {
    const m = modell(makeLiveMatch({ durationSeconds: 180, playPhase: 'overtime', tiebreakerMode: 'overtime-then-shootout' }), 120);
    expect(m.uhr).toMatchObject({ rest: '1:00', gespielt: '2:00', schlussphase: true });
    expect(m.abschnittText).toBe('tafel.abschnitt.verlaengerung');
  });

  it('@SL-082 Golden Goal heißt „Golden Goal“', () => {
    expect(modell(makeLiveMatch({ durationSeconds: 180, playPhase: 'goldenGoal' }), 60).abschnittText).toBe('tafel.abschnitt.goldenGoal');
  });

  it('@SL-004 angehaltenes Spiel bei 4:10: die Uhr steht', () => {
    const m = modell(makeLiveMatch({ status: 'PAUSED', durationSeconds: 360 }), 250);
    expect(m.uhr).toMatchObject({ steht: true, gespielt: '4:10', rest: '1:50' });
  });

  it('Gegenbeispiel: ein laufendes Spiel in der regulären Zeit ist keine Verlängerung und steht nicht', () => {
    const m = modell(makeLiveMatch({ durationSeconds: 360 }), 100);
    expect(m.uhr).toMatchObject({ steht: false, rest: '4:20' });
    expect(m.abschnittText).toBeNull();
  });

  it('Strafstoßschießen und offene Entscheidung folgen dem LiveMatch', () => {
    expect(legacyPhaseViewOf(makeLiveMatch({ playPhase: 'penalty' }), 0).status).toBe('shootout');
    expect(legacyPhaseViewOf(makeLiveMatch({ awaitingTiebreakerChoice: true, status: 'PAUSED' }), 0).status).toBe('decision_pending');
    expect(legacyPhaseViewOf(makeLiveMatch({ status: 'FINISHED' }), 0).status).toBe('finished');
    expect(legacyPhaseViewOf(makeLiveMatch({ status: 'NOT_STARTED' }), 0).status).toBe('scheduled');
  });
});
