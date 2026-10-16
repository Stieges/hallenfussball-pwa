/**
 * A-01 (MVP-Bauplan, Spur A) – Generatoren erzeugen Spielseiten als Slot.
 * Anforderung: @TM-015 („Ein unbesetzter Platz zeigt seine Herkunft“): Die Finalrunde trägt ihre Herkunft
 * strukturiert (Gruppenrang bzw. Ergebnis eines ECHTEN Vorgängerspiels), Gruppenspiele tragen Team-IDs.
 */
import { describe, it, expect } from 'vitest';
import {
  generateGroupPhaseSchedule,
  generatePlayoffDefinitions,
  generatePlayoffDefinitionsLegacy,
  generatePlayoffSchedule,
  type PlayoffMatchDefinition,
} from '../index';
import { MatchSlotSchema, type MatchSlot } from '../../models/schemas/MatchSlotSchema';
import type { FinalsPreset, Match, Team } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function createTeams(n: number, group: string, offset: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: testUuid(offset + i),
    name: `FC Nord ${group}${i + 1}`,
    group,
  }));
}

function playoffs(numberOfGroups: number, preset: FinalsPreset, numberOfFields = 2): Match[] {
  const definitions = generatePlayoffDefinitions(numberOfGroups, { preset });
  return generatePlayoffSchedule({
    playoffDefinitions: definitions,
    numberOfFields,
    slotDurationMinutes: 10,
    breakBetweenSlotsMinutes: 2,
    minRestSlotsPerTeam: 1,
    startSlot: 10,
    startTime: new Date('2026-10-23T09:00:00'),
  });
}

function slotsOf(match: Match): [MatchSlot, MatchSlot] {
  if (!match.slotA || !match.slotB) {
    throw new Error(`Spiel ${match.id} ohne Slot`);
  }
  return [match.slotA, match.slotB];
}

describe('Gruppenphase (fairScheduler) – Slots mit Team-ID', () => {
  const teamsA = createTeams(4, 'A', 1);
  const teamsB = createTeams(4, 'B', 11);
  const allTeams = [...teamsA, ...teamsB];
  const matches = generateGroupPhaseSchedule({
    groups: new Map([
      ['A', teamsA],
      ['B', teamsB],
    ]),
    numberOfFields: 2,
    slotDurationMinutes: 10,
    breakBetweenSlotsMinutes: 2,
    minRestSlotsPerTeam: 1,
    startTime: new Date('2026-10-23T09:00:00'),
  });

  it('@TM-015 Generator-Spiel trägt {kind:"team", teamId} mit einer ID aus tournament.teams', () => {
    expect(matches).toHaveLength(12);
    const ids = new Set(allTeams.map((t) => t.id));
    for (const m of matches) {
      for (const slot of slotsOf(m)) {
        expect(MatchSlotSchema.safeParse(slot).success).toBe(true);
        expect(slot.kind).toBe('team');
        expect(slot.kind === 'team' && ids.has(slot.teamId)).toBe(true);
      }
    }
  });

  it('@TM-015 Gegenbeispiel: kein Slot trägt einen Teamnamen', () => {
    const names = new Set(allTeams.map((t) => t.name));
    for (const m of matches) {
      for (const slot of slotsOf(m)) {
        expect(slot.kind === 'team' && names.has(slot.teamId)).toBe(false);
      }
    }
  });

  it('A-36a Gegenbeispiel: Gruppenspiele tragen kein Übergangsfeld teamA/teamB mehr', () => {
    for (const m of matches) {
      expect('teamA' in m || 'teamB' in m).toBe(false);
    }
  });

  it('wirft, wenn ein Team keine UUID als ID hat (Teamname als ID)', () => {
    expect(() =>
      generateGroupPhaseSchedule({
        groups: new Map([
          [
            'A',
            [
              { id: 'FC Nord', name: 'FC Nord', group: 'A' },
              { id: 'SV Süd', name: 'SV Süd', group: 'A' },
            ],
          ],
        ]),
        numberOfFields: 1,
        slotDurationMinutes: 10,
        breakBetweenSlotsMinutes: 2,
        minRestSlotsPerTeam: 1,
      }),
    ).toThrow();
  });
});

