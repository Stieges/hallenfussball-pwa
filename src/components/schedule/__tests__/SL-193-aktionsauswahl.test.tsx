/**
 * @SL-193 Ein Tipp auf ein Spiel im Spielplan zeigt beschriftete Aktionen, in Gruppenphase und Finalrunde gleich
 * (Szenariogrundriss, Tabelle je Zustand und Recht; die Texte stehen dort wörtlich). Echter Weg: ScheduleDisplay mit echtem
 * Spielplan-Generator, Gruppen- und K.-o.-Phase, echte deutsche Texte; die Wege dahinter (Cockpit, Verschieben, Korrektur,
 * Nichtantritt) sind Spione. Dazu: @EK-063 (Einstieg „Ergebnis korrigieren“), @ZP-093 (angepfiffen: kein Schiedsrichter/Feld),
 * @HE-042 @FU-113 (Helfer ohne Korrektur), @FU-080 @FU-082 (Protokoll ansehen, Turnier-Kennung an useLiveMatches).
 * Die Aktionen der Tabelle selbst prüft `matchActions.test.ts`; hier geht es um die Verdrahtung in beiden Spielplänen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

const live = vi.hoisted(() => ({ calls: [] as string[], active: 0, matches: new Map<string, unknown>() }));
vi.mock('../../../hooks/useLiveMatches', async () => {
  const { useEffect } = await import('react');
  return {
    // `active` zählt die offenen Abonnements (Einhängen +1, Aushängen -1): jedes Abonnement hängt am Kanal des Turniers
    useLiveMatches: (tournamentId: string) => {
      live.calls.push(tournamentId);
      useEffect(() => { live.active += 1; return () => { live.active -= 1; }; }, []);
      return { liveMatches: live.matches };
    },
  };
});

import { generateFullSchedule, type GeneratedSchedule, type ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import type { Match, Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { ToastProvider } from '../../ui/Toast';
import { MatchTimeShiftContext } from '../matchTimeShiftContext';
import type { MatchActionRights } from '../actionMenu/matchActions';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

const LEITUNG: MatchActionRights = { lead: true, play: true, schedule: true };
const HELFER: MatchActionRights = { lead: false, play: true, schedule: false };

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);
const turnier = createMockTournament({
  id: 'turnier-7', teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 2, groupSystem: 'groupsAndFinals',
  refereeConfig: { mode: 'organizer', numberOfReferees: 2 },
  finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
});
const offen = generateFullSchedule(turnier);
/** Spielplan mit besetzter Finalrunde (die Seiten der Finalspiele stehen fest). */
const mitTeams = (m: ScheduledMatch): ScheduledMatch => (m.phase === 'groupStage' ? m : { ...m, slotA: teamSlot(teams[0].id), slotB: teamSlot(teams[5].id) });
const schedule: GeneratedSchedule = {
  ...offen,
  allMatches: offen.allMatches.map(mitTeams),
  phases: offen.phases.map((p) => ({ ...p, matches: p.matches.map(mitTeams) })),
};
const GRUPPENSPIEL = schedule.allMatches.find((m) => m.phase === 'groupStage')!;
const FINALSPIEL = schedule.allMatches.find((m) => m.phase !== 'groupStage')!;

/** Gruppenspiel mit klarer Rangfolge (Team 1 vor 2 vor 3 vor 4), damit die Seiten der Finalrunde feststehen. */
function gespielt(m: ScheduledMatch): Cache {
  const rang = (slot: ScheduledMatch['slotA']) => Number(teams.find((t) => slot.kind === 'team' && t.id === slot.teamId)?.name.slice(-1));
  const [a, b] = [rang(m.slotA), rang(m.slotB)];
  const abstand = Math.abs(a - b);
  return { matchStatus: 'finished', scoreA: a < b ? abstand : 0, scoreB: a < b ? 0 : abstand };
}

const ZUSTAND: Record<'geplant' | 'läuft' | 'beendet', Cache> = {
  geplant: {},
  läuft: { matchStatus: 'running', scoreA: 1, scoreB: 0 },
  beendet: { matchStatus: 'finished', scoreA: 2, scoreB: 1 },
};
const WORTLAUT: Record<string, string[]> = {
  'geplant/leitung': ['Ergebnis eintragen', 'Im Cockpit anpfeifen', 'Ab hier verschieben', 'Schiedsrichter ändern', 'Feld ändern', 'Nicht angetreten'],
  'geplant/helfer': ['Zum Cockpit'],
  'läuft/leitung': ['Zum Cockpit', 'Spiel beenden und Ergebnis eintragen'],
  'läuft/helfer': ['Zum Cockpit'],
  'beendet/leitung': ['Ergebnis korrigieren', 'Protokoll ansehen'],
  'beendet/helfer': ['Protokoll ansehen'],
};

