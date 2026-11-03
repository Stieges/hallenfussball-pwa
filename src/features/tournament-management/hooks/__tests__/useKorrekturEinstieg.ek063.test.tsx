/**
 * @EK-063 Die Korrektur beginnt im Spielplan oder im Cockpit der Turnierleitung, immer im selben Dialog.
 * Gherkin: „Spiel 7 FC Nord gegen SV Süd ist mit 2:1 beendet / Wenn Olli ‚Korrigieren‘ wählt / Dann öffnet sich die Korrektur von
 * Spiel 7 mit bisher und neu und der Auswahl des Grunds / Und es ist derselbe Dialog wie beim anderen Einstieg.“
 * Beide Einstiege (Spielplan: `useSpielplanKorrektur`, Cockpit: `useCockpitKorrektur`) öffnen dieselbe Komponente
 * (`CockpitKorrekturDialog`) mit demselben Inhalt und danach denselben Weg (`enterScore` der Schnelleingabe).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { makeLiveMatch } from '../../../../components/live-cockpit/__tests__/cockpitFixtures';
import type { LiveMatch } from '../../../../components/live-cockpit/types';
import type { TournamentView } from '../../../../core/view';
import type { Tournament } from '../../../../types/tournament';
import { CockpitKorrekturDialog } from '../../components/CockpitKorrekturDialog';
import { useCockpitKorrektur } from '../useCockpitKorrektur';
import { useSpielplanKorrektur } from '../useSpielplanKorrektur';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const mocks = vi.hoisted(() => ({ enterScore: vi.fn() }));
vi.mock('../useScheduleResultEntry', () => ({
  useScheduleResultEntry: () => ({ enterScore: mocks.enterScore, prompt: null, answerPrompt: vi.fn(), changeAuthor: vi.fn() }),
}));
vi.mock('../../../../components/ui/Toast', () => ({ useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) }));

const tournament = { id: 't1' } as Tournament;
const spiel7 = makeLiveMatch({ id: 'match-7', number: 7, status: 'FINISHED', homeScore: 2, awayScore: 1 });
const liveMatches = new Map<string, LiveMatch>([['match-7', spiel7]]);
const view = {
  byId: new Map([['match-7', { id: 'match-7', matchNumber: 7, score: { a: 2, b: 1 }, home: { label: spiel7.homeTeam.name }, away: { label: spiel7.awayTeam.name } }]]),
} as unknown as TournamentView;

function Spielplan({ istLeitung }: { istLeitung: boolean }) {
  const k = useSpielplanKorrektur({ view, enterScore: mocks.enterScore, istLeitung });
  return <div><button type="button" data-testid="plan-korrigieren" disabled={k.onKorrigieren === undefined} onClick={() => { k.onKorrigieren?.('match-7'); }}>Korrigieren</button><div>{k.dialog}</div></div>;
}
function Cockpit({ istLeitung }: { istLeitung: boolean }) {
  const k = useCockpitKorrektur(tournament, liveMatches, istLeitung);
  return <div><button type="button" data-testid="cockpit-korrigieren" disabled={k.onKorrigieren === undefined} onClick={() => { k.onKorrigieren?.('match-7'); }}>Korrigieren</button><div>{k.dialoge}</div></div>;
}

beforeEach(() => { vi.clearAllMocks(); mocks.enterScore.mockResolvedValue(true); });

describe('@EK-063 ein Dialog für die Korrektur – Spielplan und Cockpit', () => {
  it('@EK-063 beide Einstiege öffnen die Korrektur von Spiel 7 mit dem bisherigen Ergebnis 2:1 und denselben Feldern', async () => {
    const user = userEvent.setup();
    render(<><Spielplan istLeitung /><Cockpit istLeitung /></>);
    await user.click(screen.getByTestId('plan-korrigieren'));
    await user.click(screen.getByTestId('cockpit-korrigieren'));
    const [plan, cockpit] = screen.getAllByTestId('cockpit-korrektur-dialog'); // beide stehen im Portal, in der Reihenfolge des Öffnens
    expect(screen.getAllByTestId('cockpit-korrektur-dialog')).toHaveLength(2);
    expect(plan).toHaveTextContent('Ergebnis von Spiel 7 korrigieren');
    expect(plan.textContent).toBe(cockpit.textContent);
  });

  it('@EK-063 es ist dieselbe Komponente (CockpitKorrekturDialog), kein zweiter Dialog im Spielplan', () => {
    const { result } = renderHook(() => ({
      plan: useSpielplanKorrektur({ view, enterScore: mocks.enterScore, istLeitung: true }),
      cockpit: useCockpitKorrektur(tournament, liveMatches, true),
    }));
    act(() => { result.current.plan.onKorrigieren?.('match-7'); result.current.cockpit.onKorrigieren?.('match-7'); });
    expect(result.current.plan.dialog?.type).toBe(CockpitKorrekturDialog);
    expect(result.current.cockpit.dialoge?.type).toBe(CockpitKorrekturDialog);
  });

  it('@EK-063 danach derselbe Weg: „Weiter“ mit 1:1 ruft in beiden Einstiegen enterScore(Spiel 7, 1, 1)', async () => {
    const user = userEvent.setup();
    for (const [Einstieg, knopf] of [[Spielplan, 'plan-korrigieren'], [Cockpit, 'cockpit-korrigieren']] as const) {
      mocks.enterScore.mockClear();
      const { unmount } = render(<Einstieg istLeitung />);
      await user.click(screen.getByTestId(knopf));
      const dialog = screen.getByTestId('cockpit-korrektur-dialog');
      await user.clear(within(dialog).getByTestId('cockpit-korrektur-home'));
      await user.type(within(dialog).getByTestId('cockpit-korrektur-home'), '1');
      await user.click(within(dialog).getByTestId('cockpit-korrektur-weiter'));
      expect(mocks.enterScore).toHaveBeenCalledExactlyOnceWith('match-7', 1, 1, { a: 2, b: 1 }, expect.any(Function));
      unmount();
    }
  });

  // @FU-082 (Zusammenspiel @EK-032): Maria öffnet bei 2:1, Olli korrigiert auf 2:2 -- Marias Dialog und ihr Vergleichsstand bleiben beim Öffnungsstand.
  describe('@FU-082 Stand beim Öffnen des Dialogs bleibt stehen', () => {
    const viewMit = (spiele: Array<[string, number, number, number]>) => ({
      byId: new Map(spiele.map(([id, nr, a, b]) => [id, { id, matchNumber: nr, score: { a, b }, home: { label: 'FC Nord' }, away: { label: 'SV Süd' } }])),
    }) as unknown as TournamentView;
    const view22 = viewMit([['match-7', 7, 2, 2], ['match-8', 8, 0, 3]]);
    const view21 = viewMit([['match-7', 7, 2, 1], ['match-8', 8, 0, 3]]);
    function Plan({ v }: { v: TournamentView }) {
      const k = useSpielplanKorrektur({ view: v, enterScore: mocks.enterScore, istLeitung: true });
      return (
        <div>
          <button type="button" data-testid="plan-7" onClick={() => { k.onKorrigieren?.('match-7'); }}>Korrigieren 7</button>
          <button type="button" data-testid="plan-8" onClick={() => { k.onKorrigieren?.('match-8'); }}>Korrigieren 8</button>
          <div>{k.dialog}</div>
        </div>
      );
    }

    it('@FU-082 Anzeige springt auf 2:2, während der Dialog offen ist: „bisher“ bleibt 2:1, „Weiter“ reicht 2:1 an enterScore', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Plan v={view21} />);
      await user.click(screen.getByTestId('plan-7'));
      rerender(<Plan v={view22} />);
      const dialog = screen.getByTestId('cockpit-korrektur-dialog');
      expect(dialog).toHaveTextContent('2:1');
      expect(dialog).not.toHaveTextContent('2:2');
      await user.clear(within(dialog).getByTestId('cockpit-korrektur-home'));
      await user.type(within(dialog).getByTestId('cockpit-korrektur-home'), '3');
      await user.click(within(dialog).getByTestId('cockpit-korrektur-weiter'));
      expect(mocks.enterScore).toHaveBeenCalledExactlyOnceWith('match-7', 3, 1, { a: 2, b: 1 }, expect.any(Function));
    });

    it('@FU-082 erneutes Öffnen eines anderen Spiels: „Weiter“ reicht den Stand dieses Spiels (0:3), nicht den des zuerst geöffneten', async () => {
      const user = userEvent.setup();
      render(<Plan v={view21} />);
      await user.click(screen.getByTestId('plan-7'));
      await user.click(within(screen.getByTestId('cockpit-korrektur-dialog')).getByTestId('cockpit-korrektur-cancel'));
      await user.click(screen.getByTestId('plan-8'));
      const dialog = screen.getByTestId('cockpit-korrektur-dialog');
      expect(dialog).toHaveTextContent('Ergebnis von Spiel 8 korrigieren');
      await user.clear(within(dialog).getByTestId('cockpit-korrektur-home'));
      await user.type(within(dialog).getByTestId('cockpit-korrektur-home'), '1');
      await user.click(within(dialog).getByTestId('cockpit-korrektur-weiter'));
      expect(mocks.enterScore).toHaveBeenCalledExactlyOnceWith('match-8', 1, 3, { a: 0, b: 3 }, expect.any(Function));
    });
  });

  // @EK-032: Wer als Zweiter speichert, sieht die erste Korrektur und arbeitet auf dem neuen Stand weiter (Cockpit UND Spielplan, derselbe Dialog).
  describe('@EK-032 Ablehnung wegen Fremdänderung: der Dialog bleibt offen mit dem neuen Stand', () => {
    const hinweis = 'Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)';
    const abgelehnt = () => mocks.enterScore.mockImplementationOnce(async (_id: string, _h: number, _a: number, _known: unknown, onStale?: (info: unknown) => void) => {
      onStale?.({ message: hinweis, now: { a: 2, b: 2 } });
      return false;
    });
    const tippe = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, home: string, away: string) => {
      await user.clear(within(dialog).getByTestId('cockpit-korrektur-home'));
      await user.type(within(dialog).getByTestId('cockpit-korrektur-home'), home);
      await user.clear(within(dialog).getByTestId('cockpit-korrektur-away'));
      await user.type(within(dialog).getByTestId('cockpit-korrektur-away'), away);
    };

    it.each([[Spielplan, 'plan-korrigieren'], [Cockpit, 'cockpit-korrigieren']] as const)('@EK-032 Maria öffnet bei 2:1, Olli hat auf 2:2 geändert: Dialog bleibt offen, Hinweis mit Namen, bisher 2:2; erneut 3:1 geht mit Basis 2:2 durch', async (Einstieg, knopf) => {
      const user = userEvent.setup();
      abgelehnt();
      render(<Einstieg istLeitung />);
      await user.click(screen.getByTestId(knopf));
      await tippe(user, screen.getByTestId('cockpit-korrektur-dialog'), '3', '1');
      await user.click(screen.getByTestId('cockpit-korrektur-weiter'));

      expect(mocks.enterScore).toHaveBeenCalledTimes(1);
      expect(mocks.enterScore.mock.calls[0].slice(0, 4)).toEqual(['match-7', 3, 1, { a: 2, b: 1 }]);
      const dialog = await screen.findByTestId('cockpit-korrektur-dialog');
      expect(within(dialog).getByTestId('cockpit-korrektur-stale')).toHaveTextContent(hinweis);
      expect(dialog).toHaveTextContent('Aktuelles Ergebnis: FC Nord 2:2 SV Süd');
      expect(dialog).not.toHaveTextContent(/2:1/);
      expect(screen.getAllByTestId('cockpit-korrektur-dialog')).toHaveLength(1);

      // Maria arbeitet auf dem neuen Stand weiter: 3:1 erneut speichern, Basis ist jetzt 2:2
      await tippe(user, dialog, '3', '1');
      await user.click(within(dialog).getByTestId('cockpit-korrektur-weiter'));
      expect(mocks.enterScore).toHaveBeenCalledTimes(2);
      expect(mocks.enterScore.mock.calls[1].slice(0, 4)).toEqual(['match-7', 3, 1, { a: 2, b: 2 }]);
      await vi.waitFor(() => { expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull(); });
    });

    it.each([[Spielplan, 'plan-korrigieren'], [Cockpit, 'cockpit-korrigieren']] as const)('@EK-032 Gegenbeispiel: ohne Fremdänderung schließt der Dialog nach dem Speichern, kein Hinweis', async (Einstieg, knopf) => {
      const user = userEvent.setup();
      render(<Einstieg istLeitung />);
      await user.click(screen.getByTestId(knopf));
      await tippe(user, screen.getByTestId('cockpit-korrektur-dialog'), '3', '1');
      await user.click(screen.getByTestId('cockpit-korrektur-weiter'));
      await vi.waitFor(() => { expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull(); });
      expect(screen.queryByTestId('cockpit-korrektur-stale')).toBeNull();
    });

    it('@EK-032 der Countdown des Endstands bleibt angehalten, solange der Dialog nach der Ablehnung offen ist (onEnde erst nach Speichern oder Abbruch)', async () => {
      const user = userEvent.setup();
      const pause = { onBeginn: vi.fn(), onEnde: vi.fn() };
      function Mit() {
        const k = useCockpitKorrektur(tournament, liveMatches, true, pause);
        return <div><button type="button" data-testid="k" onClick={() => { k.onKorrigieren?.('match-7'); }}>K</button><div>{k.dialoge}</div></div>;
      }
      abgelehnt();
      render(<Mit />);
      await user.click(screen.getByTestId('k'));
      await tippe(user, screen.getByTestId('cockpit-korrektur-dialog'), '3', '1');
      await user.click(screen.getByTestId('cockpit-korrektur-weiter'));
      const dialog = await screen.findByTestId('cockpit-korrektur-stale');
      expect(dialog).toBeInTheDocument();
      expect(pause.onEnde).not.toHaveBeenCalled();
      await user.click(screen.getByTestId('cockpit-korrektur-cancel'));
      expect(pause.onEnde).toHaveBeenCalledTimes(1);
    });
  });

  it('@HE-043 @FU-113 Gegenbeispiel: der Helfer bekommt in keinem der beiden Einstiege einen Handler', () => {
    render(<><Spielplan istLeitung={false} /><Cockpit istLeitung={false} /></>);
    expect(screen.getByTestId('plan-korrigieren')).toBeDisabled();
    expect(screen.getByTestId('cockpit-korrigieren')).toBeDisabled();
  });
});
