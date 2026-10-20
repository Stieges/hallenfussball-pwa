/**
 * Dashboard-Suche (`matchesTournamentSearch`): findet über Titel, Veranstalter, Altersklasse und Ort und stürzt bei
 * unvollständigen, lokal ungeprüft geladenen Turnieren nicht ab (Regression PR #304, E2E „Dashboard › Suche filtert
 * Turniere“: Turnier ohne Altersklasse/Ort ließ die Suche abstürzen).
 */
import { describe, expect, it } from 'vitest';
import { matchesTournamentSearch } from '../tournamentSearch';
import type { Tournament } from '../../types/tournament';

const voll = {
  title: 'Hallencup Nord', organizer: 'TSV Waging', ageClass: 'U11', location: { name: 'Sporthalle Mitte', city: 'Traunstein' },
} as Pick<Tournament, 'title' | 'organizer' | 'ageClass' | 'location'>;

describe('Dashboard-Suche', () => {
  it('findet über Titel, Veranstalter, Altersklasse und Ort, ohne Groß-/Kleinschreibung; leerer Text passt immer', () => {
    for (const text of ['hallencup', 'WAGING', 'u11', 'traunstein', 'sporthalle', '  ']) {
      expect(matchesTournamentSearch(voll, text)).toBe(true);
    }
    // Gegenbeispiel: ein fremder Text passt nicht.
    expect(matchesTournamentSearch(voll, 'Dortmund')).toBe(false);
  });

  it('ein Turnier ohne Altersklasse, Veranstalter und Ort lässt die Suche nicht abstürzen', () => {
    const roh = { title: 'Dortmund Cup' } as unknown as Pick<Tournament, 'title' | 'organizer' | 'ageClass' | 'location'>;
    expect(matchesTournamentSearch(roh, 'Bayern')).toBe(false);
    expect(matchesTournamentSearch(roh, 'dortmund')).toBe(true);
  });
});
