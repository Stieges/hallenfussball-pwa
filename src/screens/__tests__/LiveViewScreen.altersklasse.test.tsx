/**
 * Zuschauer-Seite: Altersklasse im Kopf (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026).
 * Gemockt nur die Datenquellen (wie LiveViewScreen.kindermodus.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from './liveViewFixture';

// Echte i18n-Instanz mit den DE-Texten (der globale Setup-Mock liefert nur Schlüssel), wie slotLabel.test.ts.
vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../i18n/locales/de/tournament.json')).default;
  const en = (await import('../../i18n/locales/en/tournament.json')).default;
  const dePv = (await import('../../i18n/locales/de/publicView.json')).default;
  const enPv = (await import('../../i18n/locales/en/publicView.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de, publicView: dePv }, en: { tournament: en, publicView: enPv } },
    interpolation: { escapeValue: false },
  });
  return { default: instance };
});

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
// Konstruktor-Mock als `function` (nicht Pfeil), damit `new SupabaseRepository()` funktioniert.
vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));
// Mit Supabase liest die Seite über die Server-Funktion (Adapter (b)), ohne Supabase über getByShareCode (Adapter (a)).
// Diese Datei prüft die Anzeige mit Daten aus den Repository-Mocks und legt deshalb den Weg ohne Supabase fest (Adapter (a)).
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

async function renderWith(tournament: Tournament) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
  // @ZM-210: die Altersklasse steht in den Einzelheiten unter dem Turniernamen (nicht mehr in der Kopfzeile „Altersklasse • Datum“); ohne Angabe fehlt die Zeile
  return screen.queryByTestId('public-head-age')?.textContent ?? '';
}

describe('Altersklasse auf der Zuschauer-Seite (@W2B-022, @W2B-024, @W2B-026)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@W2B-022 ohne Altersklasse steht kein Platzhalter und keine leere Zeile', async () => {
    const age = await renderWith({ ...buildLiveViewTournament({}), ageClass: '' });
    expect(age).toBe('');
    expect(screen.getByTestId('public-head-when-where').textContent).not.toMatch(/Keine Angabe|\u2022/i);
    expect(document.body.textContent).not.toMatch(/Keine Angabe/i);
  });

  it('@W2B-024 U11 steht genau so da, ohne Umrechnung', async () => {
    const subtitle = await renderWith({ ...buildLiveViewTournament({}), ageClass: 'U11' });
    expect(subtitle).toContain('U11');
    expect(subtitle).not.toContain('E-Jugend');
  });

  it('@W2B-026 ein alter Wert „AH“ steht weiter da', async () => {
    const subtitle = await renderWith({ ...buildLiveViewTournament({}), ageClass: 'AH' });
    expect(subtitle).toContain('AH');
  });
});
