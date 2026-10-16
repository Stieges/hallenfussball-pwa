import { describe, it, expect } from 'vitest';
import { IncompleteScheduleError } from '../incompleteScheduleError';
import {
  generateGroupPhaseSchedule,
  scheduleGroupPhaseVariant,
  type GroupPhaseScheduleOptions,
} from '../fairScheduler';
import type { Team, Match } from '../../../types/tournament';
import { looseVs, testUuid } from '../../../test/matchSlotFixtures';
import {
  isBetterVariant,
  isWithinBaseline,
  measureVariant,
  variantCountFor,
} from '../scheduleVariants';

/**
 * B-42: Beste von 50 Gleichstands-Varianten, kein stiller Abbruch.
 * Szenarien: @W4-023 (Zeitfenster), @W4-024 (Einzelpause, Determinismus), @W4-025 (Abbruch).
 * Zeitraster der Szenarien: 10 min Spiel, 5 min Wechsel (15-min-Raster).
 */

const SLOT_MIN = 10;
const BREAK_MIN = 5;

// Merge I1: Team-IDs sind UUIDs (A-01, teamSlot lehnt Kurz-IDs ab); Nummernkreis je Präfix (Kennbuchstabe × 1000).
function createTeams(n: number, group: string, prefix = 't'): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: testUuid(prefix.charCodeAt(0) * 1000 + i),
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

  it('die Variante fuer Seed 0 wirft IncompleteScheduleError mit Anzahl fehlender Spiele', () => {
    const run = (): unknown => {
      try {
        scheduleGroupPhaseVariant(blocked(), 0);
        return null;
      } catch (error) {
        return error;
      }
    };
    const error = run();

    expect(error).toBeInstanceOf(IncompleteScheduleError);
    expect((error as IncompleteScheduleError).missingMatches).toBeGreaterThan(0);
  });

  it('der Generator liefert keinen Plan mit fehlenden Spielen', () => {
    expect(() => generateGroupPhaseSchedule(blocked())).toThrow(IncompleteScheduleError);
  });
});

/** Gruppen mit beliebigen Groessen (fuer ungleich grosse Gruppen). */
function optionsWithSizes(sizes: number[], fields: number, minRest = 1): GroupPhaseScheduleOptions {
  const groups = new Map<string, Team[]>();
  sizes.forEach((size, index) => {
    const label = String.fromCharCode(65 + index);
    groups.set(label, createTeams(size, label, label.toLowerCase()));
  });
  return {
    groups,
    numberOfFields: fields,
    slotDurationMinutes: SLOT_MIN,
    breakBetweenSlotsMinutes: BREAK_MIN,
    minRestSlotsPerTeam: minRest,
    startTime: new Date('2026-10-17T09:00:00'),
  };
}

describe('F2: Seed 0 ist das alte Verhalten (fester Erwartungswert)', () => {
  it.each([
    { name: '6 Teams / 2 Felder', opts: () => options(6, 2), slots: 15, pauseMin: 110 },
    { name: '5 Teams / 2 Felder', opts: () => options(5, 2), slots: 11, pauseMin: 80 },
    { name: '2 Gruppen à 5 / 2 Felder', opts: () => options(10, 2, 2), slots: 12, pauseMin: 80 },
  ])('$name: heute $slots Zeitfenster, laengste Pause $pauseMin min', ({ opts, slots, pauseMin }) => {
    const heute = scheduleGroupPhaseVariant(opts(), 0);

    expect(slotCount(heute)).toBe(slots);
    expect(longestPauseMinutes(heute)).toBe(pauseMin);
  });
});

describe('F3: Untergrenze gegenueber Seed 0', () => {
  it('verwirft eine Variante mit laengerer Einzelpause, auch wenn sie weniger Zeitfenster braucht', () => {
    const heute = { seed: 0, slotCount: 15, longestGap: 4, spread: 0 };
    const weniger = { seed: 9, slotCount: 14, longestGap: 6, spread: 0 };

    expect(isWithinBaseline(weniger, heute)).toBe(false);
    expect(isWithinBaseline({ ...weniger, longestGap: 4 }, heute)).toBe(true);
  });

  it('7 + 6 Teams / 3 Felder: der gewaehlte Plan hat 15 Zeitfenster und 4 Slots laengste Luecke', () => {
    const base = optionsWithSizes([7, 6], 3, 1);
    const heute = scheduleGroupPhaseVariant(base, 0);
    const neu = generateGroupPhaseSchedule(base);

    expect(slotCount(neu)).toBe(15);
    expect(longestGapSlots(neu)).toBe(4);
    expect(longestGapSlots(neu)).toBeLessThanOrEqual(longestGapSlots(heute));
  });
});

describe('F3: Kriterium Spreizung', () => {
  it('measureVariant misst die Spreizung der mittleren Pausen je Team', () => {
    const m = (id: string, a: string, b: string, slot: number): Match =>
      ({ id, round: slot + 1, field: 1, slot, ...looseVs(a, b), group: 'A' });
    // a: Slots 0,1,2 (mittel 1) · b: 0,4 (mittel 4) · c: 1,4 (mittel 3) · d: nur 2 (ohne Abstand)
    const matches = [m('1', 'a', 'b', 0), m('2', 'a', 'c', 1), m('3', 'a', 'd', 2), m('4', 'b', 'c', 4)];

    expect(measureVariant(0, matches)).toEqual({ seed: 0, slotCount: 5, longestGap: 4, spread: 3 });
  });

  it('bei gleichen Zeitfenstern und gleicher Einzelpause gewinnt die kleinere Spreizung, nicht der kleinere Seed', () => {
    const glatt = { seed: 7, slotCount: 10, longestGap: 3, spread: 0.5 };
    const ungleich = { seed: 2, slotCount: 10, longestGap: 3, spread: 1.5 };

    expect(isBetterVariant(glatt, ungleich)).toBe(true);
    expect(isBetterVariant(ungleich, glatt)).toBe(false);
  });
});

describe('F4: Kostenmodell der Variantenzahl', () => {
  it('MVP-Bereich (10 Teams / 1 Feld, 10 Teams / 3 Felder) bekommt alle 50 Varianten', () => {
    expect(variantCountFor(45, 10, 1)).toBe(50);
    expect(variantCountFor(45, 10, 3)).toBe(50);
  });

  it('16 Teams / 1 Feld und 24 Teams / 3 Felder bekommen weniger Varianten (Laufzeit)', () => {
    expect(variantCountFor(120, 16, 1)).toBe(17);
    expect(variantCountFor(276, 24, 3)).toBe(6);
  });
});

describe('@W4-023 beste von 50 bei 10 Teams / 3 Feldern', () => {
  it('erreicht 20 Zeitfenster mit 3 Slots laengster Luecke (wie durchrechnen.md)', () => {
    const matches = generateGroupPhaseSchedule(options(10, 3));

    expect(slotCount(matches)).toBe(20);
    expect(longestGapSlots(matches)).toBe(3);
  });
});
