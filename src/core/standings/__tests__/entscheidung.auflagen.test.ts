/**
 * Paket TB, Auflagen aus dem Review TB-A (`review-tb-a.md`): Gruppenkennung der Entscheidung (Auflage 1, Fall F des
 * Reviewers), Testlücken MR1/MR2/MR3 (Auflage 2) und Fingerabdruck mit nachträglich „nicht ausgetragen“ (Auflage 6, MR7).
 * Daten: Fall D/E des Reviewers (von ihm und hier unabhängig gegengerechnet), Abschnitt 6 (@W2A-047, @W2A-048), @ET-029-Daten.
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../tournamentTable';
import { validateDraft } from '../validateDraft';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import type { Match, Standing, Tournament } from '../../../types/tournament';
import { BFV_ORDER, DATA, id, league, names, NAME, parseMatches, POINTS_310, teamsOf, type Key } from './fixtures';
import { jgj, MemoryRepo, shared, shootout } from './decisionTestKit';

const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

/** Fall D des Reviewers: West – Ost „nicht ausgetragen“ → West und Ost gleich auf Platz 2 (alle Spiele entschieden). */
const FALL_D = 'W–O 0:3; W–U 3:1; W–M 1:3; W–N 2:0; W–B 1:1; O–U 3:1; O–M 0:2; O–N 1:1; O–B 3:1; U–M 3:3; U–N 3:0; U–B 2:1; M–N 3:1; M–B 0:2; N–B 0:0';
/** Fall E des Reviewers: Nord, Ost, Mitte je 8, Sondertabelle nur Remis – Nord hat dort die meisten Tore. */
const FALL_E = 'W–O 2:1; W–U 1:1; W–M 0:1; W–N 2:0; W–B 0:2; O–U 1:0; O–M 1:1; O–N 2:2; O–B 2:1; U–M 2:1; U–N 0:1; U–B 2:1; M–N 2:2; M–B 2:1; N–B 1:0';
/** @ET-029-Daten: Nord und Ufer gleich auf 2 und 3, direktes Spiel 1:1. */
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

/** Eine einzige Buchstabengruppe „A“ (Fall F) mit einem Spiel, dessen Herkunft „Zweiter Gruppe A“ ist. */
function eineGruppeA(): Tournament {
  const f = league('WOUMNB', FALL_D, { skipped: ['W–O'], group: 'A' });
  const finale: Match = { id: 'finale', round: 16, field: 1, isFinal: true, phase: 'final', label: 'Finale', ...slots(groupRank('A', 1), groupRank('A', 2)) };
  return { ...f.tournament, matches: [...f.matches, finale], version: 1 };
}

/** @W2A-048-Gruppe A (Süd/West gleich auf 2 und 3) – Folgespiel nur für „Dritter Gruppe A“ (Spiel um Platz 5). */
function nurDritterMitFolgespiel(): Tournament {
  const finals: Match[] = [
    { id: 'finale', round: 7, field: 1, isFinal: true, phase: 'final', label: 'Finale', ...slots(groupRank('A', 1), groupRank('B', 1)) },
    { id: 'platz-5', round: 7, field: 2, isFinal: true, phase: 'placement', label: 'Spiel um Platz 5', ...slots(groupRank('A', 3), groupRank('B', 3)) },
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWO', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...parseMatches(DATA.W2A_048_A, { group: 'A', idPrefix: 'a' }), ...parseMatches('M–B 2:0; M–U 2:0; M–T 2:0; B–U 2:1; B–T 1:0; U–T 1:0', { group: 'B', idPrefix: 'b' }), ...finals],
    pointSystem: POINTS_310, placementLogic: BFV_ORDER, groupSystem: 'groupsAndFinals', version: 1,
  });
}

