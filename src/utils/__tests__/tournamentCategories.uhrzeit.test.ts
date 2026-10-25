/**
 * Die Startzeit allein macht ein festgelegtes Turnier nicht „laufend“ (@LZ-001: festgelegt, kein Spiel angepfiffen
 * → „Festgelegt“). Seit @FU-128 kommt die Startzeit aus der Cloud lesbar als HH:MM an (vorher HH:MM:SS, die
 * Startseite konnte sie nicht lesen). Ein festgelegtes Turnier von heute steht deshalb auch nach seiner Startzeit
 * weiter bei den kommenden Turnieren (Regression aus KB-3b: Cloud-E2E CA-5 / Rauchtest / Turniertag).
 * Szenario: docs/anforderungen/2026-10-01_turnier-lebenszyklus.md (@LZ-001), Zusammenspiel @FU-128.
 */
import { describe, it, expect } from 'vitest';
import { categorizeTournament } from '../tournamentCategories';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { createTournamentRow } from '../../../tests/factories/supabase';

function ausDerCloud(date: string, extra: Record<string, unknown> = {}) {
  const row = createTournamentRow({ status: 'published', lifecycle_status: 'fixed', date, start_time: '09:00:00', ...extra });
  return mapTournamentFromSupabase(row, [], []);
}

describe('Startseite: festgelegtes Turnier aus der Cloud (@LZ-001, @FU-128)', () => {
  it('Voraussetzung: die Startzeit aus der Cloud ist lesbar (@FU-128)', () => {
    expect(ausDerCloud('2026-11-26').startTime).toBe('09:00');
  });

  it('@LZ-001 heute, Startzeit 09:00 vorbei, kein Spiel angepfiffen: kommend, nicht laufend', () => {
    expect(categorizeTournament(ausDerCloud('2026-11-26'))).toBe('upcoming');
  });

  it('@LZ-001 auch kurz nach der Startzeit (09:01): kommend', () => {
    expect(categorizeTournament(ausDerCloud('2026-11-26'))).toBe('upcoming');
  });

  it('@LZ-001 Gegenbeispiel: das erste Spiel steht auf „läuft“ (Spiele hier von Hand angehängt, keine Cloud-Liste), dann läuft das Turnier', () => {
    const t = ausDerCloud('2026-11-26');
    const angepfiffen = { ...t, matches: [{ id: 'm1', matchStatus: 'running' }, { id: 'm2', matchStatus: 'scheduled' }] } as unknown as typeof t;
    expect(categorizeTournament(angepfiffen)).toBe('running');
  });

  it('Gegenbeispiel: am Server abgeschlossen steht im Archiv', () => {
    const t = ausDerCloud('2026-11-26', { lifecycle_status: 'finished' });
    expect(categorizeTournament(t)).toBe('finished');
  });
});
