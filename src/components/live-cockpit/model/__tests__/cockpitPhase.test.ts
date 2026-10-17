import { describe, it, expect } from 'vitest';
import { cockpitPhaseOf, istAngepfiffenUndNichtBeendet, type CockpitZustand } from '../cockpitPhase';
import { makePhaseView } from '../../__tests__/cockpitFixtures';

describe('cockpitPhaseOf – Zustands-Matrix (Spec § 6)', () => {
  it.each<[string, Parameters<typeof makePhaseView>[0], CockpitZustand, string]>([
    ['Vor Anpfiff', { status: 'scheduled', section: 1 }, 'vorAnpfiff', 'regulaer'],
    ['Läuft', { status: 'running' }, 'laeuft', 'regulaer'],
    ['Pausiert', { status: 'paused' }, 'pausiert', 'regulaer'],
    ['@SL-005 Halbzeitpause mit Restzeit 1:00', { status: 'section_break', phase: 'regular', section: 1, isLastRegularSection: false, breakRemainingMs: 60_000 }, 'halbzeitpause', 'regulaer'],
    ['Pause vor der Verlängerung (Fixture 57c)', { status: 'section_break', phase: 'overtime', section: 2 }, 'pauseVorVerlaengerung', 'verlaengerung'],
    ['@SL-081 Verlängerung (3 min) bei 2:00 Spielzeit', { status: 'running', phase: 'overtime', sectionElapsedMs: 120_000, sectionLimitMs: 180_000, tiebreakMode: 'overtime-then-shootout' }, 'laeuft', 'verlaengerung'],
    ['@SL-082 Golden Goal läuft', { status: 'running', phase: 'overtime', tiebreakMode: 'goldenGoal' }, 'laeuft', 'goldenGoal'],
    ['@SL-082 Golden Goal nach dem Tor: abgepfiffen', { status: 'finished', phase: 'overtime', tiebreakMode: 'goldenGoal' }, 'abgepfiffen', 'goldenGoal'],
    ['@SL-053 Strafstoß eingestellt, 1:1 bei Abpfiff: Strafstoßschießen beginnt', { status: 'shootout', phase: 'shootout' }, 'strafstoss', 'regulaer'],
    ['@SL-145 keine Art eingestellt, 1:1 bei Abpfiff: Verlängerung beginnt', { status: 'running', phase: 'overtime', tiebreakMode: null }, 'laeuft', 'verlaengerung'],
    ['@SL-104 Strafstoß, FC Nord führt nach je 4 Schüssen 4:2: kein Angebot durch den Zustand (Schussangebot in 3.6)', { status: 'shootout', phase: 'shootout', shootout: { kicks: { 'fc-nord': 4, 'sv-sued': 4 }, goals: { 'fc-nord': 4, 'sv-sued': 2 }, winner: 'fc-nord', nextTeam: null } }, 'strafstoss', 'regulaer'],
    ['Engine-Status decision_pending (Spec § 6, ohne Kennung): Entscheidung offen', { status: 'decision_pending' }, 'entscheidung', 'regulaer'],
    ['ausgelassenes Spiel (Matrix-Lücke, Spec § 6 ohne Zeile): wie abgepfiffen', { status: 'skipped' }, 'abgepfiffen', 'regulaer'],
    ['Abgepfiffen', { status: 'finished' }, 'abgepfiffen', 'regulaer'],
  ])('%s', (_name, view, zustand, art) => {
    const phase = cockpitPhaseOf({ view: makePhaseView(view), matchStatus: 'RUNNING', leer: null });
    expect(phase.zustand).toBe(zustand);
    expect(phase.abschnittArt).toBe(art);
  });

  it('ohne Spiel: wartet auf Herkunft bzw. kein Spiel mehr (@SL-052, @SL-054)', () => {
    expect(cockpitPhaseOf({ view: null, matchStatus: null, leer: { art: 'wartetAufHerkunft', gruende: ['Sieger Spiel 9'] } }).zustand).toBe('wartetAufHerkunft');
    expect(cockpitPhaseOf({ view: null, matchStatus: null, leer: { art: 'keinSpiel', feldName: 'Feld 2' } }).zustand).toBe('keinSpiel');
  });

  it('ohne Engine-Ansicht folgt der Zustand dem LiveMatch-Status', () => {
    expect(cockpitPhaseOf({ view: null, matchStatus: 'NOT_STARTED', leer: null }).zustand).toBe('vorAnpfiff');
    expect(cockpitPhaseOf({ view: null, matchStatus: 'FINISHED', leer: null }).zustand).toBe('abgepfiffen');
  });

  it('Gegenbeispiel: eine Halbzeitpause ist kein „Pausiert“ (LiveMatch zeigt dort PAUSED, die Matrix nicht)', () => {
    const phase = cockpitPhaseOf({ view: makePhaseView({ status: 'section_break', section: 1, isLastRegularSection: false }), matchStatus: 'PAUSED', leer: null });
    expect(phase.zustand).not.toBe('pausiert');
  });

  it.each<[CockpitZustand, boolean]>([
    ['vorAnpfiff', false], ['laeuft', true], ['pausiert', true], ['halbzeitpause', true], ['pauseVorVerlaengerung', true],
    ['entscheidung', true], ['strafstoss', true], ['abgepfiffen', false], ['wartetAufHerkunft', false], ['keinSpiel', false],
  ])('angepfiffen und nicht beendet: %s → %s', (zustand, erwartet) => {
    expect(istAngepfiffenUndNichtBeendet(zustand)).toBe(erwartet);
  });
});
