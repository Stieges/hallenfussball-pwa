/**
 * Texte der Meldungen zur Leibchen-Wahl (@SL-202, @SL-212, @SL-227, @SL-228, @SL-229). Wortlaute aus dem Gherkin.
 */
import { describe, expect, it } from 'vitest';
import { leibchenMeldungKey } from '../leibchenMeldung';

const A = { id: 'x', matchId: 'm' } as const;

describe('Meldungen zur Leibchen-Wahl', () => {
  it('@SL-229 Zeile 4: nach der Übernahme des Feldes durch ein anderes Gerät „nicht übernommen, bitte neu bestätigen“', () => {
    expect(leibchenMeldungKey({ ...A, kind: 'rejected', code: 'NOT_CONTROLLER', reason: 'OTHER_DEVICE', hadControl: true })).toBe('nichtUebernommen');
    expect(leibchenMeldungKey({ ...A, kind: 'rejected', code: 'NOT_CONTROLLER', reason: 'STALE_EPOCH', hadControl: true })).toBe('nichtUebernommen');
  });

  it('@SL-227 Paul (sein Gerät hielt das Feld nie): „Nur das steuernde Gerät kann Leibchen bestätigen.“', () => {
    expect(leibchenMeldungKey({ ...A, kind: 'rejected', code: 'NOT_CONTROLLER', reason: 'OTHER_DEVICE', hadControl: false })).toBe('nurSteuerndes');
  });

  it('@SL-212 anderes Team auf der Seite (abgewiesen oder vom Server zurückgenommen): „zurückgenommen“', () => {
    expect(leibchenMeldungKey({ ...A, kind: 'rejected', code: 'TEAMS_CHANGED' })).toBe('zurueckgenommen');
    expect(leibchenMeldungKey({ ...A, kind: 'withdrawn' })).toBe('zurueckgenommen');
  });

  it('@SL-228 @SL-229 die übrigen Fälle', () => {
    expect(leibchenMeldungKey({ ...A, kind: 'changedElsewhere' })).toBe('anderesGeraet');
    expect(leibchenMeldungKey({ ...A, kind: 'tooLate' })).toBe('zuSpaet');
    expect(leibchenMeldungKey({ ...A, kind: 'rejected', code: 'MATCH_FINISHED' })).toBe('nichtUebernommen');
    expect(leibchenMeldungKey({ ...A, kind: 'failed' })).toBe('fehlgeschlagen');
  });
});
