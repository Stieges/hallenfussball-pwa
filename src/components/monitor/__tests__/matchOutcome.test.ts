/**
 * Sieger-Regel der Live-Anzeige (eine Quelle für die bisherige Folie und das Profil „Halle (sehr fern)“): nur nach dem Abpfiff mit Entscheidung,
 * nie im Kindermodus, kein Sieger bei Unentschieden in der Gruppe.
 */
import { describe, it, expect } from 'vitest';
import type { FinalScore } from '../../../core/view';
import { outcomeOfSide, winnerOf } from '../matchOutcome';

const score = (winner: 'a' | 'b' | null): FinalScore => ({ winner } as unknown as FinalScore);

describe('winnerOf / outcomeOfSide', () => {
  it('nach dem Abpfiff mit Entscheidung: Sieger und Verlierer', () => {
    const winner = winnerOf('FINISHED', false, score('a'));
    expect(winner).toBe('a');
    expect(outcomeOfSide(winner, 'a')).toBe('winner');
    expect(outcomeOfSide(winner, 'b')).toBe('loser');
  });
  it('Gegenbeispiel: läuft das Spiel noch, gibt es keinen Sieger', () => { expect(winnerOf('RUNNING', false, score('a'))).toBeNull(); });
  it('Gegenbeispiel: Kindermodus zeigt nie einen Sieger', () => { expect(winnerOf('FINISHED', true, score('a'))).toBeNull(); });
  it('Gegenbeispiel: Unentschieden (kein Sieger) – weder Sieger noch Verlierer', () => {
    const winner = winnerOf('FINISHED', false, score(null));
    expect(winner).toBeNull();
    expect(outcomeOfSide(winner, 'a')).toBeUndefined();
  });
  it('Gegenbeispiel: ohne Endstand-Daten kein Sieger', () => { expect(winnerOf('FINISHED', false, undefined)).toBeNull(); });
});