const spies = {
  cockpit: vi.fn(), correct: vi.fn(), score: vi.fn(), shift: vi.fn(), referee: vi.fn(), field: vi.fn(), mark: vi.fn(), revoke: vi.fn(),
};

/** Der Spielplan mit dem Zustand des Gruppen- bzw. Finalspiels; alle Gruppenspiele sind gespielt, damit die Finalrunde besetzt ist. */
function zeige(runde: 'Gruppenphase' | 'Finalrunde', zustand: keyof typeof ZUSTAND, rights: MatchActionRights, extra: { cache?: Cache } = {}) {
  const ziel = runde === 'Gruppenphase' ? GRUPPENSPIEL : FINALSPIEL;
  const cache = extra.cache ?? ZUSTAND[zustand];
  const current: Match[] = schedule.allMatches.map((m) => matchOf(m, m.id === ziel.id
    ? cache
    : m.phase === 'groupStage' ? gespielt(m) : {}));
  const view = viewOf(current, teams, { tournament: { numberOfFields: 2, refereeConfig: turnier.refereeConfig } });
  render(
    <ToastProvider><MatchTimeShiftContext.Provider value={{ originalTimeOf: () => undefined, shiftFrom: spies.shift }}>
      <ScheduleDisplay
        schedule={schedule} currentMatches={current} view={view} editable actionRights={rights}
        onNavigateToCockpit={spies.cockpit} onCorrect={spies.correct} onScoreChange={spies.score}
        onRefereeChange={spies.referee} onFieldChange={spies.field} forfeit={{ mark: spies.mark, revoke: spies.revoke }}
        canEndRunning={rights.lead}
      />
    </MatchTimeShiftContext.Provider></ToastProvider>,
  );
  return ziel;
}

/** Tipp auf das Spiel: Gruppenphase auf Karte/Tore, Finalrunde auf die Zeile bzw. Karte. */
function tippe(runde: 'Gruppenphase' | 'Finalrunde', id: string) {
  const ziel = runde === 'Gruppenphase' ? screen.getAllByTestId(`match-name-${id}-home`)[0] : screen.getAllByTestId(`final-name-${id}-home`)[0];
  act(() => { fireEvent.click(ziel); });
}
const menue = () => screen.getByTestId('match-action-menu');
const eintraege = () => within(menue()).getAllByRole('listitem').map((li) => li.textContent ?? '');
const aktion = (name: string) => screen.getByTestId(`match-action-${name}`);

beforeEach(() => { vi.clearAllMocks(); live.calls.length = 0; live.active = 0; live.matches = new Map(); });

