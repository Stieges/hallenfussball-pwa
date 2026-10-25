/**
 * @LZ-005 Hinweis auf der Startseite, „wenn Olli die App öffnet“: Das Turnier läuft noch, jedes Spiel ist entschieden, das letzte Spiel
 * endete am 12.10.2026. Erwartung aus dem Gherkin (docs/anforderungen/2026-10-01_turnier-lebenszyklus.md): 6 Tage danach kein Hinweis,
 * 7 und 8 Tage danach ein Hinweis, dass das Turnier noch läuft. Gegenbeispiele: abgeschlossen, Helfer, Gast (kein Konto).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../test/realDeI18n';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
await initRealDeI18n();
const { TournamentCard } = await import('../TournamentCard');

const ENDE = '2026-10-12T16:00:00.000Z';
function turnier(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 'nikolaus', title: 'Nikolaus-Turnier', status: 'published', lifecycleStatus: 'fixed', anyMatchStarted: true, lastMatchEndedAt: ENDE, myRole: 'owner',
    teams: [], matches: [], startDate: '2026-10-12', startTime: '10:00', ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [], groupSystem: 'roundRobin', ...over,
  } as unknown as Tournament;
}
const zeige = (t: Tournament) => render(<TournamentCard tournament={t} categoryLabel="running" onClick={vi.fn()} />);
const am = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('@LZ-005 Hinweis „Turnier läuft noch“ an der Karte', () => {
  it('18.10.2026 (6 Tage danach): kein Hinweis', () => {
    am('2026-10-18T17:00:00.000Z');
    zeige(turnier());
    expect(screen.queryByTestId('tournament-late-finish')).toBeNull();
  });

  it.each(['2026-10-19T17:00:00.000Z', '2026-10-20T17:00:00.000Z'])('%s: Hinweis mit dem Datum des letzten Spiels', (jetzt) => {
    am(jetzt);
    zeige(turnier());
    expect(screen.getByTestId('tournament-late-finish')).toHaveTextContent('Das Turnier läuft noch');
    expect(screen.getByTestId('tournament-late-finish')).toHaveTextContent('12.10.2026');
  });

  it('Gegenbeispiele: abgeschlossen, Helfer (kann nicht abschließen) und lokales Turnier ohne Konto zeigen keinen Hinweis', () => {
    am('2026-10-25T10:00:00.000Z');
    const { unmount } = zeige(turnier({ lifecycleStatus: 'finished' }));
    expect(screen.queryByTestId('tournament-late-finish')).toBeNull();
    unmount();
    const helfer = zeige(turnier({ myRole: 'collaborator' }));
    expect(screen.queryByTestId('tournament-late-finish')).toBeNull();
    helfer.unmount();
    zeige(turnier({ myRole: undefined }));
    expect(screen.queryByTestId('tournament-late-finish')).toBeNull();
  });
});