describe('Auflagen TB-A', () => {
  it('@W2A-060 Auflage 1 (Fall F): eine Gruppe „A“, Eintrag mit leerer Kennung – gespeichert unter „A“, wirksam, zweiter Eintrag ALREADY_DECIDED', async () => {
    const repo = new MemoryRepo(eineGruppeA());
    expect([row(rankTournamentGroup(repo.tournament, 'A').rows, 'W').decisionNeeded]).toEqual([true]);

    const erst = await repo.service(['e-1']).decide(repo.tournament.id, shootout('O', 'W', 4, 3, ''));
    expect(erst.ok).toBe(true);
    expect(repo.tournament.standingDecisions?.map((d) => d.groupId)).toEqual(['A']);
    const rows = rankTournamentGroup(repo.tournament, 'A').rows;
    expect(names(rows).slice(1, 3)).toEqual([NAME.O, NAME.W]);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);

    for (const gruppe of ['', 'A']) {
      expect(await repo.service().decide(repo.tournament.id, shootout('W', 'O', 5, 4, gruppe)))
        .toEqual({ ok: false, code: 'ALREADY_DECIDED' }); // „von wem“: Verlaufsprotokoll (GA4 A-13b), C-ENTSCHEIDUNG-PERSON-OEFFENTLICH
    }
    expect(repo.writes).toBe(1);
  });

  it('@W2A-064 Auflage 1 (Fall F): „Ergebnis so akzeptieren“ mit leerer Kennung bei Platz mit Herkunft „Zweiter Gruppe A“ → SHARED_PLACE_NOT_ALLOWED', async () => {
    const repo = new MemoryRepo(eineGruppeA());
    expect(validateDraft(shared(['W', 'O'], ''), repo.tournament)).toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    expect(await repo.service().decide(repo.tournament.id, shared(['W', 'O'], '')))
      .toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    expect(repo.writes).toBe(0);
    // Gegenbeispiel: eine abweichende Gruppe („B“ gibt es nicht) passt zu keinem offenen Block.
    expect(validateDraft(shootout('O', 'W', 4, 3, 'B'), repo.tournament)).toEqual({ ok: false, code: 'BLOCK_CHANGED' });
  });

  it('@W2A-002 die Tore der Sondertabelle entscheiden vor der Tordifferenz aller Gruppenspiele (Nord vor Ost und Mitte)', () => {
    const { rows } = rankTournamentGroup(jgj('WOUMNB', FALL_E), '');
    expect(rows.slice(0, 3).map((r) => r.points)).toEqual([8, 8, 8]);
    expect(names(rows)[0]).toBe(NAME.N);
    // Gegenbeispiel: Nord hat die schlechtere Gesamt-Tordifferenz (0 gegen +1) und steht trotzdem vorn.
    expect(row(rows, 'N').goalDifference).toBeLessThan(row(rows, 'O').goalDifference);
    expect([row(rows, 'O').place, row(rows, 'M').place, row(rows, 'W').place, row(rows, 'U').place]).toEqual([2, 2, 4, 4]);
  });

  it('@W2A-047 mitten in der Gruppe nimmt die App keine Entscheidung an (BLOCK_CHANGED), nach dem letzten Spiel schon', async () => {
    const offen = new MemoryRepo({ ...league('RKMUNO', DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }).tournament, version: 1 });
    expect([row(rankTournamentGroup(offen.tournament, '').rows, 'R').place, row(rankTournamentGroup(offen.tournament, '').rows, 'K').place]).toEqual([2, 2]);
    expect(await offen.service().decide(offen.tournament.id, shootout('K', 'R', 4, 3))).toEqual({ ok: false, code: 'BLOCK_CHANGED' });
    expect(offen.writes).toBe(0);
    // Gegenbeispiel: alle Spiele entschieden → angenommen.
    const fertig = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    expect((await fertig.service().decide(fertig.tournament.id, shootout('K', 'R', 4, 3))).ok).toBe(true);
  });

  it('@W2A-064 Folgespiel nur auf dem letzten Platz des Blocks („Dritter Gruppe A“): kein „Ergebnis so akzeptieren“', async () => {
    const repo = new MemoryRepo(nurDritterMitFolgespiel());
    const rows = rankTournamentGroup(repo.tournament, 'A').rows;
    expect([row(rows, 'S').place, row(rows, 'W').place]).toEqual([2, 2]);
    expect(await repo.service().decide(repo.tournament.id, shared(['S', 'W'], 'A')))
      .toEqual({ ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' });
    expect(repo.writes).toBe(0);
  });

  it('@W2A-005 wird ein Spiel des Blocks nachträglich „nicht ausgetragen“ (Stand bleibt stehen), verfällt die Entscheidung', async () => {
    const repo = new MemoryRepo(jgj('MNUWOB', DATEN_029));
    expect((await repo.service(['e-nord']).decide(repo.tournament.id, shootout('N', 'U', 4, 3))).ok).toBe(true);
    expect(rankTournamentGroup(repo.tournament, '').staleDecisionIds).toEqual([]);

    repo.tournament = {
      ...repo.tournament,
      matches: repo.tournament.matches.map((m) =>
        m.slotA.kind === 'team' && m.slotA.teamId === id('N') && m.slotB.kind === 'team' && m.slotB.teamId === id('U')
          ? { ...m, matchStatus: 'skipped' as const, skippedReason: 'Hallenzeit abgelaufen' } : m),
    };
    const result = rankTournamentGroup(repo.tournament, '');
    // Nord und Ufer bleiben gleich (je 9 Punkte, 3:1 Tore), die Grundlage hat sich aber geändert.
    expect([row(result.rows, 'N').points, row(result.rows, 'U').points]).toEqual([9, 9]);
    expect(result.staleDecisionIds).toEqual(['e-nord']);
    expect([row(result.rows, 'N').decisionNeeded, row(result.rows, 'U').decisionNeeded]).toEqual([true, true]);
  });
});