describe('@SL-193 Auswahl beim Tipp auf ein Spiel – Gruppenphase und Finalrunde gleich', () => {
  for (const runde of ['Gruppenphase', 'Finalrunde'] as const) {
    for (const zustand of ['geplant', 'läuft', 'beendet'] as const) {
      it(`@SL-193 ${runde} ${zustand}: die Turnierleitung sieht ${WORTLAUT[`${zustand}/leitung`].join(', ')}`, () => {
        const ziel = zeige(runde, zustand, LEITUNG);
        tippe(runde, ziel.id);
        // Eintrag ohne den Satz eines gesperrten Eintrags: erste Textzeile des Buttons; die Aktionen sind eine Menge ohne feste
        // Reihenfolge (@SL-193 in der Fassung vom 10.11.; die gefüllte Haupttaste steht zuletzt, das prüft @SL-239 in SL-239-aktionsblatt.test.tsx)
        const gezeigt = eintraege().map((text) => WORTLAUT[`${zustand}/leitung`].find((w) => text.startsWith(w)));
        expect([...gezeigt].sort()).toEqual([...WORTLAUT[`${zustand}/leitung`]].sort());
      });

      it(`@SL-193 ${runde} ${zustand}: der Helfer sieht dort nur ${WORTLAUT[`${zustand}/helfer`].join(', ')}`, () => {
        const ziel = zeige(runde, zustand, HELFER);
        tippe(runde, ziel.id);
        expect(eintraege()).toEqual(WORTLAUT[`${zustand}/helfer`]);
      });
    }
  }

  it('@SL-193 eine Tippfläche: Karte und Torzahl eines laufenden Spiels der Gruppenphase öffnen dieselbe Auswahl (ohne Ergebnis öffnet die Torzahl das Blatt, @SL-195)', () => {
    const ziel = zeige('Gruppenphase', 'läuft', LEITUNG);
    act(() => { fireEvent.click(screen.getAllByTestId(`match-goals-${ziel.id}-home`)[0]); });
    expect(screen.getAllByTestId('match-action-menu')).toHaveLength(1);
  });

  it('@SL-193 Finalrunde: der Tipp auf die Tabellenzeile und die Spielnummer als Taste (Tastatur) öffnen die Auswahl', () => {
    const ziel = zeige('Finalrunde', 'geplant', LEITUNG);
    act(() => { fireEvent.click(screen.getByTestId(`final-row-${ziel.id}`)); });
    expect(menue()).toBeInTheDocument();
    act(() => { fireEvent.click(within(menue()).getByTestId('match-action-menu-close')); });
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
    const nummern = screen.getAllByTestId(`match-actions-open-${ziel.id}`);
    expect(nummern[0]).toHaveAccessibleName(`Aktionen für Spiel ${ziel.matchNumber}`);
    act(() => { fireEvent.click(nummern[0]); });
    expect(menue()).toBeInTheDocument();
  });

  it('@SL-193 Finalrunde: ein Tipp auf das Eingabefeld der Zeile öffnet die Auswahl nicht (das Feld behält seine Wirkung)', () => {
    const ziel = zeige('Finalrunde', 'geplant', LEITUNG);
    act(() => { fireEvent.click(screen.getAllByTestId(`match-score-input-${ziel.id}-home`)[0]); });
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
  });

  it('@SL-193 Zuschauer und Vorschau (ohne Rechte): der Tipp öffnet keine Auswahl', () => {
    const ziel = GRUPPENSPIEL;
    const current: Match[] = schedule.allMatches.map((m) => matchOf(m, m.id === ziel.id ? ZUSTAND.beendet : {}));
    render(<ScheduleDisplay schedule={schedule} currentMatches={current} view={viewOf(current, teams)} />);
    act(() => { fireEvent.click(screen.getAllByTestId(`match-name-${ziel.id}-home`)[0]); });
    expect(screen.queryByTestId('match-action-menu')).toBeNull();
  });

  it('@SL-193 Tippflächen: jede Aktion ist eine Taste von mindestens 56 px mit data-testid', () => {
    const ziel = zeige('Finalrunde', 'geplant', LEITUNG);
    tippe('Finalrunde', ziel.id);
    for (const li of within(menue()).getAllByRole('listitem')) {
      const taste = within(li).getByRole('button');
      expect(taste.getAttribute('data-testid')).toMatch(/^match-action-/);
      expect(taste.style.minHeight).toContain('--touch-target-primary');
    }
  });

  it('@SL-193 Teams stehen noch nicht fest: „Ergebnis eintragen“ und „Nicht angetreten“ sind gesperrt und nennen den Grund, nichts geschieht', () => {
    const unbesetzt = offen.allMatches.filter((m) => m.phase !== 'groupStage').at(-1)!;
    const current: Match[] = offen.allMatches.map((m) => matchOf(m));
    render(
      <MatchTimeShiftContext.Provider value={{ originalTimeOf: () => undefined, shiftFrom: spies.shift }}>
        <ScheduleDisplay schedule={offen} currentMatches={current} view={viewOf(current, teams)} editable actionRights={LEITUNG}
          onNavigateToCockpit={spies.cockpit} onScoreChange={spies.score} forfeit={{ mark: spies.mark, revoke: spies.revoke }} />
      </MatchTimeShiftContext.Provider>,
    );
    tippe('Finalrunde', unbesetzt.id);
    expect(aktion('enterResult')).toHaveAttribute('aria-disabled', 'true');
    expect(aktion('enterResult')).toHaveTextContent('Die Teams dieses Spiels stehen noch nicht fest.');
    expect(aktion('forfeit')).toHaveAttribute('aria-disabled', 'true');
    expect(aktion('forfeit')).toHaveTextContent('Die Teams dieses Spiels stehen noch nicht fest.');
    act(() => { fireEvent.click(aktion('forfeit')); });
    expect(spies.mark).not.toHaveBeenCalled();
    act(() => { fireEvent.click(aktion('enterResult')); });
    expect(spies.score).not.toHaveBeenCalled();
  });
});

