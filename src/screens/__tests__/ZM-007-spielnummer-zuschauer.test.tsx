/**
 * Zuschauer-Seite: Spielkarte trägt die richtige Spielnummer (Befund C-SPIELNUMMER-FEHLT, Durchstich Nikolaus:
 * „Spiel 1 als Spiel 9“).
 *
 * @ZM-007 (Record Zuschauer und Monitor): „Und sie sieht Spiel 1 als beendet mit 2:0“ – Spiel 1 ist das erste Spiel
 * des Plans (13:00, Feld 1). Geprüft über den echten Lesepfad: Cloud-Zeilen ohne `match_number` in vertauschter
 * Reihenfolge → `mapTournamentFromSupabase` → Zuschauer-Seite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import { publishHallencup } from '../../core/view/__fixtures__/hallencupNord';
import { mapMatchToSupabase, mapTeamToSupabase, mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../tests/factories/supabase';
import { matchSideTeamId } from '../../core/models/matchSlot';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

/** „Hallencup Nord“, wie die Zuschauer-Seite es aus der Cloud liest: Spiele ohne Nummer, Zeilen vertauscht. */
async function hallencupAusDerCloud(): Promise<{ gelesen: Tournament; original: Tournament }> {
  const original = (await publishHallencup()).tournament;
  const rows = original.matches.map((m) => createMatchRow({ ...mapMatchToSupabase(m, original.id), match_number: null })).reverse();
  const ausCloud = mapTournamentFromSupabase(
    createTournamentRow({ id: original.id, date: original.date }),
    original.teams.map((t) => createTeamRow(mapTeamToSupabase(t, original.id))),
    rows,
  );
  return { gelesen: { ...original, matches: ausCloud.matches }, original };
}

function paarung(t: Tournament, index: number): string {
  const name = (side: 'A' | 'B') => t.teams.find((team) => team.id === matchSideTeamId(t.matches[index], side))?.name ?? '?';
  return `${name('A')} gegen ${name('B')}`;
}

async function zeigeZuschauerSeite(t: Tournament): Promise<void> {
  supabaseGet.mockResolvedValue(t);
  localGet.mockResolvedValue(null);
  render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${t.shareCode ?? ''}`]}>
        <LiveViewScreen shareCode={t.shareCode ?? ''} />
      </MemoryRouter>
    </RepositoryProvider>
  );
  await screen.findAllByRole('heading', { level: 1, name: 'Hallencup Nord' });
}

describe('@ZM-007 Zuschauer-Seite: Spiel 1 heißt „Spiel 1“', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@ZM-007 C-SPIELNUMMER-FEHLT: die Karte des ersten Spiels (13:00, Feld 1) heißt „Spiel 1“, auch wenn die Cloud keine Nummer gespeichert hat', async () => {
    const { gelesen, original } = await hallencupAusDerCloud();
    await zeigeZuschauerSeite(gelesen);

    const karten = screen.getAllByLabelText(/^Spiel 1: /);
    expect(karten.length).toBeGreaterThan(0);
    for (const karte of karten) {
      expect(karte).toHaveAccessibleName(`Spiel 1: ${paarung(original, 0)}`);
    }
  });

  it('@ZM-007 C-SPIELNUMMER-FEHLT Gegenbeispiel: „Spiel 9“ ist das neunte Spiel des Plans, nicht das erste', async () => {
    const { gelesen, original } = await hallencupAusDerCloud();
    await zeigeZuschauerSeite(gelesen);

    for (const karte of screen.getAllByLabelText(/^Spiel 9: /)) {
      expect(karte).toHaveAccessibleName(`Spiel 9: ${paarung(original, 8)}`);
    }
    expect(paarung(original, 8)).not.toBe(paarung(original, 0));
  });
});
