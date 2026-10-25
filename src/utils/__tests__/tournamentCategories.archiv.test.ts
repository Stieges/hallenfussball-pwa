/**
 * R3-1: Startseite und Archiv lesen den GESPEICHERTEN Turnier-Zustand vom Server (`lifecycle_status`), nie Spielstände
 * oder das Datum. Szenarien: docs/anforderungen/2026-10-01_turnier-lebenszyklus.md @LZ-001 (Zustand des Turniers, Zeilen
 * Entwurf, Festgelegt, Läuft, Abgeschlossen, Abgebrochen), @LZ-005 (vergessener Abschluss), @LZ-006 (App schließt nicht selbst ab).
 * Befunde C-ZUSTAND-ABGELEITET, C-ARCHIV-NACH-DATUM, C-STARTSEITE-OHNE-ANPFIFF-CLOUD. @W5-027: abgeschlossen = Archiv,
 * auch bei Datum in der Zukunft.
 * Turnier über mapTournamentFromSupabase (Server-Zeile); Spiele werden von Hand angehängt oder kommen als `anyMatchStarted`
 * aus der Zusatzabfrage der Cloud-Liste.
 */
import { describe, it, expect } from 'vitest';
import { categorizeTournament, categorizeTournaments, getExtendedCategories } from '../tournamentCategories';
import type { Tournament } from '../../types/tournament';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { createTournamentRow } from '../../../tests/factories/supabase';

type Zustand = 'draft' | 'fixed' | 'finished' | 'cancelled';

function turnier(date: string, zustand: Zustand, matches: Array<Record<string, unknown>> = [], extra: Partial<Tournament> = {}): Tournament {
  const row = createTournamentRow({
    status: zustand === 'draft' ? 'draft' : 'published', lifecycle_status: zustand, date, start_time: '09:00:00',
    finished_at: zustand === 'finished' ? '2026-10-23T10:00:00Z' : null,
  });
  return { ...mapTournamentFromSupabase(row, [], []), matches, ...extra } as unknown as Tournament;
}
const angepfiffen = [{ id: 'm1', matchStatus: 'running' }, { id: 'm2', matchStatus: 'scheduled' }];
const nichtAngepfiffen = [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'scheduled' }];
const alleEntschieden = [
  { id: 'm1', matchStatus: 'finished', scoreA: 2, scoreB: 1 },
  { id: 'm2', matchStatus: 'finished', scoreA: 0, scoreB: 0 },
];

describe('@LZ-001 Zustand des Turniers (Zeile je Lage)', () => {
  it('Olli hat das Turnier angelegt, aber nicht festgelegt: Entwurf', () => {
    expect(categorizeTournament(turnier('2026-11-26', 'draft'))).toBe('draft');
  });
  it('Olli hat das Turnier festgelegt, kein Spiel ist angepfiffen: Festgelegt (kommend)', () => {
    expect(categorizeTournament(turnier('2026-11-26', 'fixed', nichtAngepfiffen))).toBe('upcoming');
  });
  it('Olli hat das Turnier ohne Netz festgelegt (lokal, kein Server-Zustand, status published): Festgelegt', () => {
    const lokal = { id: 'l', title: 'Lokal', status: 'published', teams: [], matches: nichtAngepfiffen } as unknown as Tournament;
    expect(categorizeTournament(lokal)).toBe('upcoming');
  });
  it('Tom hat das erste Gruppenspiel angepfiffen: Läuft', () => {
    expect(categorizeTournament(turnier('2026-11-26', 'fixed', angepfiffen))).toBe('running');
  });
  it('Läuft auch pausiert und nach dem Abpfiff des ersten Spiels (angepfiffen heißt: läuft, pausiert oder beendet)', () => {
    expect(categorizeTournament(turnier('2026-11-26', 'fixed', [{ id: 'm1', matchStatus: 'paused' }]))).toBe('running');
    expect(categorizeTournament(turnier('2026-11-26', 'fixed', [{ id: 'm1', matchStatus: 'finished' }, { id: 'm2', matchStatus: 'scheduled' }]))).toBe('running');
  });
  it('alle Spiele entschieden, Olli hat noch nicht abgeschlossen: Läuft', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'fixed', alleEntschieden))).toBe('running');
  });
  it('Olli hat das Turnier abgeschlossen: Abgeschlossen (Archiv)', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'finished', alleEntschieden))).toBe('finished');
  });
  it('Olli hat das Turnier mit dem Grund „Hallenzeit vorbei“ abgebrochen: Abgebrochen (Archiv, MVP+)', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'cancelled', angepfiffen))).toBe('finished');
  });
  it('Gegenbeispiel: ein abgeschlossenes Turnier mit einem angepfiffenen Spiel läuft nicht (Läuft gibt es nur aus festgelegt)', () => {
    const kat = categorizeTournaments([turnier('2026-10-23', 'finished', angepfiffen)]);
    expect(kat.running).toHaveLength(0);
    expect(kat.finished).toHaveLength(1);
  });
  it('Gegenbeispiel: ein Entwurf mit einem Spiel im Zustand „läuft“ bleibt Entwurf (gespeicherter Zustand zählt)', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'draft', angepfiffen))).toBe('draft');
  });
  it('@LZ-001 Cloud-Liste ohne Spiele: die Zusatzabfrage („anyMatchStarted“) macht ein festgelegtes Turnier zu „Läuft“', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'fixed', [], { anyMatchStarted: true }))).toBe('running');
    expect(categorizeTournament(turnier('2026-10-23', 'fixed', []))).toBe('upcoming');
  });
  it('im Papierkorb geht vor dem Zustand', () => {
    expect(categorizeTournament(turnier('2026-10-23', 'finished', [], { deletedAt: '2026-10-24T08:00:00Z' }))).toBe('trashed');
  });
});

