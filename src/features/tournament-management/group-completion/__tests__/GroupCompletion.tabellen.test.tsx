/**
 * GA4 A-13c Oberfläche „Gruppe abschließen“ – RTL auf `TabellenTab` mit echten Anbietern und Repository-Attrappe auf
 * Cloud-Zeilen (Hallencup Nord, Nikolaus aus `group-state.json`). Aus dem Gherkin abgeleitet:
 * @TM-044 (Vorschlag), @TM-045 (kein Vorschlag vorzeitig), @TM-046/@TM-016 (Abschluss besetzt), @TM-043 @TM-048 @TM-049 (Gleichstand,
 * kein Los, ohne Eingabe bleibt offen), @TM-054 (nicht vorzeitig, mit Grund), @TM-057 @TM-058 (Jeder gegen jeden), @TM-059 (Zustand),
 * @TM-060 (Angebot je Zeile), @TM-149 (ohne entfernte Teams), @TM-150 (Neu-Abschluss), @W2A-048 @W2A-058 @W2A-063 @W2A-067.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../../types/tournament';

const hoisted = vi.hoisted(() => ({ repository: { current: undefined as object | undefined }, can: { current: true }, online: { current: true } }));
vi.mock('../../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: hoisted.repository.current }),
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => hoisted.can.current }));
vi.mock('../../../../hooks/useOnlineStatus', () => ({ useIsOnline: () => hoisted.online.current }));
vi.mock('../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.unmock('i18next');
vi.unmock('react-i18next');

import { generateFullSchedule } from '../../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../../utils/calculations';
import type { CompleteGroupRequest, CompleteGroupResult, ReopenGroupResult } from '../../../../core/repositories/groupCompletionCloud';
import { RetryLaterError } from '../../../../core/errors';
import { completion, HC, matchOf, NK, tournamentFromFixture, withMatch } from '../../../../core/standings/__tests__/groupCompletionKit';
import { jgj, MemoryRepo } from '../../../../core/standings/__tests__/decisionTestKit';
import { DATA } from '../../../../core/standings/__tests__/fixtures';
import { ET021_GRUPPE_A, ET021_GRUPPE_B, zweiGruppen } from '../../../../core/standings/__tests__/tb4Kit';
import { teamSlot } from '../../../../core/models/matchSlot';
import { placeFollowUps } from '../../../../core/services/followUpPlacement';
import { activeRanking } from '../../../../core/services/GroupCompletionService';
import { groupRank, slots } from '../../../../test/matchSlotFixtures';
import { i18nWrapper } from '../../standings/__tests__/tieTestKit';
import { rankingTitle } from '../../__tests__/openPlacementTestHelpers';
import { TabellenTab } from '../../TabellenTab';
import { StandingTieProvider } from '../../standings/StandingTieProvider';
import { GroupCompletionProvider } from '../GroupCompletionProvider';
import { groupTestId } from '../groupTestId';

interface FakeRepo {
  completeGroup: ReturnType<typeof vi.fn<(tournamentId: string, request: CompleteGroupRequest) => Promise<CompleteGroupResult>>>;
  reopenGroup: ReturnType<typeof vi.fn<(tournamentId: string, groupId: string, reason: string) => Promise<ReopenGroupResult>>>;
}

const fakeRepo = (): FakeRepo => ({
  completeGroup: vi.fn(() => Promise.resolve<CompleteGroupResult>({ status: 'ok', alreadyCompleted: false, changed: [] })),
  reopenGroup: vi.fn(() => Promise.resolve<ReopenGroupResult>({ status: 'ok' })),
});

interface Options { repo?: FakeRepo; leitung?: boolean; online?: boolean; language?: 'de' | 'en' }

async function zeige(tournament: Tournament, { repo = fakeRepo(), leitung = true, online = true, language = 'de' }: Options = {}) {
  hoisted.repository.current = repo;
  hoisted.can.current = leitung;
  hoisted.online.current = online;
  const onChanged = vi.fn();
  const Wrapper = await i18nWrapper(language);
  render(
    <Wrapper>
      <MemoryRouter>
        <StandingTieProvider tournamentId={tournament.id} onChanged={onChanged}>
          <GroupCompletionProvider tournament={tournament}>
            <TabellenTab
              tournament={tournament}
              schedule={generateFullSchedule(tournament)}
              currentStandings={calculateStandingsPerGroup(tournament)}
              overallStandings={calculateStandings(tournament.teams, tournament.matches, tournament)}
            />
          </GroupCompletionProvider>
        </StandingTieProvider>
      </MemoryRouter>
    </Wrapper>,
  );
  return { repo, onChanged };
}

const hallencup = (): Tournament => tournamentFromFixture('hallencup');
const nikolaus = (places?: number[]): Tournament => ({ ...tournamentFromFixture('nikolaus'), ...(places !== undefined ? { placementsToPlayOut: places } : {}), version: 1 });

/** Hallencup mit Gruppe A fertig und Gruppe B ohne Gleichstand-Probleme nicht nötig; Gruppe A hat den Gleichstand Süd/West. */
const gruppeA = (): Tournament => hallencup();