describe('@SL-193 gewertet und abgesetzt – Gruppenphase und Finalrunde gleich', () => {
  const GEWERTET: Cache = { matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit' };
  const ABGESETZT: Cache = { matchStatus: 'skipped' };

  for (const runde of ['Gruppenphase', 'Finalrunde'] as const) {
    it(`@SL-193 ${runde} gewertet: die Turnierleitung sieht „Wertung zurücknehmen“`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG, { cache: GEWERTET });
      tippe(runde, ziel.id);
      expect(eintraege()).toEqual(['Wertung zurücknehmen']);
    });

    it(`@SL-193 ${runde} abgesetzt: die Turnierleitung sieht „Ergebnis eintragen“`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG, { cache: ABGESETZT });
      tippe(runde, ziel.id);
      expect(eintraege()).toEqual(['Ergebnis eintragen']);
    });

    it(`@SL-193 ${runde} gewertet: ein Helfer bekommt keine leere Auswahl, sondern den Hinweis „Spiel wurde gewertet“`, () => {
      const ziel = zeige(runde, 'geplant', HELFER, { cache: GEWERTET });
      tippe(runde, ziel.id);
      expect(screen.queryByTestId('match-action-menu')).toBeNull();
      expect(screen.getByText('Spiel wurde gewertet')).toBeInTheDocument();
    });

    it(`@SL-193 ${runde} abgesetzt: ein Helfer bekommt keine leere Auswahl, sondern den Hinweis „Spiel wurde abgesetzt“`, () => {
      const ziel = zeige(runde, 'geplant', HELFER, { cache: ABGESETZT });
      tippe(runde, ziel.id);
      expect(screen.queryByTestId('match-action-menu')).toBeNull();
      expect(screen.getByText('Spiel wurde abgesetzt')).toBeInTheDocument();
    });

    it(`@SL-193 Gegenbeispiel ${runde}: ein Helfer ohne Aktion bei einem geplanten Spiel (kein Cockpit-Weg) bekommt weder Auswahl noch Hinweis`, () => {
      const ziel = runde === 'Gruppenphase' ? GRUPPENSPIEL : FINALSPIEL;
      const current: Match[] = schedule.allMatches.map((m) => matchOf(m, m.id !== ziel.id && m.phase === 'groupStage' ? gespielt(m) : {}));
      render(
        <ToastProvider>
          <ScheduleDisplay schedule={schedule} currentMatches={current} view={viewOf(current, teams)} editable actionRights={HELFER} />
        </ToastProvider>,
      );
      tippe(runde, ziel.id);
      expect(screen.queryByTestId('match-action-menu')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it(`@SL-193 Gegenbeispiel ${runde}: ein Helfer bei einem beendeten Spiel bekommt die Auswahl, keinen Hinweis`, () => {
      const ziel = zeige(runde, 'beendet', HELFER);
      tippe(runde, ziel.id);
      expect(screen.getByTestId('match-action-menu')).toBeInTheDocument();
      expect(screen.queryByText(/Spiel wurde (gewertet|abgesetzt)/)).toBeNull();
    });
  }
});

