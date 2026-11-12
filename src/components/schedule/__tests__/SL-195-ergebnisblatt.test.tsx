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
import { pendingSlot } from '../../../core/models/matchSlot';
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
/** Spiel 1 mit noch offener Gast-Seite (die Paarung steht nicht fest) */
const withOpenSide = (p: typeof plan): typeof plan => {
  const offen = (m: ScheduledMatch): ScheduledMatch => (m.id === SPIEL.id ? { ...m, slotB: pendingSlot({ kind: 'groupRank', group: 'A', rank: 2 }) } : m);
  return { ...p, allMatches: p.allMatches.map(offen), phases: p.phases.map((ph) => ({ ...ph, matches: ph.matches.map(offen) })) };
};
const props = (cache: Cache, rights: MatchActionRights, onScoreChange: Spy, extra: { anderes?: Cache; author?: string | null; offen?: boolean; cockpit?: (id: string) => void } = {}) => {
  const schedule = extra.offen === true ? withOpenSide(plan) : plan;
  const current: Match[] = schedule.allMatches.map((m) => matchOf(m, m.id === SPIEL.id ? cache : m.id === ANDERES.id ? extra.anderes ?? {} : {}));
  return {
    schedule, currentMatches: current, view: viewOf(current, teams), editable: true, actionRights: rights,
    onScoreChange, onNavigateToCockpit: extra.cockpit ?? vi.fn(), onCorrect: vi.fn(), forfeit: { mark: vi.fn(), revoke: vi.fn() }, canEndRunning: rights.lead,
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
const zeigeLaufendesBlatt = () => {
  const onCockpit = vi.fn<(id: string) => void>();
  const r = zeige({ matchStatus: 'running', scoreA: 1, scoreB: 0 }, LEITUNG, { cockpit: onCockpit });
  act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
  act(() => { fireEvent.click(screen.getByTestId('match-action-endAndEnter')); });
  return { ...r, onCockpit };
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
    // die Zeile „Tore während des Spiels trägst du im Cockpit ein“ gehört nur zum laufenden Spiel (nicht zu einem geplanten)
    expect(within(blatt()).queryByTestId('result-sheet-cockpit-note')).toBeNull();
    expect(within(blatt()).queryByTestId('result-sheet-to-cockpit')).toBeNull();
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

  const ohneBlatt: Array<[string, Cache, Parameters<typeof props>[3]]> = [
    ['abgesetzt', { matchStatus: 'skipped' }, {}],
    ['gewertet', { matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit' }, {}],
    ['offene Paarung', {}, { offen: true }],
  ];
  it.each(ohneBlatt  )('@SL-195 Gegenbeispiel %s: der Tipp aufs Ergebnisfeld öffnet die Auswahl, nicht das Blatt', (_name, cache, extra) => {
    zeige(cache, LEITUNG, extra);
    tippeErgebnisfeld();
    expect(screen.queryByTestId('result-sheet')).toBeNull();
    expect(screen.getByTestId('match-action-menu')).toBeInTheDocument();
  });

  it('@SL-195 laufendes Spiel: „Tore während des Spiels trägst du im Cockpit ein“ mit „Zum Cockpit“; die Taste navigiert zu diesem Spiel und schließt das Blatt', () => {
    const { onCockpit } = zeigeLaufendesBlatt();
    expect(within(blatt()).getByTestId('result-sheet-cockpit-note')).toHaveTextContent('Tore während des Spiels trägst du im Cockpit ein');
    act(() => { fireEvent.click(screen.getByTestId('result-sheet-to-cockpit')); });
    expect(onCockpit).toHaveBeenCalledExactlyOnceWith(SPIEL.id);
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
    expect(home().style.height).toContain('--sizing-score-field'); // 64 px wie im Mockup (Token), nie unter 44 px
    expect(home().style.width).toContain('--sizing-score-field');
    expect(home().style.fontSize).toContain('--font-size-xxl'); // große Ziffer, mindestens 16 px
    expect(speichern().style.minHeight).toContain('--touch-target-primary');
    expect(screen.getByTestId('result-sheet-cancel').style.minHeight).toContain('--touch-target-primary'); // gleich hoch wie „Ergebnis speichern“ (nebeneinander, @OB-061), nie unter 44 px
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

  it('@SL-238 Gegenbeispiel: auch im Blatt des Gruppenspiels bietet der Hinweis „inzwischen geändert“ kein „einsetzen“ an, nur „Meine Eingabe behalten“ (ein von außen eingetragenes Ergebnis beendet das Spiel)', async () => {
    const user = userEvent.setup();
    const { neu } = zeige({ matchStatus: 'running', scoreA: 0, scoreB: 0 }, LEITUNG, { author: 'Tom' });
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${SPIEL.id}-home`)[0]); });
    act(() => { fireEvent.click(screen.getByTestId('match-action-endAndEnter')); });
    await user.type(home(), '1');
    neu({ matchStatus: 'finished', scoreA: 3, scoreB: 1 }, { author: 'Tom' });
    expect(await screen.findByTestId(`score-changed-${SPIEL.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`score-changed-keep-${SPIEL.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`score-changed-${SPIEL.id}`)).not.toHaveTextContent('einsetzen');
  });
});

describe('@FU-101 das Feld ist ein Ziffernfeld: nur Ziffern, höchstens zwei Stellen, keine Pfeile', () => {
  it('@FU-101 „-3“, „1e2“, „2,5“ und Buchstaben bleiben nicht im Feld stehen (nur die Ziffern); höchstens zwei Stellen; 99 ist speicherbar', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = zeige({});
    tippeErgebnisfeld();
    await user.type(home(), '-3');
    expect(home().value).toBe('3');
    await user.clear(home());
    await user.type(home(), '1e2');
    expect(home().value).toBe('12');
    await user.clear(home());
    await user.type(home(), '2,5');
    expect(home().value).toBe('25');
    await user.clear(home());
    await user.type(home(), '99999');
    expect(home().value).toBe('99');
    await user.type(away(), 'x7');
    expect(away().value).toBe('7');
    await user.click(speichern());
    expect(onScoreChange).toHaveBeenCalledExactlyOnceWith(SPIEL.id, 99, 7);
  });

  it('@FU-101 Pfeil hoch/runter und Mausrad ändern den Stand nicht, Pfeil runter auf leerem Feld setzt keine „0“ (kein Zahlenfeld, keine nativen Pfeile)', async () => {
    const user = userEvent.setup();
    zeige({});
    tippeErgebnisfeld();
    expect(home().type).toBe('text');
    expect(home()).toHaveAttribute('inputmode', 'numeric');
    await user.keyboard('{ArrowDown}');
    expect(home().value).toBe('');
    await user.type(home(), '2');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(home().value).toBe('2');
    act(() => { fireEvent.wheel(home(), { deltaY: -100 }); });
    expect(home().value).toBe('2');
  });

  it('@FU-101 Gegenbeispiel Finalrunde: auch die Zelle der Finalrunde nimmt nur Ziffern an und höchstens zwei Stellen', async () => {
    const user = userEvent.setup();
    render(<MatchScoreCell matchId="f2" scoreA={undefined} scoreB={undefined} editable isFinished={false} onScoreChange={vi.fn()} />);
    const feld = screen.getByTestId<HTMLInputElement>('match-score-input-f2-home');
    await user.type(feld, 'a-1e234');
    expect(feld.value).toBe('12');
    expect(feld.type).toBe('text');
  });
});

describe('@SL-238 Tab-Reihenfolge und Konsole', () => {
  it('@SL-238 Tab geht vom Feld Heim zum Feld Gast und dann zu „Abbrechen“ und „Ergebnis speichern“; „−“ und „+“ liegen nicht dazwischen, bleiben aber benannt und bedienbar', async () => {
    const user = userEvent.setup();
    zeige({});
    tippeErgebnisfeld();
    await user.type(home(), '3');
    await user.type(away(), '1');
    home().focus();
    const reihenfolge: string[] = [];
    for (let schritt = 0; schritt < 3; schritt++) {
      await user.tab();
      reihenfolge.push((document.activeElement as HTMLElement).dataset.testid ?? '');
    }
    expect(reihenfolge).toEqual(['result-sheet-score-away', 'result-sheet-cancel', 'result-sheet-save']);
    for (const knopf of within(blatt()).getAllByRole('button', { name: /Ein Tor (mehr|weniger) für Team/ })) { expect(knopf).toHaveAttribute('tabindex', '-1'); }
    await user.click(screen.getByTestId('result-sheet-plus-home'));
    expect(home().value).toBe('4');
  });

  it('@SL-238 beim Öffnen und Bedienen des Blatts warnt React nicht vor gemischten Stil-Eigenschaften (background und backgroundColor)', async () => {
    const user = userEvent.setup();
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    zeige({});
    const zeile = screen.getAllByTestId(`match-row-time-${SPIEL.id}`)[0];
    await user.hover(zeile);
    tippeErgebnisfeld();
    await user.type(home(), '1');
    await user.unhover(zeile);
    const gemischt = fehler.mock.calls.filter((aufruf) => aufruf.join(' ').includes('conflicting property'));
    fehler.mockRestore();
    expect(gemischt).toEqual([]);
  });
});
