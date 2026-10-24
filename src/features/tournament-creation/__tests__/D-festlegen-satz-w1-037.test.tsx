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

const konto = {
  user: { id: 'u1', email: 'o@example.org', name: 'Olli', globalRole: 'user' },
  isGuest: false,
  isAnonymous: false,
} as unknown as AuthContextValue;
const gast = {
  user: { id: 'g1', email: '', name: 'Gast', globalRole: 'guest' },
  isGuest: true,
  isAnonymous: false,
} as unknown as AuthContextValue;

const renderMit = (auth: AuthContextValue | undefined) => {
  render(
    <AuthContext.Provider value={auth}>
      <TournamentPreview tournament={tournament} schedule={schedule} onEdit={() => undefined} onPublish={() => undefined} />
    </AuthContext.Provider>
  );
  return screen.getByTestId('publish-explanation').textContent ?? '';
};

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
};

describe.each([
  ['de', deWizard, /jeder mit dem Link/, /nur auf diesem Gerät/, /Uhr|Zeit/i],
  ['en', enWizard, /anyone with the link/, /only on this device/, /time|clock|o'clock/i],
])('Paket D (%s): Satz neben „Festlegen“', (_lang, wizard, linkSatz, geraetSatz, zeitWort) => {
  beforeEach(() => { texts.current = wizard; setOnline(true); });
  afterEach(() => { setOnline(true); });

  it('@W1-037 angemeldet und online: jeder mit dem Link kann zuschauen', () => {
    const text = renderMit(konto);
    expect(text).toMatch(linkSatz);
    expect(text).not.toMatch(geraetSatz);
  });

  it('@W1-037 nicht angemeldet: nur auf diesem Gerät (Gegenbeispiel: kein „jeder mit dem Link“)', () => {
    const text = renderMit(undefined);
    expect(text).toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-037 Gast ohne Konto: wie nicht angemeldet', () => {
    const text = renderMit(gast);
    expect(text).toMatch(geraetSatz);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-037 angemeldet, aber offline: kein Link-Versprechen', () => {
    setOnline(false);
    const text = renderMit(konto);
    expect(text).not.toMatch(linkSatz);
  });

  it('@W1-020 zweiter Satz nennt änderbare Dinge und keine Uhrzeiten', () => {
    const text = renderMit(konto);
    expect(text).toContain((wizard).publish.explanationChangeable);
    expect(wizard.publish.explanationChangeable).not.toMatch(zeitWort);
    expect(text).toMatch(_lang === 'de' ? /Teamnamen und Ergebnisse/ : /team names and results/);
  });
});