describe('@SL-193 die Aktionen führen die vorhandenen Wege aus', () => {
  for (const runde of ['Gruppenphase', 'Finalrunde'] as const) {
    it(`@SL-193 ${runde} geplant: „Im Cockpit anpfeifen“ navigiert zu diesem Spiel`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('kickOff')); });
      expect(spies.cockpit).toHaveBeenCalledExactlyOnceWith(ziel.id);
    });

    it(`@SL-193 ${runde} läuft: „Zum Cockpit“ navigiert zu diesem Spiel`, () => {
      const ziel = zeige(runde, 'läuft', HELFER);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('toCockpit')); });
      expect(spies.cockpit).toHaveBeenCalledExactlyOnceWith(ziel.id);
    });

    it(`@SL-193 @EK-063 ${runde} beendet: „Ergebnis korrigieren“ ruft den Korrektur-Einstieg mit diesem Spiel`, () => {
      const ziel = zeige(runde, 'beendet', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('correct')); });
      expect(spies.correct).toHaveBeenCalledExactlyOnceWith(ziel.id);
      expect(screen.queryByTestId('match-action-menu')).toBeNull();
    });

    it(`@SL-193 ${runde} geplant: „Ab hier verschieben“ öffnet den Zeiten-Weg ab diesem Spiel`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('shiftFrom')); });
      expect(spies.shift).toHaveBeenCalledExactlyOnceWith(ziel.id);
    });

    it(`@SL-193 ${runde} geplant: „Nicht angetreten“ ruft den bestehenden Weg`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('forfeit')); });
      expect(spies.mark).toHaveBeenCalledExactlyOnceWith(ziel.id);
    });

    it(`@SL-193 ${runde} geplant: „Schiedsrichter ändern“ öffnet eine Auswahl direkt am Spiel und übernimmt die Wahl`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('changeReferee')); });
      fireEvent.change(screen.getByTestId('match-choice-referee-select'), { target: { value: '2' } });
      act(() => { fireEvent.click(screen.getByTestId('match-choice-referee-apply')); });
      expect(spies.referee).toHaveBeenCalledExactlyOnceWith(ziel.id, 2);
    });

    it(`@SL-193 ${runde} geplant: „Feld ändern“ öffnet eine Auswahl direkt am Spiel und übernimmt die Wahl`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('changeField')); });
      const andere = ziel.field === 1 ? 2 : 1;
      fireEvent.change(screen.getByTestId('match-choice-field-select'), { target: { value: String(andere) } });
      act(() => { fireEvent.click(screen.getByTestId('match-choice-field-apply')); });
      expect(spies.field).toHaveBeenCalledExactlyOnceWith(ziel.id, andere);
    });

    it(`Gegenbeispiel ${runde}: „Abbrechen“ in der Auswahl des Felds ändert nichts`, () => {
      const ziel = zeige(runde, 'geplant', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('changeField')); });
      act(() => { fireEvent.click(screen.getByTestId('match-choice-field-cancel')); });
      expect(spies.field).not.toHaveBeenCalled();
      expect(screen.queryByTestId('match-choice-field')).toBeNull();
    });
  }

  it('@SL-193 Gruppenphase geplant: „Ergebnis eintragen“ öffnet das Blatt „Endergebnis“ (@SL-195); gespeichert wird erst dort', () => {
    const ziel = zeige('Gruppenphase', 'geplant', LEITUNG);
    tippe('Gruppenphase', ziel.id);
    act(() => { fireEvent.click(aktion('enterResult')); });
    expect(screen.getByTestId('result-sheet')).toBeInTheDocument();
    expect(spies.score).not.toHaveBeenCalled();
  });

  it('@SL-193 @FU-112 Gruppenphase läuft: „Spiel beenden und Ergebnis eintragen“ öffnet die Eingabe', () => {
    const ziel = zeige('Gruppenphase', 'läuft', LEITUNG);
    tippe('Gruppenphase', ziel.id);
    act(() => { fireEvent.click(aktion('endAndEnter')); });
    expect(screen.getByTestId('result-sheet')).toBeInTheDocument();
  });

  it('@SL-193 Finalrunde geplant: „Ergebnis eintragen“ setzt den Fokus auf das Eingabefeld der Heim-Tore dieses Spiels', () => {
    const ziel = zeige('Finalrunde', 'geplant', LEITUNG);
    tippe('Finalrunde', ziel.id);
    act(() => { fireEvent.click(aktion('enterResult')); });
    const felder = [...screen.getAllByTestId(`match-score-input-${ziel.id}-home`), ...screen.getAllByTestId(`final-score-input-${ziel.id}-home`)];
    expect(felder).toContain(document.activeElement);
  });

  it('@SL-193 @FU-112 Finalrunde läuft: „Spiel beenden und Ergebnis eintragen“ setzt den Fokus auf das Eingabefeld', () => {
    const ziel = zeige('Finalrunde', 'läuft', LEITUNG);
    tippe('Finalrunde', ziel.id);
    act(() => { fireEvent.click(aktion('endAndEnter')); });
    const felder = [...screen.queryAllByTestId(`match-score-input-${ziel.id}-home`), ...screen.queryAllByTestId(`final-score-input-${ziel.id}-home`)];
    expect(felder.length).toBeGreaterThan(0);
    expect(felder).toContain(document.activeElement);
  });

  it('@ZM-104 @W2A-026 gewertetes Spiel: die Turnierleitung kann die Wertung zurücknehmen', () => {
    const ziel = zeige('Gruppenphase', 'geplant', LEITUNG, { cache: { matchStatus: 'finished', scoreA: 0, scoreB: 2, decidedBy: 'forfeit' } });
    tippe('Gruppenphase', ziel.id);
    act(() => { fireEvent.click(aktion('revokeForfeit')); });
    expect(spies.revoke).toHaveBeenCalledExactlyOnceWith(ziel.id);
  });
});