describe('@LZ-005 / @LZ-006 Archiv nur nach Abschluss, nicht nach Datum und nicht nach Spielständen', () => {
  it('@LZ-006 alle Ergebnisse da, nicht abgeschlossen → bleibt „Läuft“ (Befund C-ZUSTAND-ABGELEITET)', () => {
    const alleErgebnisse = [
      { id: 'm1', matchStatus: 'finished', scoreA: 2, scoreB: 1 },
      { id: 'm2', matchStatus: 'finished', scoreA: 0, scoreB: 0 },
    ];
    expect(categorizeTournament(turnier('2026-10-23', 'fixed', alleErgebnisse))).toBe('running');
  });
  it('@LZ-006 Gegenbeispiel: der alte Haken „manuallyCompleted“ in den Daten zählt nicht (ohne Abschluss am Server: Läuft)', () => {
    const t = turnier('2026-10-23', 'fixed', angepfiffen, { ...({ manuallyCompleted: true } as object) });
    expect(categorizeTournament(t)).toBe('running');
  });
  it('@LZ-006 Gegenbeispiel: auch der alte „dashboardStatus: finished“ in der Konfiguration zählt nicht', () => {
    const row = createTournamentRow({ status: 'published', lifecycle_status: 'fixed', date: '2026-10-23', config: { dashboardStatus: 'finished', manuallyCompleted: true } });
    const t = { ...mapTournamentFromSupabase(row, [], []), matches: angepfiffen } as unknown as Tournament;
    expect(categorizeTournament(t)).toBe('running');
  });
  it('@LZ-001 Datum gestern, ein Spiel angepfiffen, nicht abgeschlossen (über Mitternacht): Läuft', () => {
    expect(categorizeTournament(turnier('2026-10-22', 'fixed', angepfiffen))).toBe('running');
  });
  it('@LZ-001 Datum gestern, nichts angepfiffen, nicht abgeschlossen: nicht im Archiv, sondern Festgelegt (kommend)', () => {
    expect(categorizeTournament(turnier('2026-10-22', 'fixed', nichtAngepfiffen))).toBe('upcoming');
  });
  it('@LZ-005 Datum vor 10 Tagen, angepfiffen, nicht abgeschlossen: weiter Läuft, nicht im Archiv', () => {
    expect(categorizeTournament(turnier('2026-10-13', 'fixed', angepfiffen))).toBe('running');
  });
  it('@LZ-005 Datum vor 10 Tagen, nichts angepfiffen, nicht abgeschlossen: nicht im Archiv', () => {
    expect(categorizeTournament(turnier('2026-10-13', 'fixed', nichtAngepfiffen))).not.toBe('finished');
  });
  it('@W5-027 abgeschlossen, Datum in der Zukunft: Archiv, nicht kommend', () => {
    expect(categorizeTournament(turnier('2099-11-26', 'finished', nichtAngepfiffen))).toBe('finished');
  });
  it('@LZ-001 abgebrochen, Datum in der Zukunft: Archiv, nicht kommend', () => {
    expect(categorizeTournament(turnier('2099-11-26', 'cancelled', nichtAngepfiffen))).toBe('finished');
  });
  it('Archiv-Ablage nach Jahr: nur abgeschlossene, nach Datum gruppiert; ein Läuft-Turnier mit allen Ergebnissen steht nicht dort', () => {
    const kat = getExtendedCategories([
      turnier('2025-03-01', 'finished'), turnier('2026-03-01', 'finished'), turnier('2026-03-02', 'fixed', alleEntschieden),
    ]);
    expect(Object.keys(kat.archivedByYear).sort()).toEqual(['2025', '2026']);
    expect(kat.archivedByYear[2026]).toHaveLength(1);
    expect(kat.running).toHaveLength(1);
  });
});
