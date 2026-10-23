/**
 * A-25c, Auflage M2 (Opus-Review `_005`/A-25c, @W2A-025): Eine gespeicherte Wertung darf sich nie rückwirkend ändern.
 * „Beide nicht angetreten“ ist als 0:0 gespeichert, die Gegentore kommen aus der Einstellung „Wertung bei Nichtantritt“.
 * Deshalb ist die Einstellung gesperrt, sobald das Turnier eine Wertung enthält (Vorschlag a, ohne SQL-Änderung).
 * Regel: `changeForfeitScore` / `forfeitScoreLocked` (`core/models/forfeit.ts`); die Oberfläche (B-12) muss sie nutzen –
 * der rote Test dafür steht in `components/match-settings/__tests__/MatchCockpitSettingsPanel.wertungSperre.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { changeForfeitScore, forfeitScoreLocked } from '../../models/forfeit';
import type { Tournament } from '../../../types/tournament';
import { id, league, parseMatches } from './fixtures';
import { cloudTournament, matchIdOf } from './forfeitKit';

const RESULTS = 'N–B 2:1; N–W 1:0; N–O 3:0; B–W 2:2; B–O 1:1; W–O 0:0';
const { teams } = league('NBWO', RESULTS, { group: 'A' });
/** Gruppe A, TSV West – SC Ost als Nichtantritt beider gewertet (gespeichert 0:0). */
const withDoubleForfeit = (): Tournament =>
  cloudTournament(teams, parseMatches(RESULTS, { group: 'A' }), { [matchIdOf(RESULTS, 'W–O')]: 'both' });
/** Dieselbe Gruppe, alle Spiele gespielt. */
const withoutForfeit = (): Tournament => cloudTournament(teams, parseMatches(RESULTS, { group: 'A' }));
const westGoalsAgainst = (t: Tournament): number =>
  calculateStandings(t.teams, t.matches, t, 'A').find((r) => r.team.id === id('W'))?.goalsAgainst ?? -1;

describe('A-25c Auflage M2: keine rückwirkende Änderung einer Wertung', () => {
  it('@W2A-025:teil mit einer Wertung im Turnier ist die Einstellung gesperrt: 2:0 → 3:0 wird abgelehnt, die gespeicherte Wertung bleibt je 0:2', () => {
    const t = withDoubleForfeit();
    const before = westGoalsAgainst(t);
    expect(forfeitScoreLocked(t)).toBe(true);
    expect(changeForfeitScore(t, { winner: 3, loser: 0 })).toEqual({ ok: false, code: 'FORFEIT_SCORE_LOCKED' });
    expect(westGoalsAgainst(t)).toBe(before);
  });

  it('auch eine Wertung mit nur einer fehlenden Seite sperrt die Einstellung', () => {
    const t = cloudTournament(teams, parseMatches(RESULTS.replace('W–O 0:0', 'W–O 2:0'), { group: 'A' }), { [matchIdOf(RESULTS, 'W–O')]: 'B' });
    expect(changeForfeitScore(t, { winner: 3, loser: 0 })).toEqual({ ok: false, code: 'FORFEIT_SCORE_LOCKED' });
  });

  it('Gegenbeispiel: ohne Wertung darf die Turnierleitung die Wertung auf 3:0 stellen', () => {
    const t = withoutForfeit();
    expect(forfeitScoreLocked(t)).toBe(false);
    expect(changeForfeitScore(t, { winner: 3, loser: 0 })).toEqual({ ok: true, forfeitScore: { winner: 3, loser: 0 } });
  });

  it('Gegenbeispiel: dieselbe Einstellung erneut speichern ist auch mit Wertung erlaubt (keine Änderung)', () => {
    expect(changeForfeitScore(withDoubleForfeit(), { winner: 2, loser: 0 })).toEqual({ ok: true, forfeitScore: { winner: 2, loser: 0 } });
  });

  it('Gegenbeispiel: nach Rücknahme der Wertung (Spiel wieder offen) ist die Einstellung frei', () => {
    const t = withDoubleForfeit();
    const westOst = matchIdOf(RESULTS, 'W–O');
    const reopened: Tournament = {
      ...t,
      matches: t.matches.map((m) => (m.id === westOst
        ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined, decidedBy: undefined }
        : m)),
    };
    expect(changeForfeitScore(reopened, { winner: 3, loser: 0 }).ok).toBe(true);
  });

  it('Gegenbeispiel: eine unbrauchbare Wertung (2:2) wird abgelehnt', () => {
    expect(changeForfeitScore(withoutForfeit(), { winner: 2, loser: 2 })).toEqual({ ok: false, code: 'INVALID_FORFEIT_SCORE' });
  });
});
