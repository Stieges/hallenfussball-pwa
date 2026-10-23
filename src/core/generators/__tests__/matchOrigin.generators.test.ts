/**
 * A-36a (MVP-Bauplan § 23, Brief Schritt 1): Herkunft des PLATZES als eigenes Feld am Spiel.
 *
 * Der Generator setzt `originA/originB` beim Anlegen aus derselben Definition wie die Slots
 * (`def.teamASource/teamBSource`). Anders als `slotA.source` bleibt die Herkunft nach dem Besetzen
 * am Spiel – Grundlage für die Vorlage zum Ausfüllen (@DR-005), die kleine Herkunftszeile (@BM-014)
 * und „Spielplan auf Anfang“ (@SA-011).
 */
import { describe, it, expect } from 'vitest';
import { generateGroupPhaseSchedule, generatePlayoffDefinitions, generatePlayoffSchedule } from '../index';
import type { Match, Team } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';

function createTeams(n: number, group: string, offset: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: testUuid(offset + i), name: `FC Nord ${group}${i + 1}`, group }));
}

function playoffs(): Match[] {
  return generatePlayoffSchedule({
    playoffDefinitions: generatePlayoffDefinitions(2, { preset: 'top-4' }),
    numberOfFields: 2,
    slotDurationMinutes: 10,
    breakBetweenSlotsMinutes: 2,
    minRestSlotsPerTeam: 1,
    startSlot: 10,
    startTime: new Date('2026-10-23T09:00:00'),
  });
}

function byLabel(matches: Match[], label: string): Match {
  const match = matches.find((m) => m.label === label);
  if (!match) {
    throw new Error(`Spiel „${label}“ fehlt`);
  }
  return match;
}

describe('A-36a Generator: Herkunft des Platzes am Spiel', () => {
  it('@DR-005 2 Gruppen à 4: HF1 trägt originA = Erster A, originB = Zweiter B; Finale originA = Sieger HF1', () => {
    const matches = playoffs();
    const hf1 = byLabel(matches, '1. Halbfinale');
    const final = matches.find((m) => m.finalType === 'final');

    expect(hf1.originA).toEqual({ kind: 'groupRank', group: 'A', rank: 1 });
    expect(hf1.originB).toEqual({ kind: 'groupRank', group: 'B', rank: 2 });
    expect(final?.originA).toEqual({ kind: 'matchResult', matchId: hf1.id, role: 'winner' });
  });

  it('@DR-005 Herkunft des Platzes = Herkunft des offenen Slots beim Anlegen (jedes Finalrundenspiel)', () => {
    for (const m of playoffs()) {
      expect(m.slotA.kind === 'pending' ? m.slotA.source : undefined).toEqual(m.originA);
      expect(m.slotB.kind === 'pending' ? m.slotB.source : undefined).toEqual(m.originB);
    }
  });

  it('Gegenbeispiel: Gruppenspiele haben keine Herkunft des Platzes', () => {
    const teamsA = createTeams(4, 'A', 1);
    const teamsB = createTeams(4, 'B', 11);
    const groupMatches = generateGroupPhaseSchedule({
      groups: new Map([['A', teamsA], ['B', teamsB]]),
      numberOfFields: 2,
      slotDurationMinutes: 10,
      breakBetweenSlotsMinutes: 2,
      minRestSlotsPerTeam: 1,
      startTime: new Date('2026-10-23T09:00:00'),
    });
    expect(groupMatches.length).toBeGreaterThan(0);
    for (const m of groupMatches) {
      expect(m.originA).toBeUndefined();
      expect(m.originB).toBeUndefined();
      expect('originA' in m).toBe(false);
    }
  });
});
