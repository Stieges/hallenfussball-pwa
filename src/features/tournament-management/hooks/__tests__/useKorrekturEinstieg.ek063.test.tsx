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
      expect(mocks.enterScore).toHaveBeenCalledExactlyOnceWith('match-7', 1, 1);
      unmount();
    }
  });

  it('@HE-043 @FU-113 Gegenbeispiel: der Helfer bekommt in keinem der beiden Einstiege einen Handler', () => {
    render(<><Spielplan istLeitung={false} /><Cockpit istLeitung={false} /></>);
    expect(screen.getByTestId('plan-korrigieren')).toBeDisabled();
    expect(screen.getByTestId('cockpit-korrigieren')).toBeDisabled();
  });
});