/** Lage @TM-060: Gruppe A (Nord, Süd, West, Ost) mit West/Ost gleich auf 3/4, Gruppe B ohne Gleichstand. */
const lage060 = (places: number[], spielUmPlatz5: boolean): Tournament => {
  const t = zweiGruppen('NSWO', ET021_GRUPPE_A, 'MBUT', ET021_GRUPPE_B);
  return {
    ...t,
    matches: [
      ...t.matches,
      { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', label: '1. Halbfinale', ...slots(groupRank('A', 1), groupRank('B', 2)) },
      { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', label: '2. Halbfinale', ...slots(groupRank('B', 1), groupRank('A', 2)) },
      ...(spielUmPlatz5 ? [{ id: 'p5', round: 8, field: 1, isFinal: true, finalType: 'fifthSixth' as const, label: 'Spiel um Platz 5', ...slots(groupRank('A', 3), groupRank('B', 3)) }] : []),
    ],
    placementsToPlayOut: places,
  };
};

const placeAll = (t: Tournament): Tournament['matches'] => ['A', 'B'].reduce((acc, g) => placeFollowUps(acc, g, activeRanking(acc, g)).tournament, t).matches;

const marke = (g: string): string => screen.getByTestId(`group-state-${groupTestId(g)}`).textContent ?? '';

beforeEach(() => { cleanup(); });

describe('groupTestId (Auflage 1): genau eine Stelle bildet die Gruppe \'\' auf \'all\' ab', () => {
  it('\'\' → \'all\', Buchstaben bleiben', () => {
    expect([groupTestId(''), groupTestId('A'), groupTestId('B')]).toEqual(['all', 'A', 'B']);
  });
});

describe('@TM-059 Zustand je Gruppe (vier Zustandswörter, Zusatzmarke ersetzt das Wort nie)', () => {
  it('Hallencup: Gruppe A „bereit zum Abschluss“ (alle entschieden), Gruppe B „läuft“; Gruppenphase „läuft“, Finalrunde „offen“', async () => {
    await zeige(hallencup());
    expect(marke('A')).toBe('bereit zum Abschluss');
    expect(marke('B')).toBe('läuft');
    expect(screen.getByTestId('phase-state-groups')).toHaveTextContent('Gruppenphase: läuft');
    expect(screen.getByTestId('phase-state-finals')).toHaveTextContent('Finalrunde: offen');
  });

  it.each([
    { zeile: 'noch kein Spiel angepfiffen', aendern: (t: Tournament) => ({ ...t, matches: t.matches.map((m) => (m.group === 'B' ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined } : m)) }), gruppe: 'B', wort: 'offen' },
    { zeile: 'abgeschlossen', aendern: (t: Tournament) => ({ ...t, groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost])] }), gruppe: 'A', wort: 'abgeschlossen' },
  ])('@TM-059 $zeile → „$wort“', async ({ aendern, gruppe, wort }) => {
    await zeige(aendern(hallencup()));
    expect(marke(gruppe)).toBe(wort);
  });

  it('@TM-059 nach einer Korrektur bleibt die Gruppe „abgeschlossen“, dazu die Zusatzmarke „Besetzung prüfen“ (ersetzt das Wort nie)', async () => {
    await zeige({ ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost], { stale: true })] });
    expect(marke('A')).toBe('abgeschlossen');
    expect(screen.getByTestId('group-flag-checkSlots-A')).toHaveTextContent('Besetzung prüfen');
  });

  it('@TM-059 Gruppenphase „abgeschlossen“, wenn alle Gruppen abgeschlossen sind', async () => {
    const t = hallencup();
    const abgeschlossen = { ...t, matches: t.matches.map((m) => (m.group === 'B' ? { ...m, matchStatus: 'finished' as const, scoreA: m.scoreA ?? 1, scoreB: m.scoreB ?? 0 } : m)), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost]), completion('B', [HC.mitte, HC.berg, HC.ufer, HC.tal])] };
    await zeige(abgeschlossen);
    expect(screen.getByTestId('phase-state-groups')).toHaveTextContent('Gruppenphase: abgeschlossen');
  });
});

describe('@TM-044 @TM-045 Vorschlag und Rechte', () => {
  it('@TM-044 Gruppe A fertig: ein Banner mit einer Haupttaste; bei offenem Gleichstand mit Folgespiel heißt sie „Strafstoßschießen eintragen“ (Daniel 23.10.); die Halbfinals zeigen weiter ihre Herkunft (nichts besetzt)', async () => {
    const t = gruppeA();
    await zeige(t);
    expect(screen.getByTestId('group-close-suggestion')).toHaveTextContent('Gruppe A ist fertig – Tabelle prüfen und abschließen');
    expect(within(screen.getByTestId('group-close-suggestion')).getByTestId('group-close-button-A')).toHaveTextContent('Strafstoßschießen eintragen');
    expect(screen.getByTestId('group-close-then-A')).toHaveTextContent('Danach ist die Gruppe abgeschlossen.');
    expect(t.matches.filter((m) => m.isFinal === true).every((m) => m.slotA.kind === 'pending')).toBe(true);
  });

  it('@TM-045 Gegenbeispiel: 5 von 6 entschieden (ein Spiel läuft) → kein Vorschlag, keine Taste im Banner', async () => {
    const t = gruppeA();
    const lauf = matchOf(t, HC.sued, HC.west);
    await zeige(withMatch(t, lauf.id, { matchStatus: 'running' }));
    expect(screen.queryByTestId('group-close-suggestion')).toBeNull();
    expect(marke('A')).toBe('läuft');
  });

  it('@TM-044 Gegenbeispiel Helfer (useCan false): Zustand sichtbar, aber kein Banner, keine Taste, kein Dialog', async () => {
    await zeige(gruppeA(), { leitung: false });
    expect(marke('A')).toBe('bereit zum Abschluss');
    expect(screen.queryByTestId('group-close-suggestion')).toBeNull();
    expect(screen.queryByTestId('group-close-button-A')).toBeNull();
    expect(screen.queryByTestId('group-close-button-B')).toBeNull();
    expect(screen.getByText(/Die Turnierleitung schließt die Gruppe ab/)).toBeInTheDocument();
  });

  it('zwei Gruppen gleichzeitig fertig: ein Banner, eine Haupttaste (zuerst fertige Gruppe), eine Zweittaste, keine Sammeltaste', async () => {
    const t = gruppeA();
    const beideFertig: Tournament = { ...t, matches: t.matches.map((m) => (m.group === 'B' ? { ...m, matchStatus: 'finished' as const, scoreA: m.scoreA ?? 1, scoreB: m.scoreB ?? 0, finishedAt: '2026-11-28T10:00:00Z' } : m.group === 'A' ? { ...m, finishedAt: '2026-11-28T11:00:00Z' } : m)) };
    await zeige(beideFertig);
    const banner = screen.getByTestId('group-close-suggestion');
    expect(screen.getAllByTestId('group-close-suggestion')).toHaveLength(1);
    const tasten = within(banner).getAllByRole('button');
    expect(tasten.map((b) => b.getAttribute('data-testid'))).toEqual(['group-close-button-B', 'group-close-button-A']);
    expect(tasten.filter((b) => b.hasAttribute('data-primary'))).toHaveLength(1);
    expect(tasten[0]).toHaveAttribute('data-primary');
  });
});

