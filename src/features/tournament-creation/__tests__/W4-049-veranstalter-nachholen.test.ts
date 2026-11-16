/**
 * @W4-049 Die Markierung lässt sich im schon veröffentlichten Turnier nachholen, solange kein Spiel begonnen hat.
 * Weg: Turnier bearbeiten → Neuplanung (`openReplan`) → Bestätigen → `publish`. Echter Generator, echter Dienst,
 * Speicher als Attrappe. Tests aus dem Gherkin des Records wizard-zeitrahmen-fairness.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Team, Tournament } from '../../../types/tournament';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import { matchSideTeamId } from '../../../core/models/matchSlot';
import { getMatchStartState } from '../../../utils/matchStartState';
import { getReplanAvailability, openReplan } from '../utils/replan';
import { testUuid } from '../../../test/testIds';

const NAMES = ['TSV Petting', 'SV Kirchanschöring', 'TSV Palling', 'DJK Otting', 'TSV Waging 1', 'TSV Waging 2'];
const TEAMS: Team[] = NAMES.map((name, i) => ({ id: testUuid(i + 1), name, colors: { primary: `#00${i}0${i}0` } }));
const [W1, W2] = [TEAMS[4].id, TEAMS[5].id];

function repo(previous: Tournament | null): { get: () => Promise<Tournament | null>; save: ReturnType<typeof vi.fn> } {
  return { get: () => Promise.resolve(previous), save: vi.fn().mockResolvedValue(undefined) };
}

/** Das veröffentlichte G-Turnier ohne Markierung, wie es auf Produktion liegt. */
async function veroeffentlicht(): Promise<Tournament> {
  const service = new TournamentCreationService(repo(null) as never);
  const t = await service.publish({
    id: testUuid(900), title: 'G-Jugend', ageClass: 'G', teams: TEAMS, numberOfTeams: 6, numberOfFields: 1,
    groupSystem: 'roundRobin', date: '2026-11-28', startTime: '10:00', groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    location: { name: 'Halle' }, isPublic: true, shareCode: 'G4ABCD', matches: [],
  });
  return t;
}

const homeOfMatch = (t: Tournament, index: number): string | undefined => matchSideTeamId(t.matches[index], 'A');

describe('@W4-049 Markierung im veröffentlichten Turnier nachholen', () => {
  it('Neuplanung mit Markierung eröffnet nach der gewählten Art; Turnier-ID, Zuschauer-Link, Teams, Farben und Einstellungen bleiben', async () => {
    const vorher = await veroeffentlicht();
    expect(vorher.shareCode).toBe('G4ABCD');
    expect(getReplanAvailability(vorher)).toBe('offered');

    const geaendert: Tournament = { ...vorher, hostTeamIds: [W1, W2], openingMode: 'both-home' };
    const session = openReplan(vorher, geaendert, getMatchStartState(vorher.matches, undefined, true));
    expect(session.preview.status).toBe('preview');
    const neu = session.confirm();
    const veroeffentlichtNeu = await new TournamentCreationService(repo(vorher) as never)
      .publish({ ...geaendert, matches: neu.matches });

    expect(homeOfMatch(veroeffentlichtNeu, 0)).toBe(W1);
    expect(homeOfMatch(veroeffentlichtNeu, 1)).toBe(W2);
    expect(veroeffentlichtNeu.id).toBe(vorher.id);
    expect(veroeffentlichtNeu.shareCode).toBe(vorher.shareCode);
    expect(veroeffentlichtNeu.publishedAt).toBe(vorher.publishedAt);
    expect(veroeffentlichtNeu.teams).toEqual(vorher.teams);
    for (const key of ['title', 'ageClass', 'date', 'startTime', 'numberOfFields', 'groupSystem', 'groupPhaseGameDuration', 'groupPhaseBreakDuration'] as const) {
      expect(veroeffentlichtNeu[key]).toEqual(vorher[key]);
    }
    expect(veroeffentlichtNeu.matches).toHaveLength(15);
    expect(veroeffentlichtNeu.hostTeamIds).toEqual([W1, W2]);
  });

  it('Gegenbeispiel: ohne Markierung bleibt die Neuplanung beim bisherigen Plan (gleiche Paarungen)', async () => {
    const vorher = await veroeffentlicht();
    const session = openReplan(vorher, { ...vorher }, 'not-started');
    const neu = session.confirm();

    expect(neu.matches.map((m) => `${matchSideTeamId(m, 'A')}-${matchSideTeamId(m, 'B')}`))
      .toEqual(vorher.matches.map((m) => `${matchSideTeamId(m, 'A')}-${matchSideTeamId(m, 'B')}`));
  });

  it('hat ein Spiel begonnen, wird die Neuplanung nicht angeboten und der Grund genannt', async () => {
    const vorher = await veroeffentlicht();
    const begonnen: Tournament = { ...vorher, matches: vorher.matches.map((m, i) => (i === 0 ? { ...m, matchStatus: 'running' as const } : m)) };

    expect(getReplanAvailability(begonnen)).toBe('refused-after-kickoff');
    const session = openReplan(begonnen, { ...begonnen, hostTeamIds: [W1, W2] }, getMatchStartState(begonnen.matches, undefined, true));
    expect(session.preview).toMatchObject({ status: 'refused', reasonKey: 'replan.reasonRefusedKickoff' });
    expect(session.confirm()).toBe(begonnen);
  });

  it('@W4-046 Die Vorschau (Neuplanung) zeigt denselben Plan, der beim Veröffentlichen gespeichert wird', async () => {
    const vorher = await veroeffentlicht();
    const geaendert: Tournament = { ...vorher, hostTeamIds: [W1, W2], openingMode: 'club-derby' };
    const session = openReplan(vorher, geaendert, 'not-started');
    if (session.preview.status !== 'preview') { throw new Error('keine Vorschau'); }
    const vorschau = session.preview.schedule.allMatches.map((m) => `${matchSideTeamId(m, 'A')}-${matchSideTeamId(m, 'B')}`);
    const gespeichert = await new TournamentCreationService(repo(vorher) as never)
      .publish({ ...geaendert, matches: session.confirm().matches });

    expect(gespeichert.matches.map((m) => `${matchSideTeamId(m, 'A')}-${matchSideTeamId(m, 'B')}`)).toEqual(vorschau);
    expect(homeOfMatch(gespeichert, 0)).toBe(W1);
    expect(matchSideTeamId(gespeichert.matches[0], 'B')).toBe(W2);
  });

  it.each([
    { zustand: 'läuft', aenderung: { matchStatus: 'running' as const } },
    { zustand: 'pausiert', aenderung: { matchStatus: 'paused' as const } },
    { zustand: 'beendet mit eingetragenem Ergebnis', aenderung: { matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 } },
  ])('Gegenbeispiel nach dem Anpfiff ($zustand): keine Neuplanung, Grund genannt, Bestätigen ändert nichts', async ({ aenderung }) => {
    const vorher = await veroeffentlicht();
    const begonnen: Tournament = { ...vorher, matches: vorher.matches.map((m, i) => (i === 3 ? { ...m, ...aenderung } : m)) };

    expect(getReplanAvailability(begonnen)).toBe('refused-after-kickoff');
    const session = openReplan(begonnen, { ...begonnen, hostTeamIds: [W1, W2] }, getMatchStartState(begonnen.matches, undefined, true));
    expect(session.preview).toMatchObject({ status: 'refused', reasonKey: 'replan.reasonRefusedKickoff' });
    expect(session.confirm()).toBe(begonnen);
  });
});
