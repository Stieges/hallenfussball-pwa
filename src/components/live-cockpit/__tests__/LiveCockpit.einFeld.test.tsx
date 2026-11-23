/**
 * LiveCockpit, @SL-243: bei einem Feld nennt die Tafel kein Feld (echte deutsche Texte). Vor dem Anpfiff „Spiel 13“ statt „Spiel 13 · Feld 1“,
 * nach dem letzten Spiel „Heute folgt kein Spiel mehr“. Aber bei zwei Feldern bleibt es wie bisher („Spiel 13 · Feld 1“, „Auf Feld 2 folgt kein Spiel mehr“).
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

const spiel13 = makeLiveMatch({
  id: 'm13', number: 13, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff: new Date(2026, 10, 28, 15, 15).toISOString(),
  homeTeam: { id: 'tsv-west', name: 'TSV West' }, awayTeam: { id: 'sg-mitte', name: 'SG Mitte' },
});

describe('@SL-243 LiveCockpit: Feld in der Tafel nur bei mehreren Feldern', () => {
  it('ein Feld, vor dem Anpfiff: „Spiel 13“ ohne Feld', () => {
    render(<LiveCockpit {...makeProps(spiel13, { showField: false })} />);
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent(/^Spiel 13$/);
    expect(screen.getByTestId('scoreboard').textContent).not.toContain('Feld');
  });

  it('Gegenbeispiel zwei Felder: „Spiel 13 · Feld 1“ wie bisher', () => {
    render(<LiveCockpit {...makeProps(spiel13, { showField: true })} />);
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spiel 13 · Feld 1');
  });

  it('ohne Angabe (bisherige Aufrufer) bleibt das Feld stehen', () => {
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spiel 13 · Feld 1');
  });

  it('ein Feld, nach dem letzten Spiel: „Heute folgt kein Spiel mehr“', () => {
    render(<LiveCockpit {...makeProps(null, { showField: false, leer: { art: 'keinSpiel' } })} />);
    expect(screen.getByText('Heute folgt kein Spiel mehr')).toBeInTheDocument();
    expect(screen.getByTestId('scoreboard').textContent).not.toContain('Feld');
  });

  it('Gegenbeispiel zwei Felder: „Auf Feld 2 folgt kein Spiel mehr“ wie bisher', () => {
    render(<LiveCockpit {...makeProps(null, { showField: true, leer: { art: 'keinSpiel', feldName: 'Feld 2' } })} />);
    expect(screen.getByText('Auf Feld 2 folgt kein Spiel mehr')).toBeInTheDocument();
  });
});
