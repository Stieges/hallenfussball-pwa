/**
 * LiveCockpit: Tafel vor dem Anpfiff und ohne Spiel (Aufgabe 2.5), mit echten deutschen Texten.
 * Szenarien: @SL-049 (Spiel 13 TSV West – SG Mitte, 15:15, Feld 1 bereit), @SL-051 (Mindestpause), @SL-118 (überfällig),
 * @SL-089 (Sperr-Hinweis, Tor trotzdem möglich), @SL-052/@SL-119 (wartet auf die Herkunft), @SL-054 (kein Spiel mehr),
 * @SL-015 (Übernahme). Beispielturnier „Hallencup Süd“.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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


afterEach(() => { vi.useRealTimers(); });

/** 28.11.2026 um HH:MM Ortszeit (die Anzeige liest Ortszeit, der Test ist zeitzonenunabhängig). */
const um = (stunde: number, minute: number): Date => new Date(2026, 10, 28, stunde, minute);

const spiel13 = makeLiveMatch({
  id: 'm13', number: 13, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff: um(15, 15).toISOString(),
  homeTeam: { id: 'tsv-west', name: 'TSV West' }, awayTeam: { id: 'sg-mitte', name: 'SG Mitte' },
});

describe('LiveCockpit: Tafel vor dem Anpfiff', () => {
  it('@SL-049 Spiel 13 TSV West – SG Mitte, 15:15, Feld 1 steht zum Anpfiff bereit', () => {
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement(); // @OB-068: der Platz des Abzeichens bleibt leer, die Anstoßzeit steht bei der Uhr
    expect(screen.getByTestId('scoreboard-name-links')).toHaveTextContent('TSV West');
    expect(screen.getByTestId('scoreboard-name-rechts')).toHaveTextContent('SG Mitte');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('15:15');
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Anstoß');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spiel 13 · Feld 1');
    expect(screen.getByTestId('match-start-button')).toBeEnabled();
  });

  it('@SL-118 um 15:22 ist Spiel 13 seit 7 Minuten überfällig, ein Nichtantritt lässt sich im Cockpit nicht markieren', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(um(15, 22));
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.getByText('überfällig 7 Min')).toBeInTheDocument();
    expect(screen.queryByText(/Nichtantritt/i)).toBeNull();
  });

  it('@SL-118 Gegenbeispiel: um 15:14 steht kein Hinweis „überfällig“', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(um(15, 14));
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.queryByText(/überfällig/)).toBeNull();
  });

  it('@SL-051 SG Mitte hätte nur 6 statt 10 Minuten Pause: Hinweis in der Tafel, der Anpfiff bleibt möglich', () => {
    render(<LiveCockpit {...makeProps(spiel13, { mindestpause: { teamName: 'SG Mitte', minuten: 6, mindestMinuten: 10 } })} />);
    expect(within(screen.getByTestId('scoreboard')).getByText('SG Mitte hätte nur 6 statt 10 Minuten Pause')).toBeInTheDocument();
    expect(screen.getByTestId('match-start-button')).toBeEnabled();
  });

  it('@SL-089 „Nr. 7 ist für dieses Turnier gesperrt“ steht vor dem Anpfiff in der Tafel; es sperrt nichts (der Anpfiff bleibt möglich)', () => {
    render(<LiveCockpit {...makeProps(spiel13, { sperrHinweise: [{ teamId: 'tsv-west', playerNumber: 7, ausSpielNummer: 8 }] })} />);
    expect(within(screen.getByTestId('scoreboard')).getByText('TSV West: Nr. 7 ist für dieses Turnier gesperrt')).toBeInTheDocument();
    expect(screen.getByTestId('match-start-button')).toBeEnabled();
  });

  // Im laufenden Spiel steht der Sperr-Hinweis in der Team-Spalte (Aufgabe 3.3); das Tor trotzdem erfassen prüft 3.4.
  it.todo('@SL-089 im laufenden Spiel steht der Sperr-Hinweis in der Team-Spalte und das Tor für Nr. 7 lässt sich erfassen (Aufgabe 3.3/3.4)');

  it('@SL-015 nach der Übernahme: „Spielzeit beruht auf Toms Gerät – bitte prüfen“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { uebernahmeVon: 'Tom' })} />);
    expect(screen.getByText('Spielzeit beruht auf Toms Gerät – bitte prüfen')).toBeInTheDocument();
  });

  it('@SL-015 B-49: Vorgänger ohne Namen – „Spielzeit beruht auf dem vorigen Gerät – bitte prüfen“', () => {
    render(<LiveCockpit {...makeProps(makeLiveMatch(), { uebernahmeVon: '' })} />);
    expect(screen.getByText('Spielzeit beruht auf dem vorigen Gerät – bitte prüfen')).toBeInTheDocument();
  });
});

