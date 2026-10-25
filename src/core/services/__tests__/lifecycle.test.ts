/**
 * R3-1: Turnier-Zustand lesen (@LZ-001, @LZ-002, @LZ-006). Erwartungen aus dem Gherkin
 * docs/anforderungen/2026-10-01_turnier-lebenszyklus.md, nicht am Code abgelesen. Eingang über den echten Mapper
 * (Server-Zeile), nicht über ein von Hand gebautes Turnier.
 */
import { describe, it, expect } from 'vitest';
import { actionsOffered, hasStartedMatch, isTournamentClosed, lifecycleOf, parseStoredLifecycle, storedLifecycleOf } from '../lifecycle';
import { mapTournamentFromSupabase } from '../../repositories/supabaseMappers';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import type { Match, Tournament } from '../../../types/tournament';
import twin from '../../standings/__fixtures__/lifecycle-of.json';

const match = (matchStatus: string): Match => ({ id: matchStatus + Math.random(), matchStatus }) as unknown as Match;

/** Eine Server-Zeile mit Spielen, durch den Lese-Mapper. */
function ausDemServer(lifecycle: string, matchStatuses: string[] = [], extra: Partial<Parameters<typeof createTournamentRow>[0]> = {}): Tournament {
  const row = createTournamentRow({ status: lifecycle === 'draft' ? 'draft' : 'published', lifecycle_status: lifecycle, ...extra });
  return { ...mapTournamentFromSupabase(row, [], []), matches: matchStatuses.map(match) };
}

describe('@LZ-001 Zustand des Turniers: eine Zeile je Lage', () => {
  const zeilen: Array<[string, Tournament, string]> = [
    ['Olli hat das Turnier angelegt, aber nicht festgelegt', ausDemServer('draft'), 'draft'],
    ['Olli hat das Turnier festgelegt, kein Spiel ist angepfiffen', ausDemServer('fixed', ['scheduled', 'scheduled']), 'fixed'],
    ['Tom hat das erste Gruppenspiel angepfiffen', ausDemServer('fixed', ['running', 'scheduled']), 'running'],
    ['alle 16 Spiele sind entschieden, Olli hat noch nicht abgeschlossen', ausDemServer('fixed', Array(16).fill('finished') as string[]), 'running'],
    ['Olli hat das Turnier abgeschlossen', ausDemServer('finished', Array(16).fill('finished') as string[], { finished_at: '2026-10-23T10:00:00Z' }), 'finished'],
    ['Olli hat das Turnier mit dem Grund „Hallenzeit vorbei“ abgebrochen', ausDemServer('cancelled', ['finished']), 'cancelled'],
  ];
  it.each(zeilen)('%s', (_lage, turnier, zustand) => {
    expect(lifecycleOf(turnier)).toBe(zustand);
  });

  it('Olli hat das abgeschlossene Turnier mit Grund wieder geöffnet: der Server setzt zurück auf festgelegt, die App zeigt Läuft', () => {
    expect(lifecycleOf(ausDemServer('fixed', ['finished', 'scheduled']))).toBe('running');
  });

  it('Olli hat das Turnier ohne Netz festgelegt (nur lokal, noch keine Server-Zeile): Festgelegt, nie etwas aus den Spielständen', () => {
    const lokal = { id: 'l', status: 'published', matches: [match('scheduled')] } as unknown as Tournament;
    expect(storedLifecycleOf(lokal)).toBe('fixed');
    expect(lifecycleOf(lokal)).toBe('fixed');
    expect(lifecycleOf({ ...lokal, status: 'draft' })).toBe('draft');
  });

  it('Gegenbeispiel: ein unbekannter Wert vom Server gilt nicht als Zustand', () => {
    expect(parseStoredLifecycle('completed')).toBeUndefined();
    expect(parseStoredLifecycle(null)).toBeUndefined();
    expect(parseStoredLifecycle('finished')).toBe('finished');
  });
});

