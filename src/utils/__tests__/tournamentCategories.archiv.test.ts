/** @W5-027: ein abgeschlossenes (archiviertes) Turnier gehört ins Archiv, auch wenn sein Datum noch in der Zukunft liegt. */
import { describe, it, expect } from 'vitest';
import { categorizeTournament } from '../tournamentCategories';
import type { Tournament } from '../../types/tournament';

const JETZT = new Date('2026-11-20T10:00:00.000Z');
const basis = {
  id: 't', title: 'Probe', status: 'published', startDate: '2026-11-26', startTime: '09:00',
  teams: [], matches: [{ id: 'm1' }, { id: 'm2' }],
} as unknown as Tournament;

describe('Kategorie bei Datum in der Zukunft', () => {
  it('ohne Abschluss: kommendes Turnier', () => {
    expect(categorizeTournament(basis, JETZT)).toBe('upcoming');
  });
  it('@W5-027 manuell abgeschlossen/archiviert: Archiv, nicht kommend', () => {
    expect(categorizeTournament({ ...basis, manuallyCompleted: true }, JETZT)).toBe('finished');
  });
  it('Gegenbeispiel: alle Spiele mit Ergebnis, aber nicht archiviert: bleibt kommend (Zwischenstand läuft)', () => {
    const gespielt = { ...basis, matches: [{ id: 'm1', scoreA: 1, scoreB: 0 }] } as unknown as Tournament;
    expect(categorizeTournament(gespielt, JETZT)).toBe('upcoming');
  });
});