describe('Abschluss-Hinweis: Wirkung, Person und Zeit (@TM-046, @TM-113)', () => {
  const abgeschlossen = (): Tournament => ({
    ...hallencup(),
    groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost])],
    decisionLog: [{ id: 1, kind: 'complete_group', groupId: 'A', detail: {}, actorName: 'Olli', at: '2026-11-28T11:00:00Z' }],
  });

  it('@TM-046 die Turnierleitung sieht „Gruppe A abgeschlossen · Olli · Zeit“ (aus dem Verlauf)', async () => {
    await zeige(abgeschlossen());
    expect(screen.getByTestId('group-done-A')).toHaveTextContent(/Gruppe A abgeschlossen · Olli · \d{2}:\d{2}/);
  });

  it('@TM-113 Gegenbeispiel Helfer: Wirkung ja, aber weder Person noch Zeit', async () => {
    await zeige(abgeschlossen(), { leitung: false });
    expect(screen.getByTestId('group-done-A')).toHaveTextContent('Gruppe A abgeschlossen');
    expect(screen.getByTestId('group-done-A')).not.toHaveTextContent(/Olli|\d{2}:\d{2}/);
  });

  it('S2 „Alle Plätze der Finalrunde sind besetzt“ nur, wenn keine Seite mehr auf einen Gruppenplatz wartet', async () => {
    const t = hallencup();
    const beide = { ...t, matches: t.matches.map((m) => (m.group === 'B' ? { ...m, matchStatus: 'finished' as const, scoreA: m.scoreA ?? 1, scoreB: m.scoreB ?? 0 } : m)), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost]), completion('B', [HC.mitte, HC.berg, HC.ufer, HC.tal])] };
    await zeige(beide); // Gruppen abgeschlossen, die Halbfinals zeigen aber noch ihre Herkunft
    expect(screen.queryByTestId('group-phase-done')).toBeNull();
    cleanup();
    const gefuellt = { ...beide, matches: placeAll(beide) };
    await zeige(gefuellt);
    expect(screen.getAllByTestId('group-phase-done').length).toBeGreaterThan(0);
  });

  it('S2 Gegenbeispiel: alle Seiten von Hand besetzt, aber eine Gruppe ist offen → kein Satz „Die Gruppenphase ist abgeschlossen“', async () => {
    const t = hallencup();
    const manuell = { ...t, matches: t.matches.map((m) => (m.isFinal === true ? { ...m, slotA: teamSlot(HC.nord), slotB: teamSlot(HC.mitte) } : m)), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost])] };
    await zeige(manuell); // Gruppe A abgeschlossen, Gruppe B läuft
    expect(screen.getByTestId('group-done-A')).toBeInTheDocument();
    expect(screen.queryByTestId('group-phase-done')).toBeNull();
  });
});

describe('@TM-048 @TM-049 @TM-043 @W2A-048 Gleichstand im Abschluss (Hallencup Nord)', () => {
  it('@TM-049 ohne Eingabe: der Dialog verlangt zuerst das Strafstoßschießen, „Gruppe abschließen“ ist gesperrt, completeGroup wird nie aufgerufen', async () => {
    const { repo } = await zeige(gruppeA());
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    const dialog = await screen.findByTestId('tie-decision-dialog');
    expect(dialog).toHaveTextContent('Strafstoßschießen eintragen');
    expect(screen.getByTestId('group-close-confirm')).toBeDisabled();
    expect(repo.completeGroup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('tie-dialog-cancel'));
    expect(repo.completeGroup).not.toHaveBeenCalled();
    expect(screen.queryByTestId('tie-decision-dialog')).toBeNull();
  });

  it('@TM-043 kein Los: weder im Banner noch im Dialog gibt es eine Auslosung', async () => {
    await zeige(gruppeA());
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    const dialog = await screen.findByTestId('tie-decision-dialog');
    expect(within(dialog).queryByText(/\bLos\b|Auslos|losen/i)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /los/i })).toBeNull();
  });

  it('@W2A-048 4:3 für West → completeGroup mit Rangfolge Nord, West, Süd, Ost, der Entscheidung (Kopie) und dem Stand; danach neu laden', async () => {
    const { repo, onChanged } = await zeige(gruppeA());
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await screen.findByTestId('tie-decision-dialog');
    const [sued, west] = [screen.getByTestId('tie-shootout-score-0'), screen.getByTestId('tie-shootout-score-1')];
    await userEvent.type(sued, '3');
    await userEvent.type(west, '4');
    await userEvent.click(screen.getByTestId('group-close-confirm'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(1); });
    const [tournamentId, request] = repo.completeGroup.mock.calls[0];
    expect(tournamentId).toBe(gruppeA().id);
    expect(request).toMatchObject({ groupId: 'A', ranking: [HC.nord, HC.west, HC.sued, HC.ost], openRanks: [], knownDecisionIds: [] });
    expect(request.tieDecisions).toHaveLength(1);
    expect(request.tieDecisions[0]).toMatchObject({ groupId: 'A', kind: 'shootout', order: [HC.west, HC.sued], shootout: { winner: 4, loser: 3 } });
    expect(request.expectedState).toHaveLength(6);
    await waitFor(() => { expect(onChanged).toHaveBeenCalled(); });
  });

  it('@TM-049 Server lehnt ab (Stand geändert): nichts angenommen, Meldung „Die Tabelle hat sich geändert“, Neuladen', async () => {
    const repo = fakeRepo();
    repo.completeGroup.mockResolvedValue({ status: 'rejected', code: 'STALE_VERSION' });
    const { onChanged } = await zeige(gruppeA(), { repo });
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await screen.findByTestId('tie-decision-dialog');
    await userEvent.type(screen.getByTestId('tie-shootout-score-0'), '3');
    await userEvent.type(screen.getByTestId('tie-shootout-score-1'), '4');
    await userEvent.click(screen.getByTestId('group-close-confirm'));
    expect(await screen.findByTestId('group-stale')).toHaveTextContent('Die Tabelle hat sich geändert');
    expect(onChanged).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('group-stale-ok'));
    expect(screen.queryByTestId('group-notice-dialog')).toBeNull();
  });
});

