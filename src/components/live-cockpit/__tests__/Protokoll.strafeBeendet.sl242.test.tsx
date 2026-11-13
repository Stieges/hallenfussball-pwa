/**
 * @SL-242 Ereignisprotokoll im Cockpit (Desktop-Sidebar und Handy-Liste): in der Zeile der Zeitstrafe steht „beendet durch Tor 02:40“,
 * wenn ein Gegentor sie beendet hat (Zeit im Format der übrigen Protokollzeiten). Eine Zeile ohne Zusatz bleibt ohne; eine
 * zurückgenommene Strafe trägt keinen. Die Ableitung selbst prüft `viewAdapters.strafeBeendet.sl242.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { Sidebar } from '../components/Sidebar';
import { EventLogBottomSheet } from '../components/EventLogBottomSheet';

const locale = vi.hoisted((): { current: 'de' | 'en' } => ({ current: 'de' }));

vi.mock('react-i18next', async () => {
  const bundles: Record<'de' | 'en', unknown> = {
    de: (await import('../../../i18n/locales/de/cockpit.json')).default,
    en: (await import('../../../i18n/locales/en/cockpit.json')).default,
  };
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      bundles[locale.current],
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) { text = text.replace(`{{${name}}}`, String(value)); }
    return text;
  };
  return { useTranslation: () => ({ t: translate, i18n: { language: locale.current } }) };
});

const teams = { homeTeamName: 'FC Nord', awayTeamName: 'SV Süd', homeTeamId: 'fc-nord', awayTeamId: 'sv-sued' };
const strafe = (extra: Partial<RuntimeMatchEvent> = {}): RuntimeMatchEvent => ({
  id: 'p', timestampSeconds: 120, type: 'TIME_PENALTY', payload: { teamId: 'sv-sued', playerNumber: 6, penaltyDuration: 120 },
  scoreAfter: { home: 0, away: 0 }, ...extra,
});
const tor: RuntimeMatchEvent = {
  id: 'g', timestampSeconds: 160, type: 'GOAL', payload: { teamId: 'fc-nord', playerNumber: 9 }, scoreAfter: { home: 1, away: 0 },
};

beforeEach(() => { locale.current = 'de'; });

describe('@SL-242 Zusatz „beendet durch Tor“ im Cockpit-Protokoll', () => {
  it('Sidebar: Strafzeile trägt „beendet durch Tor 02:40“', () => {
    render(<Sidebar events={[strafe({ endedByGoalSeconds: 160 }), tor]} {...teams} />);
    expect(screen.getByTestId('event-penalty-ended-by-goal').textContent).toBe('beendet durch Tor 02:40');
  });

  it('Handy-Liste: Strafzeile trägt „beendet durch Tor 02:40“, Zeit der Zeile bleibt 02:00', () => {
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[strafe({ endedByGoalSeconds: 160 }), tor]} {...teams} />);
    expect(screen.getByTestId('event-penalty-ended-by-goal').textContent).toBe('beendet durch Tor 02:40');
    expect(screen.getByText('02:00')).toBeTruthy();
  });

  it('EN: „ended by goal 02:40“', () => {
    locale.current = 'en';
    render(<Sidebar events={[strafe({ endedByGoalSeconds: 160 })]} {...teams} />);
    expect(screen.getByTestId('event-penalty-ended-by-goal').textContent).toBe('ended by goal 02:40');
  });

  it('Gegenbeispiel: Strafzeile ohne Angabe (abgelaufen, läuft, Regel aus, Tor zurückgenommen) trägt keinen Zusatz', () => {
    const { unmount } = render(<Sidebar events={[strafe(), tor]} {...teams} />);
    expect(screen.queryByTestId('event-penalty-ended-by-goal')).toBeNull();
    unmount();
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[strafe(), tor]} {...teams} />);
    expect(screen.queryByTestId('event-penalty-ended-by-goal')).toBeNull();
  });

  it('Gegenbeispiel: nur die Zeitstrafe trägt den Zusatz, nicht das Tor, selbst wenn das Feld dort stünde', () => {
    render(<Sidebar events={[strafe({ endedByGoalSeconds: 160 }), { ...tor, endedByGoalSeconds: 160 }]} {...teams} />);
    expect(screen.getAllByTestId('event-penalty-ended-by-goal')).toHaveLength(1);
  });

  it('eine zurückgenommene Strafzeile trägt keinen Zusatz', () => {
    render(<Sidebar events={[]} retractedEvents={[strafe({ endedByGoalSeconds: 160 })]} {...teams} />);
    expect(screen.queryByTestId('event-penalty-ended-by-goal')).toBeNull();
  });

  it('der Vorlesetext der Zeile (Bearbeiten-Taste) enthält den Zusatz, in Sidebar und Handy-Liste', () => {
    const onEdit = vi.fn();
    const { unmount } = render(<Sidebar events={[strafe({ endedByGoalSeconds: 160 })]} onEventEdit={onEdit} {...teams} />);
    expect(screen.getByLabelText(/beendet durch Tor 02:40/)).toBeTruthy();
    unmount();
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[strafe({ endedByGoalSeconds: 160 })]} onEventEdit={onEdit} {...teams} />);
    expect(screen.getByLabelText(/beendet durch Tor 02:40.*bearbeiten/)).toBeTruthy();
  });
});
