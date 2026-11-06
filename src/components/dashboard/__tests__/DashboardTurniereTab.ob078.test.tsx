/**
 * @OB-078 Am Turniertag stehen die Turniere des Tages oben und offen (docs/anforderungen/2026-10-02_oberflaeche.md).
 * Gegeben heute ist Samstag, 28.11., und auf dem Gerät liegen F2 (08:30), F1 (13:00), D (16:30), die Turniere vom Sonntag,
 * eine nie angepfiffene Probe-Kopie vom 26.11. und der Herbstcup vom 24.10. (läuft, nie abgeschlossen). Die Aufteilung
 * prüft startseiteAbschnitte.test.ts; hier die Darstellung: Reihenfolge der Abschnitte, offen, nie von selbst zu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: 'not-started' }) }));

import { DashboardTurniereTab } from '../DashboardTurniereTab';

function turnier(id: string, startDate: string, startTime: string, lage: 'bereit' | 'laeuft' | 'entwurf' = 'bereit'): Tournament {
  return {
    id, title: id, startDate, startTime, teams: [], placementLogic: [], location: { name: 'Halle' },
    status: lage === 'entwurf' ? 'draft' : 'published',
    matches: [{ id: 'm1', matchStatus: lage === 'laeuft' ? 'running' : 'scheduled' }],
  } as unknown as Tournament;
}
const geraet = (f2: 'bereit' | 'laeuft'): Tournament[] => [
  turnier('Herbstcup', '2026-10-24', '09:00', 'laeuft'),
  turnier('Probe-F2', '2026-11-26', '08:30'),
  turnier('G', '2026-11-29', '08:30'),
  turnier('D', '2026-11-28', '16:30'),
  turnier('F1', '2026-11-28', '13:00'),
  turnier('F2', '2026-11-28', '08:30', f2),
  turnier('Fruehjahrscup', '2027-03-06', '09:00', 'entwurf'),
];
const tab = (turniere: Tournament[]) => (
  <DashboardTurniereTab activeTournaments={turniere} searchQuery="" activeFilters={[]} onTournamentClick={vi.fn()} onDeleteTournament={vi.fn()} />
);
const kartenIds = (el: HTMLElement) => within(el).getAllByTestId(/^tournament-card-/).map((c) => c.getAttribute('data-testid')?.replace('tournament-card-', ''));

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 28, 8, 0)); });
afterEach(() => vi.useRealTimers());

describe('@OB-078 Am Turniertag stehen die Turniere des Tages oben und offen', () => {
  it('08:00: „Heute“ steht als erster Abschnitt mit F2, F1, D; Herbstcup und Probe-Kopie stehen darunter', () => {
    render(tab(geraet('bereit')));
    const abschnitte = screen.getAllByTestId(/^section-/);
    expect(abschnitte[0]).toHaveAttribute('data-testid', 'section-heute');
    expect(kartenIds(screen.getByTestId('section-heute'))).toEqual(['F2', 'F1', 'D']);
    expect(abschnitte.map((a) => a.getAttribute('data-testid'))).toEqual(['section-heute', 'section-running', 'section-upcoming', 'section-draft']);
    expect(kartenIds(screen.getByTestId('section-running'))).toEqual(['Herbstcup']);
    expect(kartenIds(screen.getByTestId('section-upcoming'))).toEqual(['Probe-F2', 'G']);
  });

  it('„Heute“ ist offen und bleibt offen, wenn F2 angepfiffen wird; Kommende Turniere klappen dabei nicht zu', () => {
    const { rerender } = render(tab(geraet('bereit')));
    const kopf = () => within(screen.getByTestId('section-heute')).getAllByRole('button', { expanded: true })[0];
    expect(kopf()).toHaveAttribute('aria-expanded', 'true');
    rerender(tab(geraet('laeuft')));
    expect(kopf()).toHaveAttribute('aria-expanded', 'true');
    expect(kartenIds(screen.getByTestId('section-heute'))[0]).toBe('F2');
    expect(within(screen.getByTestId('section-upcoming')).getAllByRole('button', { expanded: true })[0]).toBeTruthy();
  });

  it('Gegenbeispiel: nur der Entwurf-Abschnitt ist von selbst zu; ohne Turnier von heute gibt es kein „Heute“', async () => {
    vi.setSystemTime(new Date(2026, 11, 1, 8, 0));
    render(tab(geraet('bereit')));
    expect(screen.queryByTestId('section-heute')).toBeNull();
    const entwuerfe = within(screen.getByTestId('section-draft')).getByRole('button', { expanded: false });
    expect(entwuerfe).toBeTruthy();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(entwuerfe);
  });
});
