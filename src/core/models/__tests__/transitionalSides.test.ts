/**
 * A-04b (MVP-Bauplan, Spur A) – das Übergangsfeld `Match.teamA/teamB` hat genau EINE Schreibstelle und KEINEN
 * Leser außerhalb der Spur-B-Bereiche (Löschen in B-35). Die Seiten eines Spiels kommen aus `slotA/slotB`.
 * Kein Szenario-Test (Aufräum-/Wächtertest); die Szenario-Kennung @TM-027 prüft `DraggableMatch.slots.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { transitionalSides, transitionalTeamRef, teamSlot } from '../matchSlot';
import { groupRank, resultOf, testUuid } from '../../../test/matchSlotFixtures';
import { assignTeamToSide } from '../matchAssignment';
import type { Match } from '../../../types/tournament';

const NORD = testUuid(1);
const UFER = testUuid(2);

describe('A-04b transitionalSides – das Übergangsfeld folgt den Slots', () => {
  it.each([
    ['beide besetzt', teamSlot(NORD), teamSlot(UFER), NORD, UFER],
    ['Heimseite offen', groupRank('A', 1), teamSlot(UFER), 'TBD', UFER],
    ['beide offen (Herkunft wird nicht zum Text)', groupRank('A', 1), resultOf(testUuid(9), 'winner'), 'TBD', 'TBD'],
  ])('%s', (_name, slotA, slotB, expectedA, expectedB) => {
    expect(transitionalSides(slotA, slotB)).toEqual({ teamA: expectedA, teamB: expectedB });
  });

  it('Gegenbeispiel: eine aufgelöste Seite trägt die Team-ID, nie den Text der Herkunft', () => {
    const resolved = teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 });
    expect(transitionalTeamRef(resolved)).toBe(NORD);
  });

  it('manuelles Umbesetzen setzt Slot und Übergangsfeld zusammen, die andere Seite bleibt', () => {
    const match: Match = {
      id: testUuid(50), round: 1, field: 1, slotA: groupRank('A', 1), slotB: teamSlot(UFER),
      ...transitionalSides(groupRank('A', 1), teamSlot(UFER)),
    };

    const assigned = assignTeamToSide(match, 'A', NORD);

    expect(assigned.slotA).toEqual(teamSlot(NORD));
    expect(assigned).toMatchObject({ teamA: NORD, teamB: UFER });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Quelltext-Wächter (Gegenbeispiel aus dem Brief: grep `\.teamA\b` außerhalb der B-Adapter = keine Treffer)
// ---------------------------------------------------------------------------------------------------------------

const SRC = join(__dirname, '..', '..', '..');
const B_AREAS = ['features/monitor-display', 'features/public-view', 'screens/LiveViewScreen.tsx', 'lib/pdfExporter.ts', 'lib/pdf', 'features/tournament-creation'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'test' || entry === 'test-data' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const productive = sourceFiles(SRC)
  .map((file) => relative(SRC, file))
  .filter((file) => !B_AREAS.some((area) => file === area || file.startsWith(`${area}/`)));

describe('Quelltext-Wächter – kein Zugriff auf das Übergangsfeld außerhalb der B-Bereiche', () => {
  it('Gegenbeispiel: kein `.teamA`/`.teamB` im Produktivcode', () => {
    const hits = productive.flatMap((file) =>
      readFileSync(join(SRC, file), 'utf8').split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => /\.team[AB]\b/.test(text)),
    );

    expect(hits).toEqual([]);
  });

  it('Gegenbeispiel: geschrieben wird `teamA:`/`teamB:` nur in `transitionalSides`', () => {
    const writers = productive.filter((file) => /\bteam[AB]:\s/.test(readFileSync(join(SRC, file), 'utf8')));

    // `types/tournament.ts` (Typ), `TournamentSchema.ts` (Schema), `matchSlot.ts` (die Schreibstelle),
    // `tournamentImporter.ts` (Dateiformat-Schlüssel), `ScheduleTab`/Dialoge (Anzeige-Parameter `teamA: Name`)
    expect(writers.sort()).toEqual(expect.arrayContaining(['core/models/matchSlot.ts']));
    const unexpected = writers.filter((file) => ![
      'core/models/matchSlot.ts', 'types/tournament.ts', 'core/models/schemas/TournamentSchema.ts',
      'features/tournament-management/ScheduleTab.tsx', 'components/dialogs/ImportTemplates.ts',
      'components/dialogs/CorrectionDialog.tsx', 'components/schedule/CorrectionBanner.tsx',
      'utils/tournamentImporter.ts',
    ].includes(file));
    expect(unexpected).toEqual([]);
  });
});