describe('LiveCockpit: Tafel ohne Spiel', () => {
  it('@SL-052 @SL-119 Halbfinale 1 wartet: Paarung, Grund, Hinweis auf die Turnierleitung – und es gibt keinen Anpfiff', () => {
    render(<LiveCockpit {...makeProps(null, { leer: { art: 'wartetAufHerkunft', gruende: ['Abschluss von Gruppe B'], paarung: 'FC Nord – Zweiter Gruppe B', spielLabel: 'Spiel 7 · Feld 1' } })} />);
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement(); // kein Abzeichen ohne Anstoß; die Paarung steht in der Leer-Anzeige
    expect(screen.getByTestId('scoreboard-empty')).toHaveTextContent('FC Nord – Zweiter Gruppe B');
    expect(screen.getByTestId('scoreboard-empty')).toHaveTextContent('Spiel 7 · Feld 1');
    expect(screen.getByText('Wartet auf: Abschluss von Gruppe B')).toBeInTheDocument();
    expect(screen.getByText('Nur die Turnierleitung ändert die Reihenfolge')).toBeInTheDocument();
    expect(screen.queryByTestId('match-start-button')).toBeNull();
  });

  it('@TM-035 ohne Netz nennt die Tafel zusätzlich, dass das Gerät kein Netz hat', () => {
    render(<LiveCockpit {...makeProps(null, { leer: { art: 'wartetAufHerkunft', gruende: ['Abschluss von Gruppe B'], offline: true } })} />);
    expect(screen.getByText(/Dein Gerät hat kein Netz/)).toBeInTheDocument();
  });

  it('@SL-054 nach dem letzten Spiel von Feld 2 sagt die Tafel, dass dort kein weiteres Spiel folgt', () => {
    render(<LiveCockpit {...makeProps(null, { leer: { art: 'keinSpiel', feldName: 'Feld 2' } })} />);
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement(); // kein Abzeichen ohne Spiel; der Hinweis steht in der Leer-Anzeige
    expect(screen.getByText('Auf Feld 2 folgt kein Spiel mehr')).toBeInTheDocument();
    expect(screen.queryByTestId('match-start-button')).toBeNull();
  });

  it('Gegenbeispiel: ohne Spiel und ohne Grund steht weiter der Leerhinweis, keine Tafel', () => {
    render(<LiveCockpit {...makeProps(null)} />);
    expect(screen.getByText('Kein Spiel ausgewählt')).toBeInTheDocument();
    expect(screen.queryByTestId('scoreboard')).toBeNull();
  });
});

describe('LiveCockpit: Anstoßzeit in der Anzeigesprache', () => {
  it('B6 die Anstoßzeit steht auch in der englischen Anzeige im 24-Stunden-Format (15:15, nicht „3:15 PM“)', async () => {
    const i18n = (await import('i18next')).default;
    await i18n.changeLanguage('en');
    try {
      render(<LiveCockpit {...makeProps(spiel13)} />);
      expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent(/^15:15$/);
    } finally {
      await i18n.changeLanguage('de');
    }
  });
});

describe('@OB-068 Anstoßzeit nur einmal auf der Tafel (Zeit läuft)', () => {
  it('@OB-068 Gherkin um 15:10: „Anstoß 15:15“ groß bei der Uhr, der Platz des Abzeichens bleibt leer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(um(15, 10));
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Anstoß');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('15:15');
    expect(screen.getByTestId('scoreboard-state')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('scoreboard-ueberfaellig')).toBeNull();
  });

  it('@OB-068 Gherkin um 15:22 und noch nicht angepfiffen: „überfällig 7 Min“ auf dem Platz des Abzeichens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(um(15, 10));
    render(<LiveCockpit {...makeProps(spiel13)} />);
    act(() => {
      vi.setSystemTime(um(15, 22));
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId('scoreboard-ueberfaellig')).toHaveTextContent('überfällig 7 Min');
    expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('überfällig 7 Min');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('15:15');
    expect(screen.getAllByText(/überfällig/)).toHaveLength(1);
  });

  it('@OB-068 Gegenbeispiel: genau 15:15 ist nicht überfällig', () => {
    vi.useFakeTimers();
    vi.setSystemTime(um(15, 15));
    render(<LiveCockpit {...makeProps(spiel13)} />);
    expect(screen.queryByTestId('scoreboard-ueberfaellig')).toBeNull();
    expect(screen.queryByText(/überfällig/)).toBeNull();
  });
});
