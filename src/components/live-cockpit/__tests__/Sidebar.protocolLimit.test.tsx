/**
 * Sidebar-Protokoll (M2/U5): das 10er-Limit zaehlt nur wirksame Eintraege — zurueckgenommene
 * verdraengen keine. U5: sichtbar sind nur Zurueckgenommene im Zeitfenster der gezeigten
 * wirksamen Eintraege (Zeitstempel >= dem des aeltesten gezeigten wirksamen Eintrags).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { Sidebar } from '../components/Sidebar';

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

describe('Sidebar Protokoll-Limit (M2/U5)', () => {
  it('Limit zaehlt nur wirksame: 10 wirksame bleiben sichtbar, Zurueckgenommene nur im Zeitfenster', () => {
    const events = Array.from({ length: 12 }, (_, i) => event(`e${i}`, 100 + i));
    // Fenster: 10 neueste wirksame (102..111) -> aeltester gezeigter = 102.
    const retractedEvents = [event('r-neu', 200), event('r-mitte', 105), event('r-alt', 5)];
    render(
      <Sidebar
        activePenalties={[]}
        events={events}
        retractedEvents={retractedEvents}
        homeTeamName="Heim"
        awayTeamName="Gast"
        homeTeamId="teamA"
        awayTeamId="teamB"
        onEventEdit={() => undefined}
      />,
    );
    // r-neu (200) und r-mitte (105) liegen im Fenster, r-alt (5) davor nicht.
    expect(screen.getAllByTestId('event-row-retracted')).toHaveLength(2);
    expect(screen.getAllByTitle('Bearbeiten')).toHaveLength(10);
  });
});
