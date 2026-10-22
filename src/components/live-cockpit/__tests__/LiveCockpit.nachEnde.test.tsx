/**
 * LiveCockpit nach dem Ende (B-10a2): Zusammenfassung statt Tastenblöcke (@SL-048, @SL-115), „Korrigieren“ nur für die Turnierleitung
 * (@SL-159, @SL-045), „Spiel ist beendet – Korrektur über die Turnierleitung“ nur für Helfer (@HE-043). Testwerte aus dem Gherkin
 * (Spiel 11, FC Nord – SV Süd 2:1) und dem Mockup „Laptop, abgepfiffen“. Echte deutsche Übersetzung; der Code wurde erst danach gelesen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';
import type { RuntimeMatchEvent } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

let nr = 0;
const ereignis = (type: RuntimeMatchEvent['type'], teamId: string, sekunden: number, payload: Partial<RuntimeMatchEvent['payload']> = {}): RuntimeMatchEvent => {
  nr += 1;
  return { id: `n${nr}`, matchId: 'match-11', type, timestampSeconds: sekunden, payload: { teamId, ...payload } } as RuntimeMatchEvent;
};
const EVENTS: RuntimeMatchEvent[] = [
  ereignis('GOAL', 'fc-nord', 110, { playerNumber: 9 }), ereignis('GOAL', 'fc-nord', 430), ereignis('GOAL', 'sv-sued', 395, { playerNumber: 3 }),
  ereignis('YELLOW_CARD', 'sv-sued', 75, { playerNumber: 7, cardType: 'YELLOW' }), ereignis('TIME_PENALTY', 'fc-nord', 460, { playerNumber: 4 }),
  ereignis('FOUL', 'fc-nord', 140), ereignis('FOUL', 'fc-nord', 310), ereignis('FOUL', 'sv-sued', 185), ereignis('FOUL', 'sv-sued', 270),
];
const alsKern = (liste: RuntimeMatchEvent[]): ReturnType<typeof makeLiveMatch>['events'] => liste as unknown as ReturnType<typeof makeLiveMatch>['events'];
const beendet = () => makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1, events: alsKern(EVENTS) });
const laeuft = () => makeLiveMatch({ status: 'RUNNING', homeScore: 2, awayScore: 1, events: alsKern(EVENTS) });

describe('@SL-048 Zusammenfassung statt Tastenblöcke nach dem Ende', () => {
  it('beendet: je Team Tore, Karten, Zeitstrafen und die Gesamtzahl der Fouls; keine Tor-, Foul-, Zeitstrafe-, Karte-Taste', () => {
    render(<LiveCockpit {...makeProps(beendet())} />);
    const nord = screen.getByTestId('team-summary-home');
    expect(within(nord).getByText('Tore (2)')).toBeInTheDocument();
    expect(within(nord).getByText('Nr. 9, 1:50')).toBeInTheDocument();
    expect(within(nord).getByText('Karten (0): keine')).toBeInTheDocument();
    expect(within(nord).getByText('Zeitstrafen (1)')).toBeInTheDocument();
    expect(within(nord).getByText('Fouls: 3')).toBeInTheDocument();
    const sued = screen.getByTestId('team-summary-away');
    expect(within(sued).getByText('Karten (1)')).toBeInTheDocument();
    expect(within(sued).getByText('Fouls: 3')).toBeInTheDocument();
    for (const seite of ['home', 'away']) {
      for (const taste of ['goal', 'foul', 'penalty', 'card']) { expect(screen.queryByTestId(`${taste}-button-${seite}`)).toBeNull(); }
    }
  });

  it('Gegenbeispiel: im laufenden Spiel stehen die Tasten und keine Zusammenfassung', () => {
    render(<LiveCockpit {...makeProps(laeuft())} />);
    expect(screen.getByTestId('goal-button-home')).toBeInTheDocument();
    expect(screen.queryByTestId('team-summary-home')).toBeNull();
  });

  it('@SL-115 nach dem Neuladen (neu eingehängt, nur aus dem Spiel gelesen) steht dieselbe Zusammenfassung wieder da', () => {
    const erste = render(<LiveCockpit {...makeProps(beendet())} />);
    const vorher = screen.getByTestId('team-summary-home').textContent;
    erste.unmount();
    render(<LiveCockpit {...makeProps(beendet())} />);
    expect(screen.getByTestId('team-summary-home').textContent).toBe(vorher);
  });

  it('die Zusammenfassung des Heimteams steht vor der des Gastes (Anzeige-Reihenfolge)', () => {
    render(<LiveCockpit {...makeProps(beendet())} />);
    const reihe = [screen.getByTestId('team-summary-home'), screen.getByTestId('team-summary-away')];
    expect(reihe[0].compareDocumentPosition(reihe[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('@SL-159 / @SL-045 / @HE-043 „Korrigieren“ nur für die Turnierleitung', () => {
  it('Turnierleitung nach dem Ende: „Korrigieren“ steht da, öffnet die Korrektur des Spiels, und kein Hinweis „Korrektur folgt“', async () => {
    const user = userEvent.setup();
    const onKorrigieren = vi.fn();
    render(<LiveCockpit {...makeProps(beendet(), { istLeitung: true, onKorrigieren })} />);
    await user.click(screen.getByRole('button', { name: 'Korrigieren' }));
    expect(onKorrigieren).toHaveBeenCalledWith('match-11');
    expect(screen.queryByText(/Korrektur folgt/)).toBeNull();
    expect(screen.queryByText(/nicht direkt zurücknehmbar/)).toBeNull();
    expect(screen.queryByTestId('bar-finished')).toBeNull();
  });

  it('Helfer nach dem Ende: kein „Korrigieren“, dafür „Spiel ist beendet – Korrektur über die Turnierleitung“', () => {
    render(<LiveCockpit {...makeProps(beendet(), { istLeitung: false, onKorrigieren: vi.fn() })} />);
    expect(screen.queryByRole('button', { name: 'Korrigieren' })).toBeNull();
    expect(screen.getByTestId('bar-finished')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
  });

  it('Gegenbeispiel: die Turnierleitung sieht den Hinweis für Helfer nicht', () => {
    render(<LiveCockpit {...makeProps(beendet(), { istLeitung: true, onKorrigieren: vi.fn() })} />);
    expect(screen.queryByText('Spiel ist beendet – Korrektur über die Turnierleitung')).toBeNull();
  });

  it('Gegenbeispiel: im laufenden Spiel gibt es kein „Korrigieren“, auch nicht für die Turnierleitung', () => {
    render(<LiveCockpit {...makeProps(laeuft(), { istLeitung: true, onKorrigieren: vi.fn() })} />);
    expect(screen.queryByRole('button', { name: 'Korrigieren' })).toBeNull();
  });

  it('ohne Korrektur-Weg (kein Handler) gibt es kein „Korrigieren“ und keinen toten Knopf', () => {
    render(<LiveCockpit {...makeProps(beendet(), { istLeitung: true })} />);
    expect(screen.queryByRole('button', { name: 'Korrigieren' })).toBeNull();
  });
});
