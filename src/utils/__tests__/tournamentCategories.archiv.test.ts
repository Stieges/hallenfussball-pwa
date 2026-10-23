/** @W5-027: ein abgeschlossenes (archiviertes) Turnier gehört ins Archiv, auch wenn sein Datum noch in der Zukunft liegt. */
import { describe, it, expect } from 'vitest';
import { categorizeTournament, categorizeTournaments } from '../tournamentCategories';
import type { Tournament } from '../../types/tournament';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { createTournamentRow } from '../../../tests/factories/supabase';

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

/**
 * KB-3c: Ins Archiv kommen nur abgeschlossene oder abgebrochene Turniere – das Datum allein verschiebt nichts.
 * Szenarien: docs/anforderungen/2026-10-01_turnier-lebenszyklus.md @LZ-001 (Zustand des Turniers),
 * @LZ-005 (vergessener Abschluss), @LZ-006 (App schließt nicht selbst ab). Befund C-ARCHIV-NACH-DATUM.
 * Turnier über mapTournamentFromSupabase; die Spiele werden von Hand angehängt (die Startseite lädt aus der Cloud
 * heute keine Spiele, Befund C-STARTSEITE-OHNE-ANPFIFF-CLOUD).
 */
describe('@LZ-001/@LZ-005/@LZ-006 Archiv nur nach Abschluss, nicht nach Datum', () => {
  const HEUTE = new Date(2026, 9, 23, 12, 0); // 23.10.2026, 12:00 Ortszeit

  function turnier(date: string, matches: Array<Record<string, unknown>>, extra: Partial<Tournament> = {}): Tournament {
    const row = createTournamentRow({ status: 'published', date, start_time: '09:00:00' });
    const t = mapTournamentFromSupabase(row, [], []);
    return { ...t, matches, ...extra } as unknown as Tournament;
  }
  const angepfiffen = [{ id: 'm1', matchStatus: 'running' }, { id: 'm2', matchStatus: 'scheduled' }];
  const nichtAngepfiffen = [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'scheduled' }];

  it('@LZ-001 Datum gestern, ein Spiel angepfiffen, nicht abgeschlossen (über Mitternacht): Läuft', () => {
    expect(categorizeTournament(turnier('2026-10-22', angepfiffen), HEUTE)).toBe('running');
  });
  it('@LZ-001 Datum gestern, nichts angepfiffen, nicht abgeschlossen: nicht im Archiv, sondern Festgelegt (kommend)', () => {
    expect(categorizeTournament(turnier('2026-10-22', nichtAngepfiffen), HEUTE)).toBe('upcoming');
  });
  it('@LZ-005 Datum vor 10 Tagen, angepfiffen, nicht abgeschlossen: weiter Läuft, nicht im Archiv', () => {
    expect(categorizeTournament(turnier('2026-10-13', angepfiffen), HEUTE)).toBe('running');
  });
  it('@LZ-005 Datum vor 10 Tagen, nichts angepfiffen, nicht abgeschlossen: nicht im Archiv', () => {
    expect(categorizeTournament(turnier('2026-10-13', nichtAngepfiffen), HEUTE)).not.toBe('finished');
  });
  it('Gegenbeispiel @LZ-001: manuell abgeschlossen, Datum heute: Archiv', () => {
    expect(categorizeTournament(turnier('2026-10-23', angepfiffen, { manuallyCompleted: true }), HEUTE)).toBe('finished');
  });
  it('@LZ-001 abgebrochen (mit Grund), Datum heute, nichts angepfiffen: Archiv', () => {
    const t = turnier('2026-10-23', nichtAngepfiffen, { cancelledAt: '2026-10-23T10:00:00.000Z', cancelledReason: 'Hallenzeit vorbei' });
    expect(categorizeTournament(t, HEUTE)).toBe('finished');
  });
  it('@LZ-001 heute, Startzeit vorbei, nichts angepfiffen: kommend (vorhandene Regel)', () => {
    expect(categorizeTournament(turnier('2026-10-23', nichtAngepfiffen), HEUTE)).toBe('upcoming');
  });
  it('@LZ-001 abgebrochen mit Grund „Hallenzeit vorbei“, ein Spiel angepfiffen: Archiv, nicht laufend', () => {
    const t = turnier('2026-10-23', angepfiffen, { cancelledAt: '2026-10-23T10:00:00.000Z', cancelledReason: 'Hallenzeit vorbei' });
    expect(categorizeTournament(t, HEUTE)).toBe('finished');
    // isTournamentRunning ist nicht exportiert: „Läuft“ über categorizeTournaments prüfen
    const kat = categorizeTournaments([t], HEUTE);
    expect(kat.running).toHaveLength(0);
    expect(kat.finished).toHaveLength(1);
  });
  it('@LZ-001 abgebrochen, Datum in der Zukunft: Archiv, nicht kommend', () => {
    const t = turnier('2026-11-26', nichtAngepfiffen, { cancelledAt: '2026-10-23T10:00:00.000Z', cancelledReason: 'Hallenzeit vorbei' });
    expect(categorizeTournament(t, HEUTE)).toBe('finished');
  });
  it.fails('@LZ-006 alle Ergebnisse da, nicht abgeschlossen → bleibt „Läuft“ (Befund C-ZUSTAND-ABGELEITET)', () => {
    const alleErgebnisse = [
      { id: 'm1', matchStatus: 'finished', scoreA: 2, scoreB: 1 },
      { id: 'm2', matchStatus: 'finished', scoreA: 0, scoreB: 0 },
    ];
    expect(categorizeTournament(turnier('2026-10-23', alleErgebnisse), HEUTE)).toBe('running');
  });
});