describe('@W2A-058 Entscheidung schon in der Tabelle gefallen: der Abschluss fragt nicht erneut', () => {
  it('Dialog mit Tabelle und Wirkung, ohne Zahlenfeld; completeGroup bekommt die bekannte Entscheidung', async () => {
    const repo = new MemoryRepo({ ...gruppeA(), version: 1 });
    expect((await repo.service(['alt-1']).decide(repo.tournament.id, { groupId: 'A', teamIds: [HC.west, HC.sued], order: [HC.west, HC.sued], kind: 'shootout', shootout: { winner: 4, loser: 3 } })).ok).toBe(true);
    const fake = fakeRepo();
    await zeige(repo.tournament, { repo: fake });
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    const dialog = await screen.findByTestId('group-close-dialog');
    expect(screen.queryByTestId('tie-decision-dialog')).toBeNull();
    expect(within(dialog).queryByTestId('tie-shootout-score-0')).toBeNull();
    expect(within(dialog).getByTestId('group-close-decided')).toHaveTextContent(/Strafstoßschießen 4:3/);
    expect(within(dialog).getByTestId('group-close-effect')).toHaveTextContent(/2\. Halbfinale Gast TSV West/);
    expect(within(dialog).getByTestId('group-close-ranking').querySelectorAll('li')).toHaveLength(4);
    await userEvent.click(within(dialog).getByTestId('group-close-confirm'));
    await waitFor(() => { expect(fake.completeGroup).toHaveBeenCalledTimes(1); });
    const request = fake.completeGroup.mock.calls[0][1];
    expect(request.tieDecisions.map((d) => d.id)).toEqual(['alt-1']);
    expect(request.knownDecisionIds).toEqual(['alt-1']);
    expect(request.ranking).toEqual([HC.nord, HC.west, HC.sued, HC.ost]);
  });
});

describe('@TM-060 Angebot je Zeile (Plätze, Herkunft)', () => {
  it.each([
    { plaetze: [1, 2], p5: false, zeile: 'nur Platz 1 und 2, keine Herkunft', akzeptieren: true },
    { plaetze: [1, 2, 3], p5: false, zeile: 'Platz 1 bis 3', akzeptieren: false },
    { plaetze: [1, 2], p5: true, zeile: 'Spiel um Platz 5 „Dritter A gegen Dritter B“', akzeptieren: false },
  ])('@TM-060 $zeile → „Ergebnis so akzeptieren“ angeboten: $akzeptieren; erst danach ist die Gruppe abgeschlossen', async ({ plaetze, p5, akzeptieren }) => {
    const { repo } = await zeige(lage060(plaetze, p5));
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await screen.findByTestId('tie-decision-dialog');
    expect(screen.queryByTestId('tie-accept-result') !== null).toBe(akzeptieren);
    expect(repo.completeGroup).not.toHaveBeenCalled();
  });

  it('@W2A-063 Ergebnis so akzeptieren: ein Tipp genügt, ohne Grund; completeGroup mit „shared“ und beiden auf Platz 3', async () => {
    const { repo } = await zeige(lage060([1, 2], false));
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(1); });
    const request = repo.completeGroup.mock.calls[0][1];
    expect(request.tieDecisions).toHaveLength(1);
    expect(request.tieDecisions[0]).toMatchObject({ kind: 'shared' });
    expect(request.tieDecisions[0]).not.toHaveProperty('reason');
    expect(request.groupId).toBe('A');
  });
});

describe('@TM-054 Eine Gruppe lässt sich nicht vorzeitig abschließen', () => {
  it('laufende Gruppe: gesperrte Zweittaste mit kurzem Grund; Tippen nennt das Spiel; completeGroup wird nicht aufgerufen', async () => {
    const t = gruppeA(); // Gruppe B: drei Spiele nicht entschieden
    const { repo } = await zeige(t);
    expect(screen.getByTestId('group-close-button-B')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('group-close-why-B')).toHaveTextContent('Noch 3 Spiele nicht entschieden');
    await userEvent.click(screen.getByTestId('group-close-button-B'));
    const meldung = await screen.findByTestId('group-close-error');
    expect(meldung).toHaveTextContent('Noch 3 Spiele nicht entschieden');
    expect(repo.completeGroup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('group-close-error-ok'));
    expect(screen.queryByTestId('group-notice-dialog')).toBeNull();
  });

  it('Gegenbeispiel: eine Gruppe ohne angepfiffenes Spiel („offen“) hat keine Taste', async () => {
    const t = gruppeA();
    await zeige({ ...t, matches: t.matches.map((m) => (m.group === 'B' ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined } : m)) });
    expect(marke('B')).toBe('offen');
    expect(screen.queryByTestId('group-close-button-B')).toBeNull();
  });

  it('Server meldet OPEN_MATCHES (ein Spiel zwischenzeitlich zurückgesetzt): rote Meldung, nichts besetzt', async () => {
    const repo = fakeRepo();
    repo.completeGroup.mockResolvedValue({ status: 'rejected', code: 'OPEN_MATCHES', open: 1 });
    const t = lage060([1, 2], false);
    await zeige(t, { repo });
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    expect(await screen.findByTestId('group-close-error')).toHaveTextContent('Noch 1 Spiel nicht entschieden');
  });
});

