/**
 * LiveCockpit: Meldung nach dem Zurücksetzen durch die Turnierleitung (Aufgabe 2.5).
 * Szenarien: @SL-068 (Spiel 13 steht wieder zum Anpfiff bereit), @SL-130 (neu angepfiffen beginnt es leer, Stand 0:0).
 * Echte deutsche Texte (cockpit.json).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';

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
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

/** Anstoßzeit wie das Cockpit sie zeigt (Ortszeit, HH:MM), aus dem Anstoß-Datum des Testspiels. */
const anstossZeit = (iso: string): string => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

describe('LiveCockpit: Zurückgesetzt', () => {
  it('@SL-068 @SL-130 zurückgesetzt: die Meldezeile nennt Spiel 13, der Stand ist 0:0, die Anstoßzeit steht bei der Uhr (@OB-068)', () => {
    const { rerender } = render(<LiveCockpit {...makeProps(makeLiveMatch({ number: 13, homeScore: 1 }))} />);
    rerender(<LiveCockpit {...makeProps(makeLiveMatch({ number: 13, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, events: [] }), { letzteZuruecksetzung: { id: 'r1', spielNummer: 13 } })} />);
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Spiel 13 von der Turnierleitung zurückgesetzt');
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0');
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement();
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent(anstossZeit(makeLiveMatch().scheduledKickoff));
  });

  it('@SL-068 Gegenbeispiel: beim Öffnen mit einer schon bekannten Zurücksetzung keine Meldung (auch nicht nach erneutem Rendern)', () => {
    const props = makeProps(makeLiveMatch({ number: 13, status: 'NOT_STARTED' }), { letzteZuruecksetzung: { id: 'r1', spielNummer: 13 } });
    const { rerender } = render(<LiveCockpit {...props} />);
    rerender(<LiveCockpit {...props} />);
    expect(screen.queryAllByText('Spiel 13 von der Turnierleitung zurückgesetzt')).toHaveLength(0);
  });

  it('@SL-068 eine zweite Zurücksetzung (neue Kennung) während das Cockpit offen ist meldet sich erneut', () => {
    const match = makeLiveMatch({ number: 13, status: 'NOT_STARTED' });
    const { rerender } = render(<LiveCockpit {...makeProps(match, { letzteZuruecksetzung: { id: 'r1', spielNummer: 13 } })} />);
    rerender(<LiveCockpit {...makeProps(match, { letzteZuruecksetzung: { id: 'r2', spielNummer: 13 } })} />);
    expect(screen.getByTestId('notice-line')).toHaveTextContent('Spiel 13 von der Turnierleitung zurückgesetzt');
  });
});