describe('Finalrunde (playoffScheduler) – Herkunft strukturiert, Verweis auf echte Spiel-ID', () => {
  it('@TM-015 Halbfinale über Kreuz mit Gruppenrang, Finale/Platz 3 zeigen auf die UUIDs der Halbfinale (2 Gruppen, top-4)', () => {
    const matches = playoffs(2, 'top-4');
    const isGroupRankPair = (m: Match) => slotsOf(m).every((s) => s.kind === 'pending' && s.source.kind === 'groupRank');
    const semis = matches.filter((m) => !m.finalType && isGroupRankPair(m));
    const final = matches.find((m) => m.finalType === 'final');
    const third = matches.find((m) => m.finalType === 'thirdPlace');
    if (semis.length !== 2 || !final || !third) {
      throw new Error('Finalrunde unvollständig');
    }

    // A-01 garantiert nur die Paare (über Kreuz, als Menge) – nicht Nummerierung und Heimseite.
    // Bestand: playoffGenerator.ts setzt bei 2 Gruppen HF1 = 2A–1B, HF2 = 1A–2B; die Spec verlangt
    // HF1 = 1A–2B, HF2 = 1B–2A. Befund, Fix in A-12 (@TM-142) – hier bewusst NICHT festgeschrieben.
    const pairKey = (m: Match) =>
      slotsOf(m)
        .map((s) => (s.kind === 'pending' && s.source.kind === 'groupRank' ? `${s.source.rank}${s.source.group}` : '?'))
        .sort()
        .join('–');
    expect(new Set(semis.map(pairKey))).toEqual(new Set(['1A–2B', '1B–2A']));
    for (const semi of semis) {
      expect(semi.id).toMatch(UUID);
    }

    const semiIds = new Set(semis.map((m) => m.id));
    const refs = (m: Match, role: 'winner' | 'loser') =>
      slotsOf(m).map((s) => (s.kind === 'pending' && s.source.kind === 'matchResult' && s.source.role === role ? s.source.matchId : '?'));
    expect(new Set(refs(final, 'winner'))).toEqual(semiIds);
    expect(new Set(refs(third, 'loser'))).toEqual(semiIds);
  });

  it('@TM-015 Gegenbeispiel: kein Spiel heißt "semi1" und keine Herkunft verweist auf "semi1"', () => {
    const matches = playoffs(2, 'top-4');
    expect(matches.some((m) => m.id === 'semi1')).toBe(false);
    const sources = matches.flatMap((m) => slotsOf(m)).map((s) => (s.kind === 'pending' ? s.source : undefined));
    expect(sources.some((s) => s?.kind === 'matchResult' && s.matchId === 'semi1')).toBe(false);
  });

  const presets: FinalsPreset[] = ['final-only', 'top-4', 'top-8', 'top-16', 'all-places'];
  const combos = presets.flatMap((preset) => [2, 3, 4, 5, 6, 7, 8].map((groups) => [preset, groups] as const));
  // top-8/top-16 mit 3 Gruppen: siehe Bestandstest C-PLAYOFF-3GROUPS unten (keine Anforderung).
  const knownEmpty = new Set(['top-8:3', 'top-16:3']);
  const tm015Combos = combos.filter(([preset, groups]) => !knownEmpty.has(`${preset}:${groups}`));

  it.each(tm015Combos)('@TM-015 %s mit %i Gruppen: jeder Finalrunden-Slot offen, gültig und verweist auf ein Spiel im Turnier', (preset, groups) => {
    const matches = playoffs(groups, preset);
    expect(matches.length).toBeGreaterThan(0);
    const matchIds = new Set(matches.map((m) => m.id));
    const groupIds = new Set(Array.from({ length: groups }, (_, i) => String.fromCharCode(65 + i)));
    for (const m of matches) {
      for (const slot of slotsOf(m)) {
        expect(MatchSlotSchema.safeParse(slot).success).toBe(true);
        if (slot.kind !== 'pending') {
          throw new Error('Finalrunden-Slot ist nicht offen');
        }
        if (slot.source.kind === 'matchResult') {
          expect(matchIds.has(slot.source.matchId)).toBe(true);
          expect(slot.source.matchId).not.toBe(m.id);
        } else {
          expect(groupIds.has(slot.source.group)).toBe(true);
        }
      }
    }
  });

  // Bestand, keine Anforderung: Halbfinale hängen an Viertelfinalen, die es bei 3 Gruppen nicht gibt → der
  // Scheduler plant gar keine Finalrunde. Befund C-PLAYOFF-3GROUPS (Eintrag in BEFUNDE durch den Controller).
  it.each([['top-8'], ['top-16']] as const)('C-PLAYOFF-3GROUPS (Bestand): %s mit 3 Gruppen erzeugt keine Finalrunde', (preset) => {
    expect(playoffs(3, preset)).toHaveLength(0);
  });

  it('wirft bei unbekanntem Herkunftsformat (Freitext statt Platzhalter)', () => {
    const definitions: PlayoffMatchDefinition[] = [
      { id: 'final', label: 'Finale', teamASource: 'Sieger HF1', teamBSource: 'group-b-1st', parallelMode: 'sequentialOnly', dependencies: [] },
    ];
    expect(() =>
      generatePlayoffSchedule({
        playoffDefinitions: definitions,
        numberOfFields: 1,
        slotDurationMinutes: 10,
        breakBetweenSlotsMinutes: 2,
        minRestSlotsPerTeam: 1,
        startSlot: 0,
      }),
    ).toThrow(/Herkunft/);
  });

  it('wirft, wenn die Herkunft auf ein nicht geplantes Spiel verweist', () => {
    const definitions: PlayoffMatchDefinition[] = [
      { id: 'final', label: 'Finale', teamASource: 'semi9-winner', teamBSource: 'group-b-1st', parallelMode: 'sequentialOnly', dependencies: [] },
    ];
    expect(() =>
      generatePlayoffSchedule({
        playoffDefinitions: definitions,
        numberOfFields: 1,
        slotDurationMinutes: 10,
        breakBetweenSlotsMinutes: 2,
        minRestSlotsPerTeam: 1,
        startSlot: 0,
      }),
    ).toThrow(/semi9/);
  });
});