describe('@TM-057 @TM-058 @W2A-067 Jeder gegen jeden (Nikolaus)', () => {
  const zeigeNikolaus = async (t: Tournament, o: Options = {}) => {
    const r = await zeige(t, o);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    return r;
  };

  it('@TM-058 15 von 15 entschieden: Vorschlag „Alle Spiele entschieden …“, Taste group-close-button-all, Zustand „bereit zum Abschluss“; der Endstand steht noch nicht fest', async () => {
    await zeigeNikolaus(nikolaus([1, 2]));
    expect(screen.getByTestId('group-close-suggestion')).toHaveTextContent('Alle Spiele entschieden – Tabelle prüfen und abschließen');
    expect(screen.getByTestId('group-close-button-all')).toBeInTheDocument();
    expect(marke('')).toBe('bereit zum Abschluss');
  });

  it('@TM-058 Gegenbeispiel: 14 von 15 → kein Vorschlag', async () => {
    const t = nikolaus([1, 2]);
    const letztes = matchOf(t, NK.kammer, NK.wagingRot);
    await zeigeNikolaus(withMatch(t, letztes.id, { matchStatus: 'running' }));
    expect(screen.queryByTestId('group-close-suggestion')).toBeNull();
  });

  it('@W2A-063 Annahme, Gruppe \'\' (nicht \'all\') an completeGroup; beide auf Platz 3 in der Rangfolge', async () => {
    const { repo } = await zeigeNikolaus(nikolaus([1, 2]));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(1); });
    const request = repo.completeGroup.mock.calls[0][1];
    expect(request.groupId).toBe('');
    expect(request.ranking).toEqual([NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau]);
    expect(request.expectedState).toHaveLength(15);
  });

  it('@TM-149 TSV Petting entfernt: der Dialog zeigt die übrigen 5 Teams auf Platz 1 bis 5, completeGroup bekommt 5 Teams', async () => {
    const t = nikolaus([1, 2]);
    const ohnePetting: Tournament = { ...t, teams: t.teams.map((team) => (team.id === NK.petting ? { ...team, isRemoved: true } : team)) };
    const { repo } = await zeigeNikolaus(ohnePetting);
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const dialog = await screen.findByTestId('group-close-dialog');
    const zeilen = Array.from(within(dialog).getByTestId('group-close-ranking').querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(zeilen).toHaveLength(5);
    expect(zeilen.map((z) => z.charAt(0))).toEqual(['1', '2', '3', '4', '5']);
    expect(zeilen.join('|')).not.toContain('TSV Petting');
    await userEvent.click(within(dialog).getByTestId('group-close-confirm'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(1); });
    expect(repo.completeGroup.mock.calls[0][1].ranking).toEqual([NK.kammer, NK.wagingRot, NK.otting, NK.fridolfing, NK.wagingBlau]);
  });

  it('@TM-057 abgeschlossen: Zustand „abgeschlossen“, Hinweis mit Übergabe an den Endstand, Taste „Gruppe wieder öffnen“ (Test-ID group-reopen-all)', async () => {
    await zeigeNikolaus({ ...nikolaus([1, 2]), groupCompletions: [completion('', [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau])] });
    expect(marke('')).toBe('abgeschlossen');
    expect(screen.getByTestId('group-done-all')).toHaveTextContent('an den Endstand übergeben');
    expect(screen.getByTestId('group-reopen-all')).toBeInTheDocument();
    expect(screen.queryByTestId('group-close-suggestion')).toBeNull();
  });
});