describe('@ZP-093 @HE-042 @FU-113 Sperren und Gegenbeispiele', () => {
  for (const runde of ['Gruppenphase', 'Finalrunde'] as const) {
    it(`@ZP-093 ${runde}: bei einem angepfiffenen Spiel fehlen „Schiedsrichter ändern“, „Feld ändern“ und „Ab hier verschieben“`, () => {
      const ziel = zeige(runde, 'läuft', LEITUNG);
      tippe(runde, ziel.id);
      for (const name of ['changeReferee', 'changeField', 'shiftFrom', 'forfeit']) {
        expect(screen.queryByTestId(`match-action-${name}`)).toBeNull();
      }
    });

    it(`@HE-042 @FU-113 ${runde}: ein Helfer sieht bei einem beendeten Spiel kein „Ergebnis korrigieren“`, () => {
      const ziel = zeige(runde, 'beendet', HELFER);
      tippe(runde, ziel.id);
      expect(screen.queryByTestId('match-action-correct')).toBeNull();
      expect(screen.getByTestId('match-action-protocol')).toBeInTheDocument();
    });

    it(`@HE-042 ${runde}: ein Helfer sieht bei einem geplanten Spiel weder „Ergebnis eintragen“ noch „Nicht angetreten“ noch Zeitplan-Änderungen`, () => {
      const ziel = zeige(runde, 'geplant', HELFER);
      tippe(runde, ziel.id);
      for (const name of ['enterResult', 'forfeit', 'shiftFrom', 'changeReferee', 'changeField', 'kickOff']) {
        expect(screen.queryByTestId(`match-action-${name}`)).toBeNull();
      }
    });
  }
});

describe('@FU-080 @FU-082 Protokoll ansehen (Befund C-PROTOKOLL-OHNE-EINSTIEG)', () => {
  const tor = {
    id: 'e1', matchId: 'x', type: 'GOAL', timestampSeconds: 125, payload: { teamId: teams[0].id, teamName: teams[0].name, direction: 'INC' },
    scoreAfter: { home: 1, away: 0 },
  };

  for (const runde of ['Gruppenphase', 'Finalrunde'] as const) {
    it(`@FU-080 ${runde} beendet: „Protokoll ansehen“ zeigt das Protokoll des Spiels, nur lesend`, () => {
      const ziel = runde === 'Gruppenphase' ? GRUPPENSPIEL : FINALSPIEL;
      live.matches = new Map([[ziel.id, {
        id: ziel.id, homeTeam: { id: teams[0].id, name: teams[0].name }, awayTeam: { id: teams[1].id, name: teams[1].name }, events: [tor],
      }]]);
      zeige(runde, 'beendet', LEITUNG);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('protocol')); });
      const blatt = screen.getByTestId('event-log-sheet');
      expect(within(blatt).getByText('Ereignisprotokoll')).toBeInTheDocument();
      expect(within(blatt).getAllByText(/Tor/).length).toBeGreaterThan(0);
      expect(within(blatt).queryByText(/Bearbeiten/)).toBeNull();
    });

    it(`@FU-082 ${runde} beendet: der Spielplan fragt useLiveMatches mit der Kennung des Turniers (nicht leer)`, () => {
      zeige(runde, 'beendet', HELFER);
      expect(live.calls).toContain('turnier-7');
      expect(live.calls).not.toContain('');
    });

    // Zwei Abonnements auf demselben Kanal: das Schließen des Protokolls nähme das des Spielplans mit.
    it(`@FU-082 ${runde} beendet: das Protokoll öffnet kein zweites Abonnement; nach dem Schließen hat der Spielplan seines noch`, () => {
      const ziel = zeige(runde, 'beendet', HELFER);
      expect(live.active).toBe(1);
      tippe(runde, ziel.id);
      act(() => { fireEvent.click(aktion('protocol')); });
      expect(screen.getByTestId('event-log-sheet')).toBeInTheDocument();
      expect(live.active).toBe(1);
      act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
      expect(live.active).toBe(1);
    });
  }

  it('@FU-080 ohne Ereignisse steht „Noch keine Ereignisse aufgezeichnet“', () => {
    const ziel = zeige('Gruppenphase', 'beendet', HELFER);
    tippe('Gruppenphase', ziel.id);
    act(() => { fireEvent.click(aktion('protocol')); });
    expect(screen.getByText('Noch keine Ereignisse aufgezeichnet')).toBeInTheDocument();
  });
});
