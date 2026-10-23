/**
 * Kindermodus auf der Zuschauer-Seite (@TM-036, @TM-015): offene Seiten zeigen „noch offen“ statt der Herkunft,
 * wenn hideScoresForPublic gesetzt ist. Die Verdrahtung LiveViewScreen → ScheduleDisplay (hidePendingOrigin)
 * wird am gerenderten Screen geprüft, nicht nur an der Helferfunktion.
 * Gemockt nur die Datenquellen (wie LiveViewScreen.scenarios.test.tsx).
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
  const instance = actual.default.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: false,
    resources: { de: { tournament: de }, en: { tournament: en } },
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
// Seit dem B-15-Anschluss liest die Seite standardmäßig über die Server-Funktion (Adapter (b)). Diese Datei prüft die
// Anzeige mit Daten aus den Repository-Mocks und nimmt deshalb ausdrücklich den Weg über getByShareCode (Adapter (a)).
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createLegacyPublicSource } = await import('../../features/public-view/legacyPublicSource');
  return { defaultPublicTournamentSource: createLegacyPublicSource() };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';

function renderScreen() {
  // RepositoryProvider mit user=null wie in der App: lokale Repos, kein Netz.
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[`/live/${SHARE_CODE}`]}>
        <LiveViewScreen shareCode={SHARE_CODE} />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

async function renderWith(tournament: Tournament) {
  supabaseGet.mockResolvedValue(tournament);
  localGet.mockResolvedValue(null);
  renderScreen();
  await screen.findAllByRole('heading', { level: 1, name: tournament.title });
}

/**
 * Gruppenphase plus Finalrunde „Top 4“: der Generator plant die offenen Halbfinal-Seiten. Die Fixture-Playoff-Spiele
 * liest der Spielplan nicht (kein finalsConfig), deshalb werden sie hier herausgefiltert.
 * Die Paarung selbst ist nicht Gegenstand (Befund C-HF-PAARUNG-VERTAUSCHT); geprüft wird nur der Herkunfts-Wortlaut.
 */
function withTop4(hide: boolean): Tournament {
  const t = buildLiveViewTournament({ hideScoresForPublic: hide });
  return {
    ...t,
    matches: t.matches.filter((m) => m.isFinal !== true),
    finals: { final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false },
    finalsConfig: { preset: 'top-4' },
  };
}

const ORIGIN = /^(Erster|Zweiter) Gruppe [AB]$/;

describe('@TM-036 Kindermodus – Zuschauer-Seite zeigt keine Herkunft mit Platz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Kindermodus an: offene Halbfinal-Seiten zeigen „noch offen“, keine Herkunft', async () => {
    await renderWith(withTop4(true));
    expect(screen.queryAllByText(ORIGIN)).toHaveLength(0);
    expect(screen.getAllByText('noch offen').length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel ohne Kindermodus: offenes Halbfinale zeigt die Herkunft „Erster/Zweiter Gruppe X“', async () => {
    await renderWith(withTop4(false));
    expect(screen.getAllByText(ORIGIN).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('noch offen')).toHaveLength(0);
  });
});