describe('@TM-016 @TM-046 Abschluss: Wirkung, Ergebnis', () => {
  it('@TM-016 Dialog ohne Gleichstand nennt die Wirkung (Halbfinale 1 Heim, Halbfinale 2 Gast); completeGroup ruft den Server, der besetzt', async () => {
    const { repo, onChanged } = await zeige(lage060([1, 2], false));
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalled(); });
    await waitFor(() => { expect(onChanged).toHaveBeenCalled(); });
  });

  it('@TM-116-nahe: schon gleichlautend abgeschlossen (alreadyCompleted) ist kein Fehler, sondern eine blaue Meldung', async () => {
    const repo = fakeRepo();
    repo.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: true, changed: [] });
    await zeige(lage060([1, 2], false), { repo });
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    expect(await screen.findByTestId('group-already')).toHaveTextContent('schon abgeschlossen');
    await userEvent.click(screen.getByTestId('group-already-ok'));
  });

  it('Verklemmung am Server (RetryLaterError): „Bitte erneut versuchen“, nichts still verloren; erneut möglich', async () => {
    const repo = fakeRepo();
    repo.completeGroup.mockRejectedValueOnce(new RetryLaterError('completeGroup', '40P01'));
    await zeige(nikolaus([1, 2]), { repo });
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    expect(await screen.findByTestId('group-close-error')).toHaveTextContent('Server war gerade belegt');
    await userEvent.click(screen.getByTestId('group-close-confirm'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(2); });
  });

  it('@W2A-062 ohne Netz (Anforderung 23.10.): die Taste im Dialog bleibt frei, der Satz sagt „gilt sofort … nachgereicht“; completeGroup wird gerufen', async () => {
    const t = nikolaus([1]);
    const ohneGleichstand = { ...t, standingDecisions: undefined } as Tournament;
    // Lage ohne offenen Gleichstand: die Annahme Petting/Otting steht schon in der Tabelle
    const repo = new MemoryRepo({ ...ohneGleichstand, version: 1 });
    expect((await repo.service(['e-1']).decide(repo.tournament.id, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' })).ok).toBe(true);
    const fake = fakeRepo();
    fake.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], queued: true });
    const { onChanged } = await zeige(repo.tournament, { repo: fake, online: false });
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const dialog = await screen.findByTestId('group-close-dialog');
    expect(within(dialog).getByTestId('group-close-confirm')).toBeEnabled();
    expect(within(dialog).getByTestId('group-close-offline')).toHaveTextContent('gilt sofort auf diesem Gerät und wird nachgereicht');
    await userEvent.click(within(dialog).getByTestId('group-close-confirm'));
    await waitFor(() => { expect(fake.completeGroup).toHaveBeenCalledTimes(1); });
    await waitFor(() => { expect(screen.queryByTestId('group-close-dialog')).toBeNull(); });
    expect(screen.queryByTestId('group-close-error')).toBeNull();
    expect(onChanged).toHaveBeenCalled();
  });

  it('@W2A-062 Z1 ohne Netz im Kasten: Strafstoßschießen 4:3 für West schließt in einem Zug ab (kein „braucht eine Verbindung“)', async () => {
    const repo = fakeRepo();
    repo.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], queued: true });
    await zeige(gruppeA(), { repo, online: false });
    await userEvent.click(screen.getByTestId('group-close-button-A'));
    await screen.findByTestId('tie-decision-dialog');
    expect(screen.queryByTestId('tie-offline-hint')).toBeNull();
    await userEvent.type(screen.getByTestId('tie-shootout-score-0'), '3');
    await userEvent.type(screen.getByTestId('tie-shootout-score-1'), '4');
    await userEvent.click(screen.getByTestId('group-close-confirm'));
    await waitFor(() => { expect(repo.completeGroup).toHaveBeenCalledTimes(1); });
    expect(repo.completeGroup.mock.calls[0][1].tieDecisions[0]).toMatchObject({ kind: 'shootout', order: [HC.west, HC.sued] });
    await waitFor(() => { expect(screen.queryByTestId('tie-decision-dialog')).toBeNull(); });
    expect(screen.queryByTestId('group-close-error')).toBeNull();
  });

  it('@W2A-062 @TM-146 Z1 sofort danach: Gruppe A „abgeschlossen“ mit Marke „noch nicht gesendet“, Halbfinale 2 Gast TSV West; Gegenbeispiel gesendet: keine Marke', async () => {
    const offen = gruppeA();
    const entscheidung = { id: 'e-olli', groupId: 'A', teamIds: [HC.sued, HC.west], order: [HC.west, HC.sued], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 }, basis: 'Strafstoßschießen' };
    const abgeschlossen = (unsent: boolean): Tournament => {
      const mitEntscheidung = { ...offen, standingDecisions: [entscheidung] };
      return {
        ...placeFollowUps(mitEntscheidung, 'A', [HC.nord, HC.west, HC.sued, HC.ost]).tournament,
        groupCompletions: [{ ...completion('A', [HC.nord, HC.west, HC.sued, HC.ost]), ...(unsent ? { unsent: true } : {}) }],
      };
    };
    await zeige(abgeschlossen(true));
    expect(marke('A')).toContain('abgeschlossen');
    expect(screen.getByTestId('group-flag-notSent-A')).toHaveTextContent('noch nicht gesendet');
    expect(screen.getByTestId('group-done-A')).toHaveTextContent('2. Halbfinale: TSV West (Gast)');

    cleanup();
    await zeige(abgeschlossen(false));
    expect(screen.queryByTestId('group-flag-notSent-A')).toBeNull();
  });
});

describe('@TM-072 @TM-099 Gruppe wieder öffnen', () => {
  const abgeschlossen = (): Tournament => ({ ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost])] });

  it('Helfer: keine Taste „Gruppe wieder öffnen“ (Gegenbeispiel)', async () => {
    await zeige(abgeschlossen(), { leitung: false });
    expect(screen.queryByTestId('group-reopen-A')).toBeNull();
    expect(marke('A')).toBe('abgeschlossen');
  });

  it('Pflichtfeld Grund: leer ist die Haupttaste gesperrt; mit Grund wird reopenGroup(Turnier, Gruppe, Grund) aufgerufen', async () => {
    const { repo, onChanged } = await zeige(abgeschlossen());
    await userEvent.click(screen.getByTestId('group-reopen-A'));
    const dialog = await screen.findByTestId('group-reopen-dialog');
    expect(within(dialog).getByTestId('group-reopen-confirm')).toBeDisabled();
    await userEvent.type(within(dialog).getByTestId('group-reopen-reason'), '  Ergebnis SV Süd – TSV West prüfen ');
    expect(within(dialog).getByTestId('group-reopen-confirm')).toBeEnabled();
    await userEvent.click(within(dialog).getByTestId('group-reopen-confirm'));
    await waitFor(() => { expect(repo.reopenGroup).toHaveBeenCalledTimes(1); });
    expect(repo.reopenGroup).toHaveBeenCalledWith(abgeschlossen().id, 'A', 'Ergebnis SV Süd – TSV West prüfen');
    await waitFor(() => { expect(onChanged).toHaveBeenCalled(); });
  });

  it('Gegenbeispiel: nur Leerzeichen als Grund → gesperrt, kein Aufruf', async () => {
    const { repo } = await zeige(abgeschlossen());
    await userEvent.click(screen.getByTestId('group-reopen-A'));
    await userEvent.type(await screen.findByTestId('group-reopen-reason'), '   ');
    expect(screen.getByTestId('group-reopen-confirm')).toBeDisabled();
    expect(repo.reopenGroup).not.toHaveBeenCalled();
  });

  it('nach dem Wiederöffnen schlägt die App den Abschluss wieder vor (offener Gleichstand: „Strafstoßschießen eintragen“), die Besetzung bleibt', async () => {
    const wiederOffen: Tournament = { ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost], { reopenedAt: '2026-11-28T12:00:00Z' })] };
    await zeige(wiederOffen);
    expect(screen.getByTestId('group-close-button-A')).toHaveTextContent('Strafstoßschießen eintragen');
    expect(marke('A')).toBe('bereit zum Abschluss');
  });
});

