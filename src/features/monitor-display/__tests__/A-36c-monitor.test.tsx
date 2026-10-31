/**
 * A-36c T2-UI (a): Hallen-Monitor (Zeile, Live-Folie, „Nächste Spiele“, Spielplan, Finalrunde) liest die gemeinsame Ansicht.
 * Werte und Wortlaut aus dem Gherkin der Szenarien, feste Literale in `core/view/__fixtures__/expected.ts`:
 *   @TM-015, @ZM-102, @ZM-039/@ZM-040/@ZM-041, @ZM-104, @ZM-111, @ZM-005 (Matrix in publicVisibility.test.ts).
 * Die Fixture „Hallencup Nord“ entsteht über den echten Weg (Veröffentlichen → Mapper-Rundlauf → Engine → cacheColumns).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { LiveSlide } from '../slides/LiveSlide';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { fieldSchedule, standingsSections } from '../slideContent';
import { displayList } from '../../../design-tokens';
import { buildMonitorView } from '../monitorView';
import { liveMatchOf, withView } from './monitorViewHelper';
import { slide } from './monitorFixture';
import { fAUS, fHF, fPAUSE, fTAB, fZEIT, GAME, withCloudColumns, type Hallencup } from '../../../core/view/__fixtures__/hallencupNord';
import { EXPECTED_PLAN, EXPECTED_STATE, EXPECTED_TIME, FORBIDDEN_FRAGMENTS } from '../../../core/view/__fixtures__/expected';
import type { Tournament } from '../../../types/tournament';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;
const zeile = (id: string): HTMLElement => {
  const found = screen.getAllByTestId('monitor-match-row').find(row => row.getAttribute('data-match-id') === id);
  if (found === undefined) { throw new Error(`Zeile ${id} fehlt`); }
  return found;
};
const zeilenIds = (): Array<string | null> => screen.queryAllByTestId('monitor-match-row').map(row => row.getAttribute('data-match-id'));

/** Seite der Spielplan-Folie, auf der das Spiel steht (4 Zeilen je Seite, @ZM-185). */
function seiteVon(tournament: Tournament, index: number): number {
  const match = tournament.matches[index];
  const position = fieldSchedule(buildMonitorView(tournament), match.field).findIndex(m => m.id === match.id);
  return Math.floor(position / displayList.scheduleRowsPerPage);
}

function spielplan(cup: Hallencup, index: number, tournament: Tournament = cup.tournament) {
  const feld = tournament.matches[index].field;
  const folie: MonitorSlide = slide('schedule-field', { fieldId: `field-${feld}` });
  return render(<ScheduleFieldSlide slide={folie} {...withView(tournament)} theme="dark" style={{}} page={seiteVon(tournament, index)} />);
}

