/**
 * @ZM-216 Bei einem Feld nennt die Zuschauer-Seite kein Feld (Gherkin in `2026-10-02_zuschauer-und-monitor.md`): in der Karte des laufenden Spiels
 * nur „Spiel 7“, unter „Mein Team“ „Spiel 9 · 14:40 Uhr gegen …“, im Spielplan keine Feldangabe. Aber bei zwei Feldern bleibt das Feld in den Karten,
 * unter „Mein Team“ und im Spielplan wie bisher. @ZP-116 (Spielkarten im Spielplan) wird hier auf der Zuschauer-Seite mitgeprüft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fPAUSE, fZEIT, NORD } from '../../core/view/__fixtures__/hallencupNord';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

const SHARE = 'NORD28';

/** Dasselbe Turnier auf einem Feld: alle Spiele auf Feld 1, Feldliste mit einem Eintrag. */
const aufEinemFeld = (t: Tournament): Tournament => ({
  ...t, numberOfFields: 1, fields: [{ id: 'field-1', defaultName: 'Feld 1' }], matches: t.matches.map((m) => ({ ...m, field: 1 })),
});

async function zeige(tournament: Tournament): Promise<HTMLElement> {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  const { container } = render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE}`]}><LiveViewScreen shareCode={SHARE} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  return container;
}

const meinTeam = () => vi.mocked(localStorage.getItem).mockImplementation((key: string) => (key === `live:${SHARE}:myTeam` ? NORD : null));
const kopfMeta = (): string => Array.from(document.querySelectorAll('[data-testid^="public-current-meta-"]')).map((e) => e.textContent ?? '').join('|');

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('@ZM-216 Zuschauer-Seite bei einem Feld', () => {
  it('die Karte des laufenden Spiels nennt „Spiel 7“ ohne Feld', async () => {
    await zeige(aufEinemFeld((await fPAUSE()).tournament));
    expect(kopfMeta()).toMatch(/Spiel \d+/);
    expect(kopfMeta()).not.toContain('Feld');
  });

  it('„Mein Team“: „Spiel … · hh:mm Uhr gegen …“ ohne Feld', async () => {
    meinTeam();
    await zeige(aufEinemFeld((await fZEIT()).tournament));
    const zeile = (await screen.findByTestId('my-team-next')).textContent ?? '';
    expect(zeile).toMatch(/^Spiel \d+ · \d\d:\d\d Uhr gegen /);
    expect(zeile).not.toContain('Feld');
  });

  it('@ZP-116 im Spielplan steht in keiner Karte „Feld 1“ und es gibt keine Spalte dafür', async () => {
    const c = await zeige(aufEinemFeld((await fPAUSE()).tournament));
    expect(c.querySelector('.group-stage-schedule')).not.toBeNull();
    expect(c.textContent ?? '').not.toMatch(/Feld \d/);
  });

  it('Gegenbeispiel zwei Felder: Karte, „Mein Team“ und Spielplan nennen das Feld wie bisher', async () => {
    meinTeam();
    const c = await zeige((await fZEIT()).tournament);
    expect(kopfMeta()).toMatch(/Feld \d/);
    expect((await screen.findByTestId('my-team-next')).textContent).toMatch(/Spiel \d+ · \d\d:\d\d Uhr · Feld \d gegen /);
    expect(c.querySelector('.group-stage-schedule')?.textContent ?? '').toMatch(/Feld \d/);
  });
});
