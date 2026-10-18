/**
 * LiveCockpit: Ton-Freigabe ohne schwebenden Hinweis (Aufgabe 2.4, Befund C-COCKPIT-SOUNDHINWEIS-VERDECKT).
 * Szenarien: @OB-021 (kein Element überlappt ein anderes), @SL-064 (Hinweise verdecken Uhr und Stand nicht),
 * @W2A-038 (Abpfiff-Ton vorbelegt an), @SL-009 (genau ein Abpfiff-Ton – braucht die Freigabe im Browser).
 * Der Browser gibt Ton nur nach einer Geste frei: der Tipp auf Anpfiff gibt ihn frei, sonst bleibt ein Abzeichen in der Tafel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ton = vi.hoisted(() => ({ activate: vi.fn(), isActivated: false }));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: ton.activate, isPlaying: false, isLoading: false, isReady: true, isActivated: ton.isActivated, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

const ABZEICHEN = 'Ton für das Spielende ist aus – antippen zum Einschalten';

beforeEach(() => {
  vi.clearAllMocks();
  ton.isActivated = false;
});

describe('LiveCockpit: Ton-Hinweis als Abzeichen der Tafel', () => {
  it('@OB-021 ist der Ton nicht freigegeben, steht das Abzeichen „Ton aus“ in der Tafel – kein schwebender Hinweis', () => {
    const { container } = render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    const knopf = screen.getByRole('button', { name: ABZEICHEN });
    expect(within(screen.getByTestId('scoreboard')).getByRole('button', { name: ABZEICHEN })).toBe(knopf);
    expect(knopf).toHaveTextContent('Ton aus');
    expect(screen.queryByText(/Sound für Spielende/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // nichts im Cockpit liegt fest über dem Inhalt
    const fest = Array.from(container.querySelectorAll<HTMLElement>('*')).filter((el) => getComputedStyle(el).position === 'fixed');
    expect(fest).toEqual([]);
  });

  it('@SL-064 das Abzeichen verdeckt Uhr und Stand nicht: es steht in der Kopfzeile der Tafel, vor Stand und Uhr', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    const knopf = screen.getByRole('button', { name: ABZEICHEN });
    expect(knopf.compareDocumentPosition(screen.getByTestId('scoreboard-clock')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('scoreboard-clock')).toBeVisible();
  });

  it('der Tipp auf das Abzeichen gibt den Ton frei', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(makeLiveMatch())} />);
    await user.click(screen.getByRole('button', { name: ABZEICHEN }));
    expect(ton.activate).toHaveBeenCalledTimes(1);
  });

  it('@SL-009 der Tipp auf „Anpfiff“ gibt den Ton frei (Browser-Geste) und pfeift an', async () => {
    const user = userEvent.setup();
    const props = makeProps(makeLiveMatch({ status: 'NOT_STARTED', homeScore: 0, awayScore: 0 }));
    render(<LiveCockpit {...props} />);
    await user.click(screen.getByTestId('match-start-button'));
    expect(ton.activate).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith('match-11');
  });

  // A4 (Review 2c): ein Abzeichen ohne Wirkung gehört nicht vor den Anpfiff und nicht in die Zustände ohne Spiel
  it('@OB-021 vor dem Anpfiff steht kein Abzeichen „Ton aus“: der Tipp auf Anpfiff gibt den Ton frei', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED' }))} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
  });

  it('@OB-021 ohne Spiel („kein Spiel mehr“, „wartet auf Teams“) steht kein Abzeichen „Ton aus“', () => {
    const { rerender } = render(<LiveCockpit {...makeProps(null, { leer: { art: 'keinSpiel', feldName: 'Feld 2' } })} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
    rerender(<LiveCockpit {...makeProps(null, { leer: { art: 'wartetAufHerkunft', gruende: ['Abschluss von Gruppe B'] } })} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
  });

  it('@OB-021 nach dem Abpfiff steht kein Abzeichen „Ton aus“ mehr', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'FINISHED' }))} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
  });

  it('@OB-021 Gegenbeispiel: im laufenden Spiel steht das Abzeichen weiter, wenn die Freigabe nicht gelang', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'RUNNING' }))} />);
    expect(screen.getByRole('button', { name: ABZEICHEN })).toBeInTheDocument();
  });

  it('Gegenbeispiel: ist der Ton schon freigegeben, gibt es kein Abzeichen und der Anpfiff aktiviert nichts doppelt', async () => {
    ton.isActivated = true;
    const user = userEvent.setup();
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'NOT_STARTED' }))} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
    await user.click(screen.getByTestId('match-start-button'));
    expect(ton.activate).not.toHaveBeenCalled();
  });

  it('@W2A-038 Gegenbeispiel: ist der Abpfiff-Ton in den Regeln aus, gibt es kein Abzeichen und der Anpfiff aktiviert keinen Ton', async () => {
    const user = userEvent.setup();
    const props = makeProps(makeLiveMatch({ status: 'NOT_STARTED' }), { cockpitSettings: { soundEnabled: false } as never });
    render(<LiveCockpit {...props} />);
    expect(screen.queryByRole('button', { name: ABZEICHEN })).toBeNull();
    await user.click(screen.getByTestId('match-start-button'));
    expect(ton.activate).not.toHaveBeenCalled();
    expect(props.onStart).toHaveBeenCalled();
  });
});