describe('@TM-015 @ZM-102 Monitor: Herkunft offener Plätze, besetzter Platz ohne Herkunft', () => {
  it('@TM-015 F-HF Finalrunde: HF1 „FC Nord“ gegen „Zweiter Gruppe B“, Finale Heim „Sieger Halbfinale 1“', async () => {
    const cup = await fHF();
    const view = buildMonitorView(cup.tournament);
    const finals = standingsSections(cup.tournament, view).findIndex(s => s.kind === 'finals');
    render(<AllStandingsSlide {...withView(cup.tournament)} theme="dark" style={{}} page={finals} />);
    const erwartet = EXPECTED_PLAN['F-HF'];
    const hf1 = within(zeile(idOf(cup, GAME.HF1)));
    expect(hf1.getByText(erwartet.hf1Home.label.de)).toBeInTheDocument();
    expect(hf1.getByText(erwartet.hf1Away.label.de)).toBeInTheDocument();
    expect(within(zeile(idOf(cup, GAME.FINAL))).getByText(erwartet.finalHome.label.de)).toBeInTheDocument();
    for (const roh of FORBIDDEN_FRAGMENTS) {
      expect(document.body.textContent).not.toContain(roh);
    }
  });

  it('@ZM-102 F-TAB Spielplan: HF1 zeigt FC Nord ohne Herkunft, der Gast „noch offen“ statt „Zweiter Gruppe B“', async () => {
    const cup = await fTAB();
    spielplan(cup, GAME.HF1);
    const erwartet = EXPECTED_PLAN['F-TAB'];
    const hf1 = within(zeile(idOf(cup, GAME.HF1)));
    expect(hf1.getByText(erwartet.hf1Home.label.de)).toBeInTheDocument();
    expect(hf1.getByText(erwartet.hf1Away.label.de)).toBeInTheDocument();
    // Gegenbeispiel: auf dem ganzen Bild steht kein Gruppenrang
    expect(document.body.textContent).not.toContain('Erster Gruppe A');
    expect(document.body.textContent).not.toContain('Zweiter Gruppe B');
  });

  it('@ZM-102 Kindermodus: derselbe Schutz, Teamnamen bleiben', async () => {
    const cup = await fHF();
    spielplan(cup, GAME.HF1, { ...cup.tournament, hideScoresForPublic: true });
    const hf1 = within(zeile(idOf(cup, GAME.HF1)));
    expect(hf1.getByText('FC Nord')).toBeInTheDocument();
    expect(hf1.getByText('noch offen')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Zweiter Gruppe B');
  });
});

describe('@ZM-039 @ZM-040 @ZM-041 F-PAUSE: unterbrochen bleibt live, nie „nächstes Spiel“', () => {
  it('@OB-066 @ZM-039 Spielplan: Spiel 7 (angehalten bei 1:0) trägt „Pause“, Spiel 8 (läuft) „Live“', async () => {
    const cup = await fPAUSE();
    for (const [n, wort] of [[7, 'Pause'], [8, 'Live']] as const) {
      const id = idOf(cup, GAME[n]);
      spielplan(cup, GAME[n]);
      expect(within(zeile(id)).getByTestId('match-status-badge')).toHaveTextContent(wort);
      document.body.innerHTML = '';
    }
  });

  it('@ZM-039 Spielplan: Spiel 7 zeigt den Stand 1:0 (Zwischenstand, kein Endstand-Zusatz)', async () => {
    const cup = await fPAUSE();
    spielplan(cup, GAME[7]);
    const row = zeile(idOf(cup, GAME[7]));
    expect(within(row).getByTestId('monitor-match-separator').textContent).toBe('1:0');
    expect(within(row).queryByTestId('monitor-match-extra')).toBeNull();
  });

  it('@ZM-041 „Nächste Spiele“: weder das unterbrochene Spiel 7 noch das laufende Spiel 8, aber Spiel 9', async () => {
    const cup = await fPAUSE();
    render(<NextMatchesSlide slide={slide('next-matches', { matchCount: 5 })} {...withView(cup.tournament)} theme="dark" style={{}} />);
    const ids = zeilenIds();
    expect(ids).not.toContain(idOf(cup, GAME[7]));
    expect(ids).not.toContain(idOf(cup, GAME[8]));
    expect(ids).toContain(idOf(cup, GAME[9]));
  });

  it('@ZM-039 Live-Folie Feld 1: das unterbrochene Spiel 7 steht als Live-Anzeige da, nicht als „Nächstes Spiel“', async () => {
    const cup = await fPAUSE();
    const feld = cup.tournament.matches[GAME[7]].field;
    render(<LiveSlide slide={slide('live', { fieldId: `field-${feld}` })} {...withView(cup.tournament)}
      performanceSettings={{} as never} theme="dark" style={{}} />);
    expect(screen.getByTestId('live-slide-area')).toBeInTheDocument();
    expect(screen.queryByText('Nächstes Spiel')).toBeNull();
    // die Paarung des unterbrochenen Spiels steht in der Live-Anzeige
    const spiel7 = cup.tournament.matches[GAME[7]];
    const name = (slot: typeof spiel7.slotA) => cup.tournament.teams.find(t => slot.kind === 'team' && t.id === slot.teamId)?.name ?? '';
    expect(screen.getAllByText(name(spiel7.slotA)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Pause'); // Wort statt Marke „PAUSE“ (@OB-066)
  });
});

describe('@ZM-104 F-AUS / F-WERT: ausgefallen und gewertet', () => {
  it('@ZM-104 Spiel 9 steht als „ausgefallen“ ohne Ergebnis da, nicht live', async () => {
    const cup = await fAUS();
    spielplan(cup, GAME[9]);
    const row = zeile(idOf(cup, GAME[9]));
    const erwartet = EXPECTED_STATE['F-AUS spiel9'];
    expect(row.getAttribute('data-status')).toBe(erwartet.status);
    // „ausgefallen“ steht im Abzeichen (@OB-066), nicht mehr als Zusatzzeile; Wortlaut unverändert
    expect(within(row).getByTestId('match-status-badge').textContent).toBe(erwartet.statusText.de);
    expect(within(row).getByTestId('monitor-match-separator').textContent).not.toMatch(/\d/);
    expect(within(row).getByTestId('match-status-badge')).toHaveAttribute('data-state', 'cancelled');
    expect(within(row).getByTestId('match-status-badge')).not.toHaveAttribute('data-pulse');
  });

  it('@ZM-104 Gegenbeispiel: ausgefallen ist kein „nächstes Spiel“ und keine Live-Anzeige auf Feld 1', async () => {
    const cup = await fAUS();
    render(<NextMatchesSlide slide={slide('next-matches', { matchCount: 5 })} {...withView(cup.tournament)} theme="dark" style={{}} />);
    expect(zeilenIds()).not.toContain(idOf(cup, GAME[9]));
    document.body.innerHTML = '';
    const feld = cup.tournament.matches[GAME[9]].field;
    render(<LiveSlide slide={slide('live', { fieldId: `field-${feld}` })} {...withView(cup.tournament)}
      performanceSettings={{} as never} theme="dark" style={{}} />);
    expect(screen.queryByTestId('live-slide-area')).toBeNull();
  });

  it('@ZM-104 gewertet: Ergebnis 2:0 und das Kennzeichen „gewertet“; im Kindermodus „beendet“ ohne Ergebnis und ohne Kennzeichen', async () => {
    const aus = await fAUS();
    const cup = withCloudColumns(aus, GAME[10], { score_a: 2, score_b: 0, match_status: 'finished', decided_by: 'forfeit' });
    spielplan(cup, GAME[10]);
    const row = zeile(idOf(cup, GAME[10]));
    expect(within(row).getByTestId('monitor-match-separator').textContent).toBe('2:0');
    expect(within(row).getByTestId('monitor-match-note').textContent).toBe('gewertet');
    document.body.innerHTML = '';

    spielplan(cup, GAME[10], { ...cup.tournament, hideScoresForPublic: true });
    const kinder = zeile(idOf(cup, GAME[10]));
    expect(within(kinder).queryByTestId('monitor-match-note')).toBeNull();
    expect(kinder.textContent).not.toContain('gewertet');
    expect(kinder.textContent).not.toContain('2:0');
    expect(kinder.getAttribute('data-status')).toBe('finished');
  });
});

describe('@ZM-111 F-ZEIT: Uhrzeiten in der Ortszeit des Turniers', () => {
  const vorher = process.env.TZ;
  afterEach(() => {
    if (vorher === undefined) { delete process.env.TZ; } else { process.env.TZ = vorher; }
  });

  it('@ZM-111 Zeile Spiel 9: „14:40“, obwohl das Gerät in America/New_York steht', async () => {
    process.env.TZ = 'America/New_York';
    const cup = await fZEIT();
    spielplan(cup, GAME[9]);
    expect(within(zeile(idOf(cup, GAME[9]))).getByText(EXPECTED_TIME.spiel9Kickoff.time)).toBeInTheDocument();
  });

  it('@ZM-111 Live-Folie Feld 1 vor dem Anpfiff: Anstoß „14:40“ (nächstes Spiel nach Turnierzeit)', async () => {
    process.env.TZ = 'America/New_York';
    const cup = await fZEIT();
    const feld = cup.tournament.matches[GAME[9]].field;
    render(<LiveSlide slide={slide('live', { fieldId: `field-${feld}` })} {...withView(cup.tournament)}
      performanceSettings={{} as never} theme="dark" style={{}} />);
    expect(screen.getByText(new RegExp(EXPECTED_TIME.spiel9Kickoff.time))).toBeInTheDocument();
  });

  it('@ZM-111 LiveMatch: der Anstoß ist die Wanduhr des Turniers, nicht die UTC-Zeit der Gerätezeit', async () => {
    process.env.TZ = 'America/New_York';
    const cup = await fZEIT();
    const live = liveMatchOf(cup.tournament.matches[GAME[9]], cup.tournament);
    expect(live.scheduledKickoff).toBe(`${EXPECTED_TIME.spiel9Kickoff.date}T${EXPECTED_TIME.spiel9Kickoff.time}`);
    expect(live.scheduledKickoff).not.toMatch(/Z$|19:40/);
  });
});

describe('Status der Live-Anzeige aus der Ansicht (kein „ausgefallen = beendet“)', () => {
  it('@ZM-104 toLiveMatch: ein ausgefallenes Spiel ist nie FINISHED', async () => {
    const cup = await fAUS();
    expect(liveMatchOf(cup.tournament.matches[GAME[9]], cup.tournament).status).not.toBe('FINISHED');
  });

  it('@ZM-039 toLiveMatch: unterbrochen = PAUSED, laufend = RUNNING, beendet = FINISHED', async () => {
    const cup = await fPAUSE();
    expect(liveMatchOf(cup.tournament.matches[GAME[7]], cup.tournament).status).toBe('PAUSED');
    expect(liveMatchOf(cup.tournament.matches[GAME[8]], cup.tournament).status).toBe('RUNNING');
    expect(liveMatchOf(cup.tournament.matches[0], cup.tournament).status).toBe('FINISHED');
  });
});