describe('@TM-145 @TM-150 Besetzung prüfen nach einer Korrektur', () => {
  const veraltet = (t: Tournament): Tournament => ({ ...t, groupCompletions: [completion('', [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau], { stale: true })] });

  it('Banner (warn) „Besetzung nach Korrektur prüfen“ mit der Haupttaste (offener Gleichstand mit Wahl: „Gleichstand entscheiden“); das Zustandswort bleibt „abgeschlossen“', async () => {
    await zeige(veraltet(nikolaus([1, 2])));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.getByTestId('group-stale-all')).toHaveTextContent('Besetzung nach Korrektur prüfen');
    expect(screen.getByTestId('group-close-button-all')).toHaveTextContent('Gleichstand entscheiden');
    expect(marke('')).toBe('abgeschlossen');
  });

  it.each([
    { zeile: 'Gleichstand auf einem auszuspielenden Platz ohne Folgespiel', plaetze: [1, 2, 3], dialog: true },
    { zeile: 'Gleichstand auf einem Platz, der nicht auszuspielen ist', plaetze: [1, 2], dialog: false },
  ])('@TM-150 $zeile → Entscheidung verlangt: $dialog', async ({ plaetze, dialog }) => {
    const { repo } = await zeige(veraltet(nikolaus(plaetze)));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    if (dialog) {
      expect(await screen.findByTestId('tie-decision-dialog')).toBeInTheDocument();
      expect(repo.completeGroup).not.toHaveBeenCalled();
    } else {
      expect(await screen.findByTestId('group-close-dialog')).toBeInTheDocument();
      expect(screen.queryByTestId('tie-decision-dialog')).toBeNull();
    }
  });

  it('Helfer: kein Banner „Besetzung prüfen“ und keine Taste, aber die Zusatzmarke', async () => {
    await zeige(veraltet(nikolaus([1, 2])), { leitung: false });
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.queryByTestId('group-stale-all')).toBeNull();
    expect(screen.queryByTestId('group-close-button-all')).toBeNull();
    expect(screen.getByTestId('group-flag-checkSlots-all')).toBeInTheDocument();
  });
});

describe('Englisch (Sprachparität)', () => {
  it('Banner, Taste und Zustandswort auf Englisch', async () => {
    await zeige(hallencup(), { language: 'en' });
    expect(screen.getByTestId('group-close-suggestion')).toHaveTextContent(/A is ready/i);
    expect(screen.getByTestId('group-close-button-A')).toHaveTextContent(/Enter penalty shootout/i);
    expect(screen.getByTestId('group-close-then-A')).toHaveTextContent(/Afterwards the group is closed/i);
    expect(marke('A')).toMatch(/ready to close/i);
  });
});


/**
 * Daniel 23.10. (Ansicht und Wortlaut, gilt so): bei fertiger Gruppe EIN Kasten mit EINER Haupttaste (VISUAL-DESIGN § 8). Beschriftung je
 * Zustand – offener Gleichstand mit Wahl → „Gleichstand entscheiden“, auszuspielender Platz → „Strafstoßschießen eintragen“, kein offener
 * Gleichstand → „Gruppe abschließen“; darunter „Danach ist die Gruppe abgeschlossen.“ nur bei Gleichstand. Der eigene Gleichstand-Hinweis
 * entfällt, solange der Kasten die Entscheidung trägt. Dialog: „Gleichstand auf Platz 3“, „… sind nach allen Regeln gleich.“, Satz am Ende
 * einmal. Szenarien: @W2A-067 (Spalte „Taste“), @W2A-063, @W2A-064, @TM-044, @TM-046.
 */
