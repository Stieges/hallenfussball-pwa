import { describe, it, expect } from 'vitest';
import {
  generateGroupPhaseSchedule,
  scheduleGroupPhaseVariant,
  type GroupPhaseScheduleOptions,
} from '../fairScheduler';
import type { Team, Match } from '../../../types/tournament';

/**
 * B-42: Beste von 50 Gleichstands-Varianten, kein stiller Abbruch.
 * Szenarien: @W4-023 (Zeitfenster), @W4-024 (Einzelpause, Determinismus), @W4-025 (Abbruch).
 * Zeitraster der Szenarien: 10 min Spiel, 5 min Wechsel (15-min-Raster).
 */

const SLOT_MIN = 10;
const BREAK_MIN = 5;

function createTeams(n: number, group: string, prefix = 't'): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `Team ${prefix}${i}`,
    group,
    players: [],
  }));
}

function options(teamCount: number, fields: number, groupCount = 1, minRest = 1): GroupPhaseScheduleOptions {
  const groups = new Map<string, Team[]>();
  if (groupCount === 1) {
    groups.set('A', createTeams(teamCount, 'A'));
  } else {
    const half = Math.floor(teamCount / groupCount);
    groups.set('A', createTeams(half, 'A', 'a'));
    groups.set('B', createTeams(teamCount - half, 'B', 'b'));
  }
  return {
    groups,
    numberOfFields: fields,
    slotDurationMinutes: SLOT_MIN,
    breakBetweenSlotsMinutes: BREAK_MIN,
    minRestSlotsPerTeam: minRest,
    startTime: new Date('2026-10-17T09:00:00'),
  };
}

/** Anzahl Zeitfenster bis zum letzten Spiel (leere Fenster zaehlen mit). */
function slotCount(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, (m.slot ?? m.round - 1) + 1), 0);
}

/** Laengste Einzelpause eines Teams in Zeitfenstern (Abstand zweier eigener Spiele). */
function longestGapSlots(matches: Match[]): number {
  const slotsByTeam = new Map<string, number[]>();
  for (const m of matches) {
    const slot = m.slot ?? m.round - 1;
    for (const id of [m.teamA, m.teamB]) {
      slotsByTeam.set(id, [...(slotsByTeam.get(id) ?? []), slot]);
    }
  }
  let longest = 0;
  slotsByTeam.forEach((slots) => {
    const sorted = [...slots].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      longest = Math.max(longest, sorted[i] - sorted[i - 1]);
    }
  });
  return longest;
}

/** Laengste Einzelpause eines Teams in Minuten (Start-zu-Start-Abstand minus Spieldauer). */
function longestPauseMinutes(matches: Match[]): number {
  const gap = longestGapSlots(matches);
  return gap === 0 ? 0 : gap * (SLOT_MIN + BREAK_MIN) - SLOT_MIN;
}

function signature(matches: Match[]): string {
  return matches
    .map((m) => `${m.slot}:${m.field}:${m.teamA}-${m.teamB}:${m.group}`)
    .sort()
    .join('|');
}

describe('@W4-023 Zeitfenster ohne unnötige Leerfenster', () => {
  it('6 Teams auf 2 Feldern brauchen hoechstens 13 Zeitfenster statt 15', () => {
    const matches = generateGroupPhaseSchedule(options(6, 2));

    expect(matches).toHaveLength(15);
    expect(slotCount(matches)).toBeLessThanOrEqual(13);
  });
});

describe('@W4-024 keine unverhältnismäßig lange Einzelpause, deterministisch', () => {
  it('kein Team wartet laenger als 65 Minuten zwischen zwei eigenen Spielen', () => {
    const matches = generateGroupPhaseSchedule(options(6, 2));

    expect(longestPauseMinutes(matches)).toBeLessThanOrEqual(65);
  });

  it('gleiche Eingabe ergibt immer denselben Spielplan', () => {
    const first = generateGroupPhaseSchedule(options(6, 2));
    const second = generateGroupPhaseSchedule(options(6, 2));

    expect(signature(second)).toBe(signature(first));
  });
});

describe('@W4-023/@W4-024 Gegenbeispiel: nie schlechter als Seed 0 (heute)', () => {
  const cases: Array<{ teams: number; fields: number; groups: number }> = [];
  for (let teams = 4; teams <= 12; teams++) {
    for (let fields = 1; fields <= 3; fields++) {
      for (let groups = 1; groups <= 2; groups++) {
        if (groups === 2 && teams < 4) { continue; }
        cases.push({ teams, fields, groups });
      }
    }
  }

  it.each(cases)(
    '$teams Teams, $fields Felder, $groups Gruppe(n): Zeitfenster und laengste Pause nicht schlechter',
    ({ teams, fields, groups }) => {
      const base = options(teams, fields, groups);
      const heute = scheduleGroupPhaseVariant(base, 0);
      const neu = generateGroupPhaseSchedule(base);

      expect(neu).toHaveLength(heute.length);
      expect(slotCount(neu)).toBeLessThanOrEqual(slotCount(heute));
      expect(longestGapSlots(neu)).toBeLessThanOrEqual(longestGapSlots(heute));
    },
  );
});

describe('@W4-025 unvollständiger Spielplan wird nie still übernommen', () => {
  // 3 Teams, 1 Feld, Mindestpause 3 Zeitfenster: die Spiele passen nicht in die Sicherheitsgrenze.
  const blocked = (): GroupPhaseScheduleOptions => options(3, 1, 1, 3);

  it('die Variante fuer Seed 0 wirft mit Anzahl fehlender Spiele', () => {
    expect(() => scheduleGroupPhaseVariant(blocked(), 0)).toThrow(
      /Spielplan konnte nicht vollständig erstellt werden\. \d+ Matches fehlen/,
    );
  });

  it('der Generator liefert keinen Plan mit fehlenden Spielen', () => {
    expect(() => generateGroupPhaseSchedule(blocked())).toThrow(
      /Spielplan konnte nicht vollständig erstellt werden\. \d+ Matches fehlen/,
    );
  });
});
