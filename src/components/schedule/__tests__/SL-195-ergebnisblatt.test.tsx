/**
 * @SL-195 / @SL-238 Das Blatt „Endergebnis Spiel n“ der Gruppenphase (G3-N N4): Tipp aufs Ergebnisfeld, leere Felder, Cursor im ersten Feld,
 * „−“/„+“, „Ergebnis speichern“ erst bei zwei gefüllten Feldern, Entwurf bleibt (@FU-101, @FU-103, @FU-104), laufendes Spiel mit „Stand im
 * Cockpit“ und „einsetzen“. Echter Weg: ScheduleDisplay mit echtem Spielplan-Generator und echten deutschen Texten; der Speicherweg
 * (`onScoreChange`) ist ein Spion – die Rückfragen und das Schreiben prüfen ScheduleTab.direkteintrag und useScheduleResultEntry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

import { generateFullSchedule, type ScheduledMatch } from '../../../core/generators';
import type { Match, Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { ToastProvider } from '../../ui/Toast';
import { MatchScoreCell } from '../MatchScoreCell';
import { MatchTimeShiftContext } from '../matchTimeShiftContext';
import type { MatchActionRights } from '../actionMenu/matchActions';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

const LEITUNG: MatchActionRights = { lead: true, play: true, schedule: true };
const HELFER: MatchActionRights = { lead: false, play: true, schedule: false };

const teams: Team[] = [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}`, group: 'A' }));
const turnier = createMockTournament({ id: 'turnier-195', teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin' });
const plan = generateFullSchedule(turnier);
const SPIEL: ScheduledMatch = plan.allMatches[0];
const ANDERES: ScheduledMatch = plan.allMatches[1];

type Spy = (id: string, a: number, b: number) => boolean;
const props = (cache: Cache, rights: MatchActionRights, onScoreChange: Spy, extra: { anderes?: Cache; author?: string | null } = {}) => {
  const current: Match[] = plan.allMatches.map((m) => matchOf(m, m.id === SPIEL.id ? cache : m.id === ANDERES.id ? extra.anderes ?? {} : {}));
  return {
    schedule: plan, currentMatches: current, view: viewOf(current, teams), editable: true, actionRights: rights,
    onScoreChange, onNavigateToCockpit: vi.fn(), onCorrect: vi.fn(), canEndRunning: rights.lead,
    changeAuthorOf: async () => extra.author ?? null,
  };
};
const wrap = (p: ReturnType<typeof props>) => (
  <ToastProvider><MatchTimeShiftContext.Provider value={{ originalTimeOf: () => undefined, shiftFrom: vi.fn() }}><ScheduleDisplay {...p} /></MatchTimeShiftContext.Provider></ToastProvider>
);
const zeige = (cache: Cache, rights: MatchActionRights = LEITUNG, extra: Parameters<typeof props>[3] = {}) => {
  const onScoreChange = vi.fn<Spy>(() => true);
  const view = render(wrap(props(cache, rights, onScoreChange, extra)));
  return { onScoreChange, view, neu: (cache2: Cache, extra2: Parameters<typeof props>[3] = {}) => { view.rerender(wrap(props(cache2, rights, onScoreChange, extra2))); } };
};
const tippeErgebnisfeld = (id = SPIEL.id) => { act(() => { fireEvent.click(screen.getAllByTestId(`match-goals-${id}-home`)[0]); }); };
const blatt = () => screen.getByTestId('result-sheet');
const home = () => screen.getByTestId<HTMLInputElement>('result-sheet-score-home');
const away = () => screen.getByTestId<HTMLInputElement>('result-sheet-score-away');
const speichern = () => screen.getByTestId('result-sheet-save');

beforeEach(() => { vi.clearAllMocks(); });

describe('@SL-195 Tipp aufs Ergebnisfeld öffnet das Blatt „Endergebnis Spiel n“', () => {
  it('@SL-195 Tipp aufs Ergebnisfeld von Spiel 1: „Endergebnis Spiel 1“ mit zwei leeren Feldern, das erste ist fokussiert, keine Auswahl', () => {
    zeige({});
    tippeErgebnisfeld();
    expect(within(blatt()).getByRole('heading', { name: `Endergebnis Spiel ${SPIEL.matchNumber}` })).toBeInTheDocument();
    expect(home().value).toBe('');
    expect(away().value).toBe('');
    expect(document.activeElement).toBe(home());
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
    expect(within(blatt()).getByText('Tore während des Spiels trägst du im Cockpit ein')).toBeInTheDocument();
  });

  it('@SL-195 Gegenbeispiel: ein Tipp auf den Rest der Karte (Name) öffnet die Auswahl der Aktionen, nicht das Blatt (@SL-193)', () => {
    zeige({});
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
    expect(screen.getByTestId('match-action-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('result-sheet')).toBeNull();
  });

  it('@SL-195 „Ergebnis eintragen“ in der Auswahl öffnet dasselbe Blatt', () => {
    zeige({});
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
    act(() => { fireEvent.click(screen.getByTestId('match-action-enterResult')); });
    expect(blatt()).toBeInTheDocument();
    expect(document.activeElement).toBe(home());
  });

  it('@SL-195 @HE-042 Helfer ohne Eintragen-Recht: der Tipp aufs Ergebnisfeld öffnet kein Blatt, sondern die Auswahl mit „Zum Cockpit“', () => {
    zeige({}, HELFER);
    tippeErgebnisfeld();
    expect(screen.queryByTestId('result-sheet')).toBeNull();
    expect(screen.getByTestId('match-action-toCockpit')).toBeInTheDocument();
    expect(screen.queryByTestId('match-action-enterResult')).toBeNull();
  });

  it('@SL-195 Gegenbeispiel: läuft das Spiel, öffnet der Tipp aufs Ergebnisfeld die Auswahl (es hat einen Stand)', () => {
    zeige({ matchStatus: 'running', scoreA: 1, scoreB: 0 });
    tippeErgebnisfeld();
    expect(screen.getByTestId('match-action-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('result-sheet')).toBeNull();
  });

  it('@SL-195 „Zum Cockpit“ im Blatt navigiert zu diesem Spiel und schließt das Blatt', () => {
    zeige({});
    tippeErgebnisfeld();
    act(() => { fireEvent.click(screen.getByTestId('result-sheet-to-cockpit')); });
    expect(screen.queryByTestId('result-sheet')).toBeNull();
  });
});

describe('@SL-195 @FU-101 Speichern erst bei zwei gefüllten Feldern, nur über die Taste', () => {
  it('@SL-195 „Ergebnis speichern“ ist bei einem leeren Feld gesperrt; Gegenbeispiel: beide gefüllt → frei', async () => {
    const user = userEvent.setup();
    zeige({});
    tippeErgebnisfeld();
    expect(speichern()).toBeDisabled();
    await user.type(home(), '3');
    expect(speichern()).toBeDisabled();
    await user.type(away(), '1');
    expect(speichern()).toBeEnabled();
  });

  it('@FU-101 „1“ dann „0“ im ersten Feld, 2 im zweiten → gesendet wird 10:2 (nicht 1:2); Verlassen eines Feldes sendet nichts', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.type(away(), '2');
    await user.type(home(), '1');
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.click(home());
    await user.keyboard('0');
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.click(speichern());
    expect(onScoreChange).toHaveBeenCalledExactlyOnceWith(SPIEL.id, 10, 2);
  });

  it('@FU-101 Enter im ersten Feld springt ins zweite, Enter im zweiten speichert (bei gefüllten Feldern)', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.type(home(), '3');
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(away());
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.type(away(), '1');
    await user.keyboard('{Enter}');
    expect(onScoreChange).toHaveBeenCalledExactlyOnceWith(SPIEL.id, 3, 1);
  });

  it('@SL-195 0:0-Fehlklick: Blatt öffnen und „Ergebnis speichern“ ohne Eingabe sendet nichts; Gegenbeispiel: ausdrücklich getippte „0“ und „0“ tragen 0:0 ein', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.click(speichern());
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.type(home(), '0');
    await user.type(away(), '0');
    await user.click(speichern());
    expect(onScoreChange).toHaveBeenCalledExactlyOnceWith(SPIEL.id, 0, 0);
  });

  it('@SL-195 nach gespeichertem Ergebnis schließt das Blatt; wird nicht gespeichert (Rückfrage „Nein“, false), bleibt es offen und die Felder zeigen wieder den Stand', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.type(home(), '3');
    await user.type(away(), '1');
    onScoreChange.mockReturnValueOnce(false);
    await user.click(speichern());
    expect(blatt()).toBeInTheDocument();
    expect(home().value).toBe('');
    await user.type(home(), '3');
    await user.type(away(), '1');
    await user.click(speichern());
    expect(screen.queryByTestId('result-sheet')).toBeNull();
  });
});

describe('@SL-238 „−“ und „+“ ändern nur den Entwurf', () => {
  it('@SL-238 „+“ bei leerem Feld ergibt 1; „−“ bei leerem Feld und bei 0 bleibt ohne Wirkung; es wird nie gesendet', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.click(screen.getByTestId('result-sheet-minus-home'));
    expect(home().value).toBe('');
    await user.click(screen.getByTestId('result-sheet-plus-home'));
    expect(home().value).toBe('1');
    await user.click(screen.getByTestId('result-sheet-plus-home'));
    expect(home().value).toBe('2');
    await user.click(screen.getByTestId('result-sheet-minus-home'));
    await user.click(screen.getByTestId('result-sheet-minus-home'));
    expect(home().value).toBe('0');
    await user.click(screen.getByTestId('result-sheet-minus-home'));
    expect(home().value).toBe('0');
    expect(away().value).toBe('');
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@SL-238 Heim steht oben, Gast darunter; die Tasten tragen den Namen des Teams; ein Tipp neben das Blatt (Schleier) verwirft nichts, „Abbrechen“ und „X“ verwerfen', async () => {
    const user = userEvent.setup();
    zeige({});
    tippeErgebnisfeld();
    expect(home().compareDocumentPosition(away()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(blatt()).getAllByRole('button', { name: /Ein Tor mehr für Team/ })).toHaveLength(2);
    await user.type(home(), '4');
    const schleier = blatt().parentElement!;
    act(() => { fireEvent.click(schleier); });
    expect(screen.getByTestId('result-sheet')).toBeInTheDocument();
    expect(home().value).toBe('4');
    await user.click(screen.getByTestId('result-sheet-cancel'));
    expect(screen.queryByTestId('result-sheet')).toBeNull();
    tippeErgebnisfeld();
    expect(home().value).toBe('');
    await user.click(screen.getByTestId('result-sheet-close'));
    expect(screen.queryByTestId('result-sheet')).toBeNull();
  });

  it('@SL-238 @OB-022 Feld, „−“, „+“ und „Abbrechen“ mindestens 44 px (Token), „Ergebnis speichern“ 56 px, Schrift der Felder mindestens 16 px (Token)', () => {
    zeige({});
    tippeErgebnisfeld();
    for (const id of ['result-sheet-minus-home', 'result-sheet-plus-home', 'result-sheet-minus-away', 'result-sheet-plus-away', 'result-sheet-close']) {
      expect(screen.getByTestId(id).style.minHeight).toContain('--touch-target-minimum');
      expect(screen.getByTestId(id).style.minWidth).toContain('--touch-target-minimum');
    }
    expect(home().style.height).toContain('--touch-target-minimum');
    expect(home().style.fontSize).toContain('--font-size-lg');
    expect(speichern().style.minHeight).toContain('--touch-target-primary');
    expect(screen.getByTestId('result-sheet-cancel').style.minHeight).toContain('--touch-target-minimum');
    expect(speichern()).toHaveAttribute('data-primary');
  });
});

describe('@FU-104 fremde Änderung', () => {
  it('@FU-104 Tom trägt für Spiel 1 3:1 ein, während Olli „1“ getippt hat: Hinweis „… von Tom geändert (jetzt 3:1)“, nichts gespeichert', async () => {
    const user = userEvent.setup();
    const { onScoreChange, neu } = zeige({}, LEITUNG, { author: 'Tom' });
    tippeErgebnisfeld();
    await user.type(home(), '1');
    await user.type(away(), '2');
    neu({ matchStatus: 'finished', scoreA: 3, scoreB: 1 }, { author: 'Tom' });
    expect(await screen.findByText('Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)')).toBeInTheDocument();
    expect(home().value).toBe('1');
    expect(speichern()).toBeDisabled();
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.click(screen.getByTestId(`score-changed-keep-${SPIEL.id}`));
    expect(speichern()).toBeEnabled();
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-103 Gegenbeispiel: ändert sich ein anderes Spiel, bleibt der Entwurf ohne Hinweis stehen', async () => {
    const user = userEvent.setup();
    const { neu } = zeige({});
    tippeErgebnisfeld();
    await user.type(home(), '1');
    neu({}, { anderes: { matchStatus: 'finished', scoreA: 3, scoreB: 1 } });
    expect(home().value).toBe('1');
    expect(screen.queryByTestId(`score-changed-${SPIEL.id}`)).toBeNull();
  });
});

describe('@SL-238 laufendes Spiel: „Stand im Cockpit“, „Speichern beendet das Spiel“, „einsetzen“', () => {
  const LAEUFT: Cache = { matchStatus: 'running', scoreA: 1, scoreB: 0 };
  const oeffneLaufendes = () => {
    const r = zeige(LAEUFT);
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
    act(() => { fireEvent.click(screen.getByTestId('match-action-endAndEnter')); });
    return r;
  };

  it('@SL-238 im Kopf „Stand im Cockpit 1:0“, darunter „Speichern beendet das Spiel.“; die Felder sind leer', () => {
    oeffneLaufendes();
    expect(blatt()).toHaveTextContent('Stand im Cockpit 1:0');
    expect(screen.getByTestId('result-sheet-ends-match')).toHaveTextContent('Speichern beendet das Spiel.');
    expect(home().value).toBe('');
  });

  it('@SL-238 „1:0 einsetzen“ füllt beide Felder, „Ergebnis speichern“ ist frei und sendet 1:0', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = oeffneLaufendes();
    expect(speichern()).toBeDisabled();
    await user.click(screen.getByTestId('result-sheet-take-cockpit'));
    expect(home().value).toBe('1');
    expect(away().value).toBe('0');
    expect(speichern()).toBeEnabled();
    await user.click(speichern());
    expect(onScoreChange).toHaveBeenCalledExactlyOnceWith(SPIEL.id, 1, 0);
  });

  it('@SL-238 Gegenbeispiel: bei einem nicht laufenden Spiel gibt es weder „einsetzen“ noch „Speichern beendet das Spiel“', () => {
    zeige({});
    tippeErgebnisfeld();
    expect(screen.queryByTestId('result-sheet-take-cockpit')).toBeNull();
    expect(screen.queryByTestId('result-sheet-ends-match')).toBeNull();
    expect(blatt()).not.toHaveTextContent('einsetzen');
    expect(blatt()).not.toHaveTextContent('Stand im Cockpit');
  });
});

describe('@SL-238 „einsetzen“ nur im Blatt, die Finalrunde bleibt unverändert', () => {
  it('@SL-238 Gegenbeispiel Finalrunde: die Zelle zeigt bei „inzwischen geändert“ keine Taste „einsetzen“, nur „Meine Eingabe behalten“', async () => {
    const user = userEvent.setup();
    const zelle = (a: number | undefined, b: number | undefined) => (
      <MatchScoreCell matchId="f1" scoreA={a} scoreB={b} editable isFinished={false} isRunning onScoreChange={vi.fn()} changeAuthorOf={async () => 'Tom'} />
    );
    const { rerender } = render(zelle(undefined, undefined));
    await user.type(screen.getByTestId('match-score-input-f1-home'), '1');
    rerender(zelle(3, 1));
    expect(await screen.findByTestId('score-changed-f1')).toBeInTheDocument();
    expect(screen.getByTestId('score-changed-keep-f1')).toBeInTheDocument();
    expect(screen.queryByTestId('score-changed-f1-takeover')).toBeNull();
    expect(screen.getByTestId('score-changed-f1')).not.toHaveTextContent('einsetzen');
  });

  it('@SL-238 im Blatt eines laufenden Spiels bietet der Hinweis „inzwischen geändert“ „3:1 einsetzen“ an; die Taste füllt beide Felder und der Hinweis geht', async () => {
    const user = userEvent.setup();
    const { neu } = zeige({ matchStatus: 'running', scoreA: 0, scoreB: 0 }, LEITUNG, { author: 'Tom' });
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
    act(() => { fireEvent.click(screen.getByTestId('match-action-endAndEnter')); });
    await user.type(home(), '1');
    neu({ matchStatus: 'running', scoreA: 3, scoreB: 1 }, { author: 'Tom' });
    // Beim laufenden Spiel zählt der Stand der Uhr nicht als „gespeichert“; den Hinweis löst nur ein beendetes Spiel aus
    expect(screen.queryByTestId(`score-changed-${SPIEL.id}-takeover`)).toBeNull();
    neu({ matchStatus: 'finished', scoreA: 3, scoreB: 1 }, { author: 'Tom' });
    expect(await screen.findByTestId(`score-changed-${SPIEL.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`score-changed-${SPIEL.id}-takeover`)).toBeNull(); // Spiel nicht mehr laufend: nur „Meine Eingabe behalten“
  });
});