describe('@LZ-006 die App leitet den Zustand nie aus Spielständen ab', () => {
  it('alle Spiele beendet, nicht abgeschlossen: weiter Läuft, nicht Abgeschlossen', () => {
    const alle = ausDemServer('fixed', ['finished', 'finished', 'skipped']);
    expect(lifecycleOf(alle)).toBe('running');
    expect(isTournamentClosed(alle)).toBe(false);
  });

  it('Gegenbeispiel: der Alt-Haken manuallyCompleted (und completedAt/dashboardStatus) ohne Abschluss am Server: Läuft', () => {
    const mitHaken = { ...ausDemServer('fixed', ['running']), manuallyCompleted: true, completedAt: '2026-10-01T00:00:00Z', dashboardStatus: 'finished' } as unknown as Tournament;
    expect(lifecycleOf(mitHaken)).toBe('running');
    expect(isTournamentClosed(mitHaken)).toBe(false);
  });

  it('Gegenbeispiel: nur der Abschluss am Server macht es abgeschlossen (auch ohne Spiele in der Liste)', () => {
    const liste = ausDemServer('finished', []);
    expect(lifecycleOf(liste)).toBe('finished');
    expect(isTournamentClosed(liste)).toBe(true);
  });

  it('Läuft aus der Zusatzabfrage der Cloud-Liste (ohne Spiele) wie mit Spielen', () => {
    expect(hasStartedMatch({ matches: [], anyMatchStarted: true })).toBe(true);
    expect(lifecycleOf({ ...ausDemServer('fixed'), anyMatchStarted: true })).toBe('running');
    expect(lifecycleOf(ausDemServer('fixed'))).toBe('fixed');
  });

  it('angepfiffen heißt laufend, pausiert oder beendet; wartend, geplant, übersprungen zählen nicht', () => {
    for (const s of ['running', 'paused', 'finished']) { expect(hasStartedMatch({ matches: [match(s)] }), s).toBe(true); }
    for (const s of ['scheduled', 'waiting', 'skipped']) { expect(hasStartedMatch({ matches: [match(s)] }), s).toBe(false); }
  });
});

describe('@LZ-002 Aktion zum Turnierende je Zustand (MVP-Teil: Turnier abschließen)', () => {
  const leitung = { manageLifecycle: true };
  it('Festgelegt: keine dieser Aktionen', () => {
    expect(actionsOffered('fixed', leitung)).toEqual([]);
  });
  it('Läuft: „Turnier abschließen“ wird angeboten', () => {
    expect(actionsOffered('running', leitung)).toEqual(['finish']);
  });
  it('Abgeschlossen und Abgebrochen: „Turnier abschließen“ wird nicht angeboten', () => {
    expect(actionsOffered('finished', leitung)).toEqual([]);
    expect(actionsOffered('cancelled', leitung)).toEqual([]);
  });
  it('Entwurf: nichts', () => {
    expect(actionsOffered('draft', leitung)).toEqual([]);
  });
  it('@LZ-022 Gegenbeispiel: ohne das Recht manageLifecycle (Helfer) auch im Zustand Läuft nichts', () => {
    expect(actionsOffered('running', { manageLifecycle: false })).toEqual([]);
  });
});

describe('Gleichlauf lifecycleOf == public.tournament_lifecycle (Fixture lifecycle-of.json, im Container erzeugt)', () => {
  it('die Fixture ist nicht leer und trägt zu jedem Fall eine Erwartung', () => {
    expect(twin.cases.length).toBeGreaterThanOrEqual(8);
    for (const fall of twin.cases) { expect(['draft', 'fixed', 'running', 'finished', 'cancelled'], fall.name).toContain(fall.expected); }
  });
  it.each(twin.cases.map((fall) => [fall.name, fall] as const))('%s', (_name, fall) => {
    const t = {
      id: 'x', status: fall.lifecycleStatus === 'draft' ? 'draft' : 'published',
      lifecycleStatus: fall.lifecycleStatus, matches: fall.matchStatuses.map(match),
    } as unknown as Tournament;
    expect(lifecycleOf(t)).toBe(fall.expected);
  });
});
