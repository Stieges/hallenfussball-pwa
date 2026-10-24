/**
 * EventLogBottomSheet (M4, Review C3b-1): Zurueckgenommenes im BottomSheet (Tablet/Handy) --
 * Marke „zurueckgenommen“ sichtbar, kein Bearbeiten-Knopf in der Zeile, aria-label nennt
 * „zurueckgenommen“.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { EventLogBottomSheet } from '../components/EventLogBottomSheet';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const event = (id: string, timestampSeconds: number): RuntimeMatchEvent => ({
  id,
  timestampSeconds,
  type: 'GOAL',
  payload: { teamId: 'teamA', teamName: 'Heim', playerNumber: 7 },
  scoreAfter: { home: 1, away: 0 },
});

describe('EventLogBottomSheet mit retractedEvents (M4)', () => {
  it('Marke sichtbar, kein Bearbeiten-Knopf in der Zeile, aria-label enthaelt „zurueckgenommen“', () => {
    render(
      <EventLogBottomSheet
        isOpen
        onClose={() => undefined}
        events={[event('e1', 30)]}
        retractedEvents={[event('r1', 20)]}
        homeTeamName="Heim"
        awayTeamName="Gast"
        homeTeamId="teamA"
        awayTeamId="teamB"
        onEventEdit={() => undefined}
      />,
    );

    const mark = screen.getByTestId('event-retracted-mark');
    expect(mark).toHaveTextContent('zurückgenommen');
    const row = mark.closest<HTMLElement>('[data-testid="event-row-retracted"]');
    if (!row) { throw new Error('keine Zeile fuer Zurueckgenommenes'); }
    expect(within(row).queryByRole('button')).toBeNull();
    expect(within(row).queryByText(/bearbeiten/i)).toBeNull();
    expect(row).toHaveAttribute('aria-label', expect.stringContaining('zurückgenommen'));
    expect(screen.getAllByRole('button', { name: /bearbeiten/i })).toHaveLength(1);
  });
});

describe('B-50 @FU-095 / B6.3: verworfene Klärungseinträge im Verlauf des Spiels', () => {
  const AT = new Date(2026, 10, 28, 12, 10).getTime();
  it('stehen als „verworfen von Olli, 12:10“, ohne Bearbeiten-Knopf, und zählen nicht als wirksamer Eintrag', () => {
    render(
      <EventLogBottomSheet
        isOpen
        onClose={() => undefined}
        events={[event('e1', 30)]}
        discardedEntries={[{ event: event('tor-nord', 60), by: 'Olli', at: AT }, { event: event('tor-sued', 70), by: 'Olli', at: AT }]}
        homeTeamName="Heim"
        awayTeamName="Gast"
        homeTeamId="teamA"
        awayTeamId="teamB"
        onEventEdit={() => undefined}
      />,
    );

    const marks = screen.getAllByTestId('event-discarded-mark');
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent('verworfen von Olli, 12:10');
    const rows = screen.getAllByTestId('event-row-discarded');
    for (const row of rows) {
      expect(within(row).queryByRole('button')).toBeNull();
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('verworfen von Olli'));
    }
    expect(screen.getAllByRole('button', { name: /bearbeiten/i })).toHaveLength(1);
    expect(screen.queryByTestId('event-retracted-mark')).toBeNull();
  });

  it('Gegenbeispiel: ohne Entscheidung (keine discardedEntries) keine Zeile „verworfen“', () => {
    render(
      <EventLogBottomSheet isOpen onClose={() => undefined} events={[event('e1', 30)]} homeTeamName="Heim" awayTeamName="Gast" homeTeamId="teamA" awayTeamId="teamB" />,
    );
    expect(screen.queryByTestId('event-discarded-mark')).toBeNull();
  });
});

