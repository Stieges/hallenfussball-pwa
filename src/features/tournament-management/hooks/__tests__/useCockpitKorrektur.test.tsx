/**
 * useCockpitKorrektur (B-10a2, @SL-159, @HE-043): „Korrigieren“ im Cockpit nach dem Abpfiff öffnet die Korrektur mit Grund – denselben
 * Weg wie der Spielplan (`useScheduleResultEntry.enterScore`), kein zweiter. Testwerte aus dem Gherkin: Olli leitet Spiel 11 selbst, 2:1
 * abgepfiffen, will ein Tor zurücknehmen. Die Grund-Auswahl selbst ist Gegenstand der Tests der Schnelleingabe (@EK-004); hier gilt, dass
 * der Weg geöffnet wird, mit dem bisherigen Ergebnis, nur für die Turnierleitung und ohne Speichern bei Abbruch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { makeLiveMatch } from '../../../../components/live-cockpit/__tests__/cockpitFixtures';
import type { LiveMatch } from '../../../../components/live-cockpit/types';
import type { Tournament } from '../../../../types/tournament';
import { useCockpitKorrektur } from '../useCockpitKorrektur';
import type { ResultEntryPrompt } from '../useScheduleResultEntry';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const mocks = vi.hoisted(() => ({ enterScore: vi.fn(), prompt: null as ResultEntryPrompt | null, answerPrompt: vi.fn(), lockFinished: [] as boolean[] }));
vi.mock('../useScheduleResultEntry', () => ({
  useScheduleResultEntry: (options: { lockFinishedResults: boolean }) => {
    mocks.lockFinished.push(options.lockFinishedResults);
    return { enterScore: mocks.enterScore, prompt: mocks.prompt, answerPrompt: mocks.answerPrompt, changeAuthor: vi.fn() };
  },
}));
vi.mock('../../../../components/ui/Toast', () => ({ useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) }));

const tournament = { id: 't1' } as Tournament;
const spiel11 = makeLiveMatch({ id: 'match-11', number: 11, status: 'FINISHED', homeScore: 2, awayScore: 1 });
const liveMatches = new Map<string, LiveMatch>([['match-11', spiel11]]);

const pause = { onBeginn: vi.fn(), onEnde: vi.fn() };

function Host({ istLeitung }: { istLeitung: boolean }) {
  const k = useCockpitKorrektur(tournament, liveMatches, istLeitung, pause);
  return (
    <div>
      <button type="button" data-testid="korrigieren" onClick={() => { k.onKorrigieren?.('match-11'); }} disabled={k.onKorrigieren === undefined}>Korrigieren</button>
      {k.dialoge}
    </div>
  );
}

beforeEach(() => { vi.clearAllMocks(); mocks.prompt = null; mocks.lockFinished.length = 0; mocks.enterScore.mockResolvedValue(true); });

describe('useCockpitKorrektur', () => {
  it('@SL-159 Turnierleitung: „Korrigieren“ öffnet die Korrektur von Spiel 11 mit dem bisherigen Ergebnis 2:1', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull();
    await user.click(screen.getByTestId('korrigieren'));
    expect(screen.getByTestId('cockpit-korrektur-dialog')).toHaveTextContent('Ergebnis von Spiel 11 korrigieren');
    expect(screen.getByTestId('cockpit-korrektur-dialog')).toHaveTextContent('FC Nord 2:1 SV Süd');
    expect(screen.getByTestId('cockpit-korrektur-home')).toHaveValue(2);
    expect(screen.getByTestId('cockpit-korrektur-away')).toHaveValue(1);
  });

  it('@SL-159 „Weiter“ mit dem korrigierten Ergebnis 1:1 geht in den Weg der Korrektur (Grund folgt dort), nichts wird hier gespeichert', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    await user.clear(screen.getByTestId('cockpit-korrektur-home'));
    await user.type(screen.getByTestId('cockpit-korrektur-home'), '1');
    await user.click(screen.getByTestId('cockpit-korrektur-weiter'));
    expect(mocks.enterScore).toHaveBeenCalledExactlyOnceWith('match-11', 1, 1);
    expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull();
  });

  it('Gegenbeispiel: ohne Änderung bleibt „Weiter“ gesperrt und der Hinweis nennt den Grund', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    expect(screen.getByTestId('cockpit-korrektur-weiter')).toBeDisabled();
    expect(screen.getByTestId('cockpit-korrektur-hint')).toHaveTextContent('Das neue Ergebnis muss sich vom ursprünglichen unterscheiden.');
    expect(mocks.enterScore).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Abbrechen speichert nichts und schließt den Dialog', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    await user.click(screen.getByTestId('cockpit-korrektur-cancel'));
    expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull();
    expect(mocks.enterScore).not.toHaveBeenCalled();
  });

  it('@HE-043 Helfer: es gibt keinen Weg zur Korrektur (kein Handler), also auch keinen Dialog', () => {
    render(<Host istLeitung={false} />);
    expect(screen.getByTestId('korrigieren')).toBeDisabled();
    expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull();
  });

  it('die ausdrückliche Korrektur ist nicht durch die Sperre der Schnelleingabe im Spielplan blockiert', () => {
    render(<Host istLeitung />);
    expect(mocks.lockFinished.some((gesperrt) => gesperrt)).toBe(false);
  });

  it('nach „Weiter“ zeigt der Weg der Korrektur seine Grund-Auswahl (Aufforderung des Schnelleingabe-Hooks)', () => {
    mocks.prompt = { kind: 'reason', matchNumber: 11, before: '2:1', after: '1:1' };
    render(<Host istLeitung />);
    expect(screen.getByTestId('result-entry-reason-dialog')).toHaveTextContent('Ergebnis von Spiel 11 ändern');
    expect(screen.getByTestId('result-entry-reason-dialog')).toHaveTextContent('bisher 2:1 – neu 1:1');
  });

  // @SL-163/@SL-164: solange die Korrektur offen ist (Dialog, Grund-Auswahl, Senden), pausiert der Countdown; Speichern oder Abbruch setzt ihn fort
  it('@SL-163 „Korrigieren“ hält den Countdown von Spiel 11 an, solange der Dialog offen ist', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    expect(pause.onBeginn).toHaveBeenCalledExactlyOnceWith('match-11');
    expect(pause.onEnde).not.toHaveBeenCalled();
  });

  it('@SL-164 „abbricht“: der Abbruch setzt den Countdown fort', async () => {
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    await user.click(screen.getByTestId('cockpit-korrektur-cancel'));
    expect(pause.onEnde).toHaveBeenCalledTimes(1);
  });

  it('@SL-164 „mit dem Grund speichert“: fortgesetzt wird erst, wenn der Weg der Korrektur fertig ist, nicht schon beim Wechsel zur Grund-Auswahl', async () => {
    let fertig: (ok: boolean) => void = () => undefined;
    mocks.enterScore.mockReturnValue(new Promise<boolean>((resolve) => { fertig = resolve; }));
    const user = userEvent.setup();
    render(<Host istLeitung />);
    await user.click(screen.getByTestId('korrigieren'));
    await user.clear(screen.getByTestId('cockpit-korrektur-home'));
    await user.type(screen.getByTestId('cockpit-korrektur-home'), '1');
    await user.click(screen.getByTestId('cockpit-korrektur-weiter'));
    expect(pause.onEnde).not.toHaveBeenCalled(); // Gegenbeispiel: die Grund-Auswahl ist noch offen
    await act(async () => { fertig(true); });
    expect(pause.onEnde).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel @SL-166: ein Helfer hält keinen Countdown an (kein Weg, kein Anhalten)', () => {
    render(<Host istLeitung={false} />);
    screen.getByTestId('korrigieren').click();
    expect(pause.onBeginn).not.toHaveBeenCalled();
  });
});
