/**
 * B-16d1 – Gegenbeispiele zu matchSides (Spec § 2 Nr. 9): Seite A/B, unbekanntes Team.
 * B-16f2 – Herkunft offener Plätze an einer Stelle: Herkunft lesbar, Kindermodus „noch offen“.
 * A-36c – die Seiten kommen fertig aus der gemeinsamen Ansicht (`MatchView.home/away`); am Monitor kommt nur das
 * Vereinskürzel nach Liste dazu (@ZM-087).
 *
 * Merge main → Spur B (I1): Die Seiten kommen aus dem Slot. Ein Team wird nur über die ID gefunden
 * (keine Namenssuche mehr, A-03/slotLabel); eine unbekannte ID zeigt `slot.unknown` statt des Rohwerts.
 */
import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import type { SideView } from '../../../core/view';
import { monitorSideLabel, sideTeam } from '../matchSides';
import { buildMonitorView } from '../monitorView';
import { buildTournament, FIXTURE_MATCHES, FIXTURE_TEAMS } from './monitorFixture';
import { groupRank, looseVs, resultOf, slots, testUuid } from '../../../test/matchSlotFixtures';

const spiel: Match = { ...FIXTURE_MATCHES[0], ...looseVs('team-nord', 'team-sued') };

/** Die Seiten des Spiels in der Ansicht des Monitors (mit weiteren Spielen für Vorgänger). */
function seiten(match: Match, over: Partial<Tournament> = {}, others: Match[] = []): { a: SideView; b: SideView } {
  const view = buildMonitorView(buildTournament({ matches: [match, ...others], ...over }));
  const shown = view.byId.get(match.id);
  if (!shown) { throw new Error('Spiel fehlt in der Ansicht'); }
  return { a: shown.home, b: shown.away };
}

describe('matchSides (B-16d1)', () => {
  it('Team wird über die ID im Slot gefunden', () => {
    const { a, b } = seiten(spiel);
    expect(monitorSideLabel(a)).toBe('FC Nord');
    expect(monitorSideLabel(b)).toBe('SV Süd');
    expect(sideTeam(b, FIXTURE_TEAMS)?.id).toBe('team-sued');
  });

  it('unbekannte ID: Anzeige slot.unknown (nie der Rohwert)', () => {
    const unbekannt: Match = { ...spiel, ...looseVs('team-weg', 'team-sued') };
    const { a } = seiten(unbekannt);
    expect(monitorSideLabel(a)).toBe('tournament:slot.unknown');
    expect(monitorSideLabel(a)).not.toBe('team-weg');
  });

  it('Gegenbeispiel: ein Teamname im Slot findet kein Team (keine Namenssuche)', () => {
    const perName: Match = { ...spiel, ...looseVs('FC Nord', 'team-sued') };
    expect(sideTeam(seiten(perName).a, FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Seite B liefert nie Team A', () => {
    const { b } = seiten(spiel);
    expect(monitorSideLabel(b)).not.toBe('FC Nord');
    expect(sideTeam(b, FIXTURE_TEAMS)?.id).not.toBe('team-nord');
  });
});

describe('matchSides – Herkunft offener Plätze (B-16f2, @TM-015)', () => {
  const offen: Match = { ...spiel, ...slots(groupRank('A', 1), groupRank('B', 2)) };

  it('ohne Kindermodus: Herkunft über den Schlüssel slot.groupRank', () => {
    const { a } = seiten(offen);
    expect(monitorSideLabel(a)).toBe('tournament:slot.groupRank');
    expect(sideTeam(a, FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Sieger eines Spiels braucht die Spiele im Kontext (sonst slot.unknown)', () => {
    const hf1: Match = { ...spiel, id: testUuid(901), label: '1. Halbfinale' };
    const finale: Match = { ...spiel, id: testUuid(902), ...slots(resultOf(hf1.id, 'winner'), resultOf(hf1.id, 'loser')) };
    expect(monitorSideLabel(seiten(finale, {}, [hf1]).a)).toBe('tournament:slot.winnerOf');
    expect(monitorSideLabel(seiten(finale).a)).toBe('tournament:slot.unknown');
  });

  it('Kindermodus: offener Platz zeigt tournament:slot.undecided, nie die Herkunft', () => {
    const { a } = seiten(offen, { hideScoresForPublic: true });
    expect(monitorSideLabel(a)).toBe('tournament:slot.undecided');
    expect(monitorSideLabel(a)).not.toBe('tournament:slot.groupRank');
  });

  it('@ZM-102 „Gruppentabellen aus“: der Gruppenrang bleibt verborgen, auch ohne Kindermodus', () => {
    const { a } = seiten(offen, { hideRankingsForPublic: true });
    expect(monitorSideLabel(a)).toBe('tournament:slot.undecided');
  });

  it('Kindermodus ändert nichts an einem Team', () => {
    expect(monitorSideLabel(seiten(spiel, { hideScoresForPublic: true }).a)).toBe('FC Nord');
  });
});
