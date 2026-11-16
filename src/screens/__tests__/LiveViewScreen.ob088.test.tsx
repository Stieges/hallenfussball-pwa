/**
 * @OB-088 Zeile 2: Mama Petra öffnet die Zuschauer-Seite ohne Netz und liest „Fehler beim Laden“. Kommt das Netz zurück, lädt die Seite den
 * Spielplan von selbst; „Erneut versuchen“ bleibt als Taste stehen und wiederholt nur den Abruf – ohne die ganze Seite neu zu laden.
 * Gemockt nur die Datenquellen; Seite, Ansicht und Texte (echte DE-i18n) sind echt.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
  return { defaultPublicTournamentSource: createLegacyPublicSource(undefined, { pollIntervalMs: 10_000 }) };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fPAUSE, type Hallencup } from '../../core/view/__fixtures__/hallencupNord';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

const SHARE = 'NORD28';
let FIXTURE: Hallencup;
const neuladen = vi.fn();
const echtesLocation = window.location;

beforeAll(async () => { FIXTURE = await fPAUSE(); });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localGet.mockResolvedValue(null);
  // jsdom lässt `location.reload` nicht überwachen: ein Ersatz-Objekt, das jeden Neuladeversuch zählt
  Object.defineProperty(window, 'location', { configurable: true, value: { ...echtesLocation, reload: neuladen } });
});
afterEach(() => { Object.defineProperty(window, 'location', { configurable: true, value: echtesLocation }); });

async function ohneNetzGeoeffnet(): Promise<void> {
  supabaseGet.mockRejectedValue(new Error('Failed to fetch'));
  render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE}`]}><LiveViewScreen shareCode={SHARE} /></MemoryRouter>
    </RepositoryProvider>,
  );
  await screen.findByRole('heading', { name: 'Fehler beim Laden' });
}

describe('@OB-088 Zuschauer-Seite: Netz zurück', () => {
  it('@OB-088 Zeile 2: kommt das Netz zurück, lädt die Seite den Spielplan von selbst – ohne Tipp', async () => {
    await ohneNetzGeoeffnet();
    supabaseGet.mockResolvedValue(FIXTURE.tournament);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await screen.findAllByRole('heading', { level: 1, name: FIXTURE.tournament.title });
    expect(screen.queryByRole('heading', { name: 'Fehler beim Laden' })).toBeNull();
  });

  it('@OB-088 Zeile 2: „Erneut versuchen“ ruft den Abruf wieder auf und lädt die Seite nicht neu; bei Erfolg steht der Spielplan da', async () => {
    await ohneNetzGeoeffnet();
    const abrufeVorher = supabaseGet.mock.calls.length;
    supabaseGet.mockResolvedValue(FIXTURE.tournament);
    await act(async () => { fireEvent.click(screen.getByTestId('public-error-retry')); });
    await screen.findAllByRole('heading', { level: 1, name: FIXTURE.tournament.title });
    expect(supabaseGet.mock.calls.length).toBeGreaterThan(abrufeVorher);
    expect(neuladen).not.toHaveBeenCalled();
  });

  it('@OB-088 Zeile 2 Gegenbeispiel: scheitert der Abruf weiter, bleibt „Fehler beim Laden“ mit der Taste stehen, und die Taste ist danach wieder frei', async () => {
    await ohneNetzGeoeffnet();
    await act(async () => { fireEvent.click(screen.getByTestId('public-error-retry')); });
    expect(screen.getByRole('heading', { name: 'Fehler beim Laden' })).toBeInTheDocument();
    const taste = screen.getByTestId('public-error-retry');
    expect(taste).toHaveTextContent('Erneut versuchen');
    expect(taste).not.toHaveAttribute('aria-busy', 'true');
    expect(neuladen).not.toHaveBeenCalled();
  });

  it('@OB-087 Sperre: zwei Tipps im selben Takt lösen nur einen Abruf aus', async () => {
    await ohneNetzGeoeffnet();
    const abrufeVorher = supabaseGet.mock.calls.length;
    let fertig: (wert: unknown) => void = () => undefined;
    supabaseGet.mockImplementation(() => new Promise((ok) => { fertig = ok; }));
    const taste = screen.getByTestId('public-error-retry');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); });
    expect(supabaseGet.mock.calls.length - abrufeVorher).toBe(1);
    expect(screen.getByTestId('public-error-retry')).toHaveAttribute('aria-busy', 'true');
    await act(async () => { fertig(FIXTURE.tournament); });
  });
});
