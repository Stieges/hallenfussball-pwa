/**
 * @ZM-002 @ZM-003 @ZM-021 Ereignisliste nach dem Abpfiff (Zuschauer-Seite, beendetes Spiel): dieselben Zeilen wie in der laufenden Liste –
 * „Tor FC Nord, Nr. 9, 3.“, „Tor FC Nord, 12.“, „Zeitstrafe SV Süd, Nr. 5, 4.“, „Gelbe Karte SV Süd, Nr. 5“ (Minute statt Uhrzeit).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../../types/tournament';
import { EventList } from '../EventList';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../../test/realDeI18n')).initRealDeI18n();

const ev = (id: string, type: RuntimeMatchEvent['type'], timestampSeconds: number, payload: RuntimeMatchEvent['payload']): RuntimeMatchEvent =>
  ({ id, type, timestampSeconds, payload, scoreAfter: { home: 0, away: 0 } });

const events = [
  ev('g1', 'GOAL', 120, { teamId: 'nord', playerNumber: 9 }),
  ev('g2', 'GOAL', 680, { teamId: 'nord' }),
  ev('g3', 'GOAL', 60, { teamId: 'nord', playerNumber: 7 }),
  ev('p1', 'TIME_PENALTY', 200, { teamId: 'sued', playerNumber: 5, penaltyDuration: 120 }),
  ev('o1', 'GOAL', 340, { teamId: 'nord', ownGoal: true, ownGoalTeamId: 'sued', playerNumber: 4 }),
  ev('o2', 'GOAL', 400, { teamId: 'nord', ownGoal: true, ownGoalTeamId: 'sued' }),
  ev('y1', 'YELLOW_CARD', 90, { teamId: 'sued', playerNumber: 5 }),
];

function zeigen() {
  render(<EventList events={events} homeTeamId="nord" awayTeamId="sued" homeTeamName="FC Nord" awayTeamName="SV Süd" />);
}

describe('@ZM-002 Liste nach dem Abpfiff', () => {
  it('Tor mit Nummer: „Tor FC Nord, Nr. 9, 3.“', () => {
    zeigen();
    expect(screen.getByText('Tor FC Nord, Nr. 9, 3.')).toBeTruthy();
  });

  it('@ZM-003 Tor ohne Nummer: „Tor FC Nord, 12.“', () => {
    zeigen();
    expect(screen.getByText('Tor FC Nord, 12.')).toBeTruthy();
  });

  it('genau 60 s ist Minute 2', () => {
    zeigen();
    expect(screen.getByText('Tor FC Nord, Nr. 7, 2.')).toBeTruthy();
  });

  it('Zeitstrafe: „Zeitstrafe SV Süd, Nr. 5, 4.“ (ohne „2 Min“ und „#“)', () => {
    zeigen();
    expect(screen.getByText('Zeitstrafe SV Süd, Nr. 5, 4.')).toBeTruthy();
  });

  it('@ZM-021 Karte: „Gelbe Karte SV Süd, Nr. 5“', () => {
    zeigen();
    expect(screen.getByText('Gelbe Karte SV Süd, Nr. 5')).toBeTruthy();
  });

  it('Gegenbeispiel: keine Uhrzeit-Spalte bei Tor, Zeitstrafe und Karte', () => {
    zeigen();
    expect(document.body.textContent).not.toMatch(/\d\d:\d\d|#/);
  });

  it('@ZM-186 Eigentor: „Eigentor SV Süd, Nr. 4, 6.“, ohne Nummer „Eigentor SV Süd, 7.“ (schießendes Team, nicht FC Nord)', () => {
    zeigen();
    expect(screen.getByText('Eigentor SV Süd, Nr. 4, 6.')).toBeTruthy();
    expect(screen.getByText('Eigentor SV Süd, 7.')).toBeTruthy();
    expect(screen.queryByText(/^Tor FC Nord, (Nr\. 4, )?[67]\.$/)).toBeNull();
  });

  it('@ZM-186 EN: „Own goal SV Süd, No. 4, 6.“', async () => {
    const { default: i18n } = await import('i18next');
    const { default: enTournament } = await import('../../../../i18n/locales/en/tournament.json');
    i18n.addResourceBundle('en', 'tournament', enTournament, true, true);
    await i18n.changeLanguage('en');
    try {
      zeigen();
      expect(screen.getByText('Own goal SV Süd, No. 4, 6.')).toBeTruthy();
    } finally {
      await i18n.changeLanguage('de');
    }
  });
});