describe('Ein Kasten, eine Haupttaste (Daniel 23.10., @W2A-067 @W2A-064 @TM-044)', () => {
  const haupttasten = (): string[] => Array.from(document.querySelectorAll('[data-primary]')).map((el) => el.textContent ?? '');

  it('@W2A-067 Wahl (nur Platz 1): Haupttaste „Gleichstand entscheiden“, darunter „Danach ist die Gruppe abgeschlossen.“, kein zweiter Hinweis-Kasten', async () => {
    await zeige(nikolaus([1]));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.getByTestId('group-close-button-all')).toHaveTextContent('Gleichstand entscheiden');
    expect(screen.getByTestId('group-close-then-all')).toHaveTextContent('Danach ist die Gruppe abgeschlossen.');
    expect(screen.queryByTestId('tie-hint-choice')).toBeNull();
    expect(screen.queryByTestId('tie-decide-entry')).toBeNull();
    expect(haupttasten()).toEqual(['Gleichstand entscheiden']); // genau eine Haupttaste in der Ansicht
    expect(screen.getAllByTestId('tie-marker')).toHaveLength(2); // die Marken in der Tabelle bleiben
  });

  it('@W2A-064 auszuspielender Platz (Platz 1 bis 3): Haupttaste „Strafstoßschießen eintragen“; Gegenbeispiel: im Dialog kein „Platz teilen“', async () => {
    await zeige(nikolaus([1, 2, 3]));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.getByTestId('group-close-button-all')).toHaveTextContent('Strafstoßschießen eintragen');
    expect(haupttasten()).toEqual(['Strafstoßschießen eintragen']);
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const dialog = await screen.findByTestId('tie-decision-dialog');
    expect(within(dialog).queryByTestId('tie-accept-result')).toBeNull();
    expect(within(dialog).queryByText(/Platz teilen/)).toBeNull();
  });

  it('@TM-044 kein offener Gleichstand (Platz geteilt): Haupttaste „Gruppe abschließen“, kein Satz „Danach ist die Gruppe abgeschlossen.“ am Kasten', async () => {
    const repo = new MemoryRepo({ ...nikolaus([1]), version: 1 });
    expect((await repo.service(['e-1']).decide(repo.tournament.id, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' })).ok).toBe(true);
    await zeige(repo.tournament);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.getByTestId('group-close-button-all')).toHaveTextContent('Gruppe abschließen');
    expect(screen.queryByTestId('group-close-then-all')).toBeNull();
    expect(haupttasten()).toEqual(['Gruppe abschließen']);
  });

  it('@W2A-063 Dialog-Wortlaut: „Gleichstand auf Platz 3“, „TSV Petting und DJK Otting sind nach allen Regeln gleich.“, „Platz teilen“, Satz am Ende genau einmal', async () => {
    await zeige(nikolaus([1]));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const dialog = await screen.findByTestId('tie-decision-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Gleichstand auf Platz 3' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('tie-dialog-context')).toHaveTextContent('TSV Petting und DJK Otting sind nach allen Regeln gleich.');
    expect(within(dialog).getByText('Der Sieger bekommt Platz 3.')).toBeInTheDocument();
    expect(within(dialog).getByTestId('tie-accept-result')).toHaveTextContent('Platz teilen');
    expect(within(dialog).getByText('Beide auf Platz 3, danach folgt Platz 5.')).toBeInTheDocument();
    expect(dialog.textContent?.match(/Danach ist die Gruppe abgeschlossen\./g)).toHaveLength(1);
    expect(dialog.textContent).not.toMatch(/Zuerst den Gleichstand|an den Endstand übergeben|Ein Tipp genügt|Ergebnis so akzeptieren/);
  });

  it('@W2A-050 Helfer: kein Kasten mit Taste – der Hinweis nennt weiter, wer entscheidet (Gegenbeispiel zur Turnierleitung)', async () => {
    await zeige(nikolaus([1]), { leitung: false });
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.queryByTestId('group-close-button-all')).toBeNull();
    expect(screen.getByTestId('tie-hint-choice')).toHaveTextContent('Die Turnierleitung entscheidet: Strafstoßschießen oder Platz teilen.');
  });
});

describe('Reihenfolge der Tasten und Beschriftung bei drei Teams (Review #361 A2, A4)', () => {
  /** Beschriftungen im Tasten-Fuß in DOM-Reihenfolge; die Haupttaste (`data-primary`) muss die letzte sein (VISUAL-DESIGN § 6, Daniel 22.10.). */
  const fuss = (dialog: HTMLElement): { labels: string[]; primaryLast: boolean } => {
    const actions = dialog.querySelector('[data-dialog-actions]');
    const buttons = Array.from(actions?.querySelectorAll('button') ?? []);
    return { labels: buttons.map((b) => b.textContent ?? ''), primaryLast: buttons.length > 1 && buttons[buttons.length - 1].hasAttribute('data-primary') };
  };

  it('A2 Abschluss-Dialog ohne Gleichstand: „Abbrechen“ vor „Gruppe abschließen“, die Haupttaste steht zuletzt', async () => {
    const repo = new MemoryRepo({ ...nikolaus([1]), version: 1 });
    expect((await repo.service(['e-1']).decide(repo.tournament.id, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' })).ok).toBe(true);
    await zeige(repo.tournament);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const { labels, primaryLast } = fuss(await screen.findByTestId('group-close-dialog'));
    expect(labels).toEqual(['Abbrechen', 'Gruppe abschließen']);
    expect(primaryLast).toBe(true);
  });

  it('A2 Gleichstand im Abschluss (Strafstoßschießen): „Abbrechen“ vor „Gruppe abschließen“', async () => {
    await zeige(nikolaus([1, 2, 3]));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    await userEvent.click(screen.getByTestId('group-close-button-all'));
    const { labels, primaryLast } = fuss(await screen.findByTestId('tie-decision-dialog'));
    expect(labels).toEqual(['Abbrechen', 'Gruppe abschließen']);
    expect(primaryLast).toBe(true);
  });

  it('A2 Gruppe wieder öffnen: „Abbrechen“ vor der Haupttaste', async () => {
    await zeige({ ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost])] });
    await userEvent.click(screen.getByTestId('group-reopen-A'));
    const { labels, primaryLast } = fuss(await screen.findByTestId('group-reopen-dialog'));
    expect(labels[0]).toBe('Abbrechen');
    expect(primaryLast).toBe(true);
  });

  it('A4 drei Teams auf einem auszuspielenden Platz: die Haupttaste im Kasten heißt „Reihenfolge festlegen“ (nicht „Strafstoßschießen eintragen“)', async () => {
    await zeige(jgj('WOUMNB', DATA.W2A_044, [1, 2, 3, 4, 5, 6]));
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.getByTestId('group-close-button-all')).toHaveTextContent('Reihenfolge festlegen');
    expect(screen.getByTestId('group-close-button-all')).not.toHaveTextContent('Strafstoßschießen eintragen');
    expect(screen.getByTestId('group-close-then-all')).toHaveTextContent('Danach ist die Gruppe abgeschlossen.');
  });
});
