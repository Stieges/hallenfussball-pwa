/**
 * Paket D – @W1-037 und @W1-020 (zweiter Satz): Der Satz über „Festlegen“ stimmt für die Lage.
 *
 * Szenariogrundriss @W1-037 (Beispiele):
 *   angemeldet und online → „dass jeder mit dem Link zuschauen kann“
 *   nicht angemeldet      → „dass das Turnier nur auf diesem Gerät bleibt“
 * @W1-020: ein zweiter Satz nennt, was danach änderbar bleibt – nur Wahres, also keine Uhrzeiten
 * (Zeiten verschieben gibt es noch nicht). Bezug: @OB-002 (nichts ankündigen, was nicht wirkt).
 *
 * Echter Bedienweg: TournamentPreview mit AuthContext und echten deutschen/englischen Texten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import { AuthContext } from '../../auth/context/authContextInstance';
import type { AuthContextValue } from '../../auth/context/authContextValue';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';

const texts = vi.hoisted(() => ({ current: {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const value = key.split('.').reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        texts.current
      );
      return typeof value === 'string' ? value : key;
    },
    i18n: { language: 'de' },
  }),
  Trans: ({ children }: { children?: unknown }) => children,
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: vi.fn(() => ({ allMatches: [], initialStandings: [], endTime: new Date(), numberOfFields: 1 })),
}));
vi.mock('../../../components/ScheduleDisplay', () => ({ ScheduleDisplay: () => <div /> }));
vi.mock('../../../components/RefereeAssignmentEditor', () => ({ RefereeAssignmentEditor: () => <div /> }));
vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));


import { TournamentPreview } from '../TournamentPreview';

const tournament = {
  id: 't1', title: 'Cup', sport: 'football', isPublic: false, numberOfTeams: 2, numberOfFields: 1,
  teams: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }], matches: [], status: 'draft',
  location: { name: 'Halle' }, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Tournament;

const schedule = { allMatches: [], initialStandings: [], endTime: new Date(), numberOfFields: 1 } as unknown as GeneratedSchedule;

type TestUser = { id: string; globalRole: string } | null;
const konto: TestUser = { id: 'u1', globalRole: 'user' };
const anonym: TestUser = { id: 'a1', globalRole: 'user' };
const gast: TestUser = { id: 'g1', globalRole: 'guest' };

const lage = vi.hoisted(() => ({ configured: true }));
vi.mock('../../../lib/supabase', () => ({
  get isSupabaseConfigured() { return lage.configured; },
}));

const renderMit = (user: TestUser) => {
  render(
    <AuthContext.Provider value={(user ? { user } : undefined) as unknown as AuthContextValue | undefined}>
      <TournamentPreview tournament={tournament} schedule={schedule} onEdit={() => undefined} onPublish={() => undefined} />
    </AuthContext.Provider>
  );
  return screen.getByTestId('publish-explanation').textContent ?? '';
};

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
};

describe.each([
  ['de', deWizard, /jeder mit dem Link/, /nur auf diesem Gerät/, /Uhr|Zeit/i, /Ohne Netz bleibt das Turnier vorerst auf diesem Gerät/],
  ['en', enWizard, /anyone with the link/, /only on this device/, /time|clock|o'clock/i, /Without a connection the tournament stays on this device for now/],
])('Paket D (%s): Satz neben „Festlegen“', (_lang, wizard, linkSatz, geraetSatz, zeitWort, offlineSatz) => {
  beforeEach(() => { texts.current = wizard; lage.configured = true; setOnline(true); });
  afterEach(() => { setOnline(true); });

  it('@W1-037 angemeldet und online: jeder mit dem Link kann zuschauen', () => {
    const text = renderMit(konto);
    expect(text).toMatch(linkSatz);
    expect(text).not.toMatch(geraetSatz);
  });

  it('@W1-037 nicht angemeldet: nur auf diesem Gerät (Gegenbeispiel: kein „jeder mit dem Link“)', () => {
    const text = renderMit(null);
    expect(text).toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-037 Gast ohne Konto: wie nicht angemeldet', () => {
    const text = renderMit(gast);
    expect(text).toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-037 angemeldet, aber ohne Netz: vorerst auf diesem Gerät (nicht „nur“, kein Link)', () => {
    setOnline(false);
    const text = renderMit(konto);
    expect(text).toContain(wizard.publish.explanationOffline);
    expect(text).toMatch(offlineSatz);
    expect(text).not.toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-037 anonymes Konto zählt wie angemeldet (Cloud-Regel des Repositorys)', () => {
    expect(renderMit(anonym)).toMatch(linkSatz);
  });

  it('@W1-037 Supabase nicht eingerichtet: nur auf diesem Gerät, auch mit Konto', () => {
    lage.configured = false;
    const text = renderMit(konto);
    expect(text).toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-020 zweiter Satz nennt änderbare Dinge und keine Uhrzeiten', () => {
    const text = renderMit(konto);
    expect(text).toContain((wizard).publish.explanationChangeable);
    expect(wizard.publish.explanationChangeable).not.toMatch(zeitWort);
    expect(text).toMatch(_lang === 'de' ? /Teamnamen und Ergebnisse/ : /team names and results/);
  });
});
