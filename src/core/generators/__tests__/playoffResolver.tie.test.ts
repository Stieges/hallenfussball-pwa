/**
 * Paket TB, Task TB-5: Interim-Schutz der Finalrunde (Plan v2 R-TB-7) bis „Gruppe abschließen“ (GA4 A-13c).
 * Eine Gruppe mit offenem Gleichstand nach allen Kriterien besetzt keine Herkunft – nie still nach Eingabereihenfolge
 * (Befund C-FINALRUNDE-AUS-STILLEM-GLEICHSTAND). Record W2a @W2A-048 (Zeile „Halbfinale 1/2 zeigen weiter die Herkunft“)
 * und Turniermodi @TM-049 (Zeile „keine Herkunft aus Gruppe A ist besetzt“); die Besetzung über „Gruppe abschließen“
 * baut A-13. Daten: Plan v2 Abschnitt 6 (@W2A-048), Gruppe A „Hallencup Nord“ aus dem Record-Kopf.
 */
import { describe, expect, it } from 'vitest';
import { autoResolvePlayoffsIfReady } from '../playoffResolver';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import type { Match, Tournament } from '../../../types/tournament';
import type { MatchSlot } from '../../models/schemas/MatchSlotSchema';
import { BFV_ORDER, DATA, id, parseMatches, POINTS_310, teamsOf } from '../../standings/__tests__/fixtures';

const GRUPPE_B = 'M–B 2:0; M–U 2:0; M–T 2:0; B–U 2:1; B–T 1:0; U–T 1:0';
/** Gruppe A „Hallencup Nord“ (Record-Kopf): FC Nord 7, SV Süd 6, TSV West 4, SC Ost 0 – kein Gleichstand. */
const GRUPPE_A_ORIGINAL = 'N–S 2:1; N–W 1:1; N–O 3:0; S–W 2:1; S–O 2:0; W–O 3:1';

function turnier(gruppeA: string): Tournament {
  const semis: Match[] = [
    { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', label: 'Halbfinale 1', ...slots(groupRank('A', 1), groupRank('B', 2)) },
    { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', label: 'Halbfinale 2', ...slots(groupRank('B', 1), groupRank('A', 2)) },
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWO', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...parseMatches(gruppeA, { group: 'A', idPrefix: 'a' }), ...parseMatches(GRUPPE_B, { group: 'B', idPrefix: 'b' }), ...semis],
    pointSystem: POINTS_310,
    placementLogic: BFV_ORDER,
    groupSystem: 'groupsAndFinals',
  });
}

const seite = (t: Tournament, matchId: string, side: 'slotA' | 'slotB'): MatchSlot => {
  const match = t.matches.find((m) => m.id === matchId);
  if (match === undefined) { throw new Error(`Spiel ${matchId} fehlt`); }
  return match[side];
};

describe('TB-5 Interim-Schutz Finalrunde', () => {
  it('@W2A-048:teil @TM-049:teil C-FINALRUNDE-AUS-STILLEM-GLEICHSTAND offener Gleichstand in Gruppe A: keine Herkunft aus Gruppe A besetzt', () => {
    const t = turnier(DATA.W2A_048_A);
    autoResolvePlayoffsIfReady(t);

    // Halbfinale 1 zeigt weiter „Erster Gruppe A“, Halbfinale 2 weiter „Zweiter Gruppe A“.
    expect(seite(t, 'hf-1', 'slotA')).toEqual(groupRank('A', 1));
    expect(seite(t, 'hf-2', 'slotB')).toEqual(groupRank('A', 2));
    // Die Seiten aus Gruppe B werden besetzt (Alt-Verhalten bis A-13c): Zweiter B DJK Berg, Erster B SG Mitte.
    expect(seite(t, 'hf-1', 'slotB')).toMatchObject({ kind: 'team', teamId: id('B') });
    expect(seite(t, 'hf-2', 'slotA')).toMatchObject({ kind: 'team', teamId: id('M') });
  });

  it('@W2A-048:teil Gegenbeispiel „Hallencup Nord“ ohne Gleichstand: Gruppe A wird besetzt (FC Nord, SV Süd)', () => {
    const t = turnier(GRUPPE_A_ORIGINAL);
    autoResolvePlayoffsIfReady(t);

    expect(seite(t, 'hf-1', 'slotA')).toMatchObject({ kind: 'team', teamId: id('N') });
    expect(seite(t, 'hf-2', 'slotB')).toMatchObject({ kind: 'team', teamId: id('S') });
  });
});