describe('playoffScheduler – Randfälle', () => {
  const base = { numberOfFields: 1, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 2, minRestSlotsPerTeam: 1, startSlot: 0 };

  it('ohne Definitionen entsteht kein Spiel', () => {
    expect(generatePlayoffSchedule({ ...base, playoffDefinitions: [] })).toEqual([]);
  });

  it('ein Feld: alle Spiele nacheinander, Verweise zeigen trotzdem auf die geplanten Spiele', () => {
    const matches = generatePlayoffSchedule({ ...base, playoffDefinitions: generatePlayoffDefinitions(2, { preset: 'top-4' }) });
    expect(matches.map((m) => m.slot)).toEqual([0, 1, 2, 3]);
    expect(matches.every((m) => m.scheduledTime === undefined)).toBe(true);
    const ids = new Set(matches.map((m) => m.id));
    const refs = matches.flatMap((m) => slotsOf(m)).flatMap((s) => (s.kind === 'pending' && s.source.kind === 'matchResult' ? [s.source.matchId] : []));
    expect(refs).toHaveLength(4);
    expect(refs.every((id) => ids.has(id))).toBe(true);
  });

  it('Kreisabhängigkeit wirft', () => {
    const definitions: PlayoffMatchDefinition[] = [
      { id: 'x', label: 'X', teamASource: 'y-winner', teamBSource: 'group-a-1st', parallelMode: 'parallelAllowed', dependencies: ['y'] },
      { id: 'y', label: 'Y', teamASource: 'x-winner', teamBSource: 'group-b-1st', parallelMode: 'parallelAllowed', dependencies: ['x'] },
    ];
    expect(() => generatePlayoffSchedule({ ...base, playoffDefinitions: definitions })).toThrow(/Circular/);
  });

  it('Parallel-Schalter aus → Runde nur nacheinander', () => {
    const modes = (preset: FinalsPreset, groups: number, flags: Record<string, boolean>) =>
      Object.fromEntries(generatePlayoffDefinitions(groups, { preset, ...flags }).map((d) => [d.id, d.parallelMode]));
    expect(modes('top-4', 2, { parallelSemifinals: false }).semi1).toBe('sequentialOnly');
    expect(modes('top-4', 2, {}).semi1).toBe('parallelAllowed');
    expect(modes('top-8', 4, { parallelQuarterfinals: false }).qf1).toBe('sequentialOnly');
    expect(modes('top-16', 8, { parallelRoundOf16: false })['r16-1']).toBe('sequentialOnly');
    expect(modes('top-4', 2, {}).final).toBe('sequentialOnly');
  });

  it.each([
    [{ final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false }, []],
    [{ final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false }, ['final']],
    [{ final: true, thirdPlace: true, fifthSixth: false, seventhEighth: false }, ['semi1', 'semi2', 'third-place', 'final']],
    [{ final: true, thirdPlace: true, fifthSixth: true, seventhEighth: false }, ['semi1', 'semi2', 'place78-direct', 'place56-direct', 'third-place', 'final']],
  ])('Legacy-Finals %o → Definitionen %o', (finals, ids) => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Altweg wird von scheduleGenerator ohne finalsConfig noch genutzt
    expect(generatePlayoffDefinitionsLegacy(2, finals).map((d) => d.id)).toEqual(ids);
  });
});
