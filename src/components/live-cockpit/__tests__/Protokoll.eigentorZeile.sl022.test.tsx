/**
 * Ereignisprotokoll im Cockpit (Desktop-Sidebar und Handy-Liste): @SL-022 ein wirksames Eigentor heißt „Eigentor <schießendes Team>, Nr. <n>“
 * (Befund C-EIGENTOR-PROTOKOLLZEILE); @SL-019 ein Tor „Tor FC Nord, Nr. 7“ (Spielzeit in der Zeitspalte); @SL-083 ohne Nummer
 * „Tor FC Nord, ohne Nr.“. Gegenbeispiel: ein normales Tor ist kein „Eigentor“.
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

/** Eigentor von SV Süd (Nr. 4) bei 5:40: begünstigt ist FC Nord. */
const eigentor: RuntimeMatchEvent = {
  id: 'og', timestampSeconds: 340, type: 'GOAL',
  payload: { teamId: 'fc-nord', ownGoal: true, ownGoalTeamId: 'sv-sued', playerNumber: 4 },
  scoreAfter: { home: 2, away: 0 },
};
const normalesTor: RuntimeMatchEvent = {
  id: 'g', timestampSeconds: 100, type: 'GOAL', payload: { teamId: 'fc-nord', playerNumber: 9 }, scoreAfter: { home: 1, away: 0 },
};
const teams = { homeTeamName: 'FC Nord', awayTeamName: 'SV Süd', homeTeamId: 'fc-nord', awayTeamId: 'sv-sued' };

beforeEach(() => { locale.current = 'de'; });

describe('@SL-022 Eigentor im Protokoll', () => {
  it('Sidebar: „Eigentor SV Süd, Nr. 4“ mit 05:40, keine Zeile „TOR FC Nord“ dafür', () => {
    render(<Sidebar events={[eigentor]} {...teams} />);
    expect(screen.getByText(/Eigentor SV Süd, Nr\. 4/)).toBeTruthy();
    expect(screen.getByText('05:40')).toBeTruthy();
    expect(screen.queryByText(/Tor FC Nord/)).toBeNull();
  });

  it('Handy-Liste: „Eigentor SV Süd, Nr. 4“ statt „TOR FC Nord #4“', () => {
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[eigentor]} {...teams} />);
    expect(screen.getByText(/Eigentor SV Süd, Nr\. 4/)).toBeTruthy();
    expect(screen.queryByText(/Tor FC Nord/)).toBeNull();
  });

  it('EN: „Own goal SV Süd, No. 4“', () => {
    locale.current = 'en';
    render(<Sidebar events={[eigentor]} {...teams} />);
    expect(screen.getByText(/Own goal SV Süd, No\. 4/)).toBeTruthy();
  });

  it('@SL-022 Eigentor ohne Nummer: „Eigentor SV Süd, ohne Nr.“ (nicht „…, Nr. undefined“, nicht FC Nord)', () => {
    render(<Sidebar events={[{ ...eigentor, payload: { ...eigentor.payload, playerNumber: undefined } }]} {...teams} />);
    expect(screen.getByText(/Eigentor SV Süd, ohne Nr\./)).toBeTruthy();
  });

  it('@SL-019 Tor mit Nummer: „Tor FC Nord, Nr. 9“ mit 01:40 in Sidebar und Handy-Liste', () => {
    const { unmount } = render(<Sidebar events={[normalesTor]} {...teams} />);
    expect(screen.getByText(/Tor FC Nord, Nr\. 9/)).toBeTruthy();
    expect(screen.getByText('01:40')).toBeTruthy();
    expect(screen.queryByText(/Eigentor/)).toBeNull();
    unmount();
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[normalesTor]} {...teams} />);
    expect(screen.getByText(/Tor FC Nord, Nr\. 9/)).toBeTruthy();
    expect(screen.queryByText(/Eigentor/)).toBeNull();
  });

  it('@SL-083 Tor ohne Nummer: „Tor FC Nord, ohne Nr.“ in Sidebar und Handy-Liste', () => {
    const ohne: RuntimeMatchEvent = { ...normalesTor, payload: { teamId: 'fc-nord' } };
    const { unmount } = render(<Sidebar events={[ohne]} {...teams} />);
    expect(screen.getByText(/Tor FC Nord, ohne Nr\./)).toBeTruthy();
    unmount();
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[ohne]} {...teams} />);
    expect(screen.getByText(/Tor FC Nord, ohne Nr\./)).toBeTruthy();
  });

  it('Handy-Liste EN: Texte kommen aus der Übersetzung (kein festes „TOR“/„Gelbe Karte“)', () => {
    locale.current = 'en';
    const gelb: RuntimeMatchEvent = { id: 'y', timestampSeconds: 30, type: 'YELLOW_CARD', payload: { teamId: 'sv-sued', playerNumber: 5 }, scoreAfter: { home: 0, away: 0 } };
    render(<EventLogBottomSheet isOpen onClose={() => undefined} events={[normalesTor, gelb]} {...teams} />);
    expect(screen.getByText(/Goal FC Nord, No\. 9/)).toBeTruthy();
    expect(screen.getByText(/Yellow card SV Süd #5/)).toBeTruthy();
  });
});
