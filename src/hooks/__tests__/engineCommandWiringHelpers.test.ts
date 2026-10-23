/**
 * rejectionMessageKey (A-08b, Auflage B4 aus A-08b-Review, A-08d2b): Ablehnungsgrund -> Textschluessel.
 * Nie „folgt später“ (`engine.notYet`) für eine Ablehnung; Speicher voll hat einen eigenen Text.
 */
import { describe, it, expect } from 'vitest';
import { LocalStoreFullError, MatchCommandRejectedError, NotOnEngineYetError } from '../../core/match/client';
import { ERROR_CODES } from '../../core/match/types';
import { rejectionMessageKey } from '../engineCommandWiringHelpers';

describe('rejectionMessageKey (A-08b/B4, A-08d2b)', () => {
  it('B4 (R2): LocalStoreFullError -> engine.storeFull (kein Ersatztext)', () => {
    expect(rejectionMessageKey(new LocalStoreFullError())).toBe('engine.storeFull');
  });

  it('B4 (R4): NotOnEngineYetError -> engine.invalid, nie engine.notYet ("folgt in einem späteren Schritt")', () => {
    expect(rejectionMessageKey(new NotOnEngineYetError())).toBe('engine.invalid');
  });

  it('@FU-069: Tor nach Spielende (MATCH_FINISHED) -> Hinweis Turnierleitung', () => {
    const error = new MatchCommandRejectedError(ERROR_CODES.MATCH_FINISHED);
    expect(rejectionMessageKey(error)).toBe('engine.retract.hint.goalFinished');
  });

  it('andere Vorpruefungs-Ablehnung -> engine.invalid', () => {
    const error = new MatchCommandRejectedError(ERROR_CODES.INVALID_TRANSITION);
    expect(rejectionMessageKey(error)).toBe('engine.invalid');
  });

  it('unbekannter Fehler -> engine.invalid', () => {
    expect(rejectionMessageKey(new Error('irgendwas'))).toBe('engine.invalid');
  });
});
