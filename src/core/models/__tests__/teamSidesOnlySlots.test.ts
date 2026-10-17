/**
 * A-36a (Brief Schritt 6, Aufräumen ohne Verhaltensänderung): das Übergangsfeld `Match.teamA/teamB` ist gelöscht.
 * Die Seiten eines Spiels stehen nur in `slotA/slotB`. Vorher A-04b-Wächter (genau eine Schreibstelle,
 * kein Leser außerhalb Spur B); seit B-35 gibt es keine Leser mehr, seit A-36a auch keinen Schreiber.
 * Kein Szenario-Test (Aufräum-/Wächtertest); die Szenario-Kennung @TM-027 prüft `DraggableMatch.slots.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { transitionalTeamRef, teamSlot } from '../matchSlot';
import { groupRank, testUuid } from '../../../test/matchSlotFixtures';
import { assignTeamToSide } from '../matchAssignment';
import { MatchSchema } from '../schemas/TournamentSchema';
import type { Match } from '../../../types/tournament';

const NORD = testUuid(1);
const UFER = testUuid(2);

describe('A-36a Seiten nur im Slot', () => {
  it('transitionalTeamRef (nur noch für ScheduledMatch.originalTeamA und den Paarungs-Schlüssel): Team-ID oder TBD', () => {
    expect(transitionalTeamRef(teamSlot(NORD))).toBe(NORD);
    expect(transitionalTeamRef(groupRank('A', 1))).toBe('TBD');
  });

  it('Gegenbeispiel: eine aufgelöste Seite trägt die Team-ID, nie den Text der Herkunft', () => {
    const resolved = teamSlot(NORD, { kind: 'groupRank', group: 'A', rank: 1 });
    expect(transitionalTeamRef(resolved)).toBe(NORD);
  });

  it('manuelles Umbesetzen setzt nur den Slot, kein Übergangsfeld', () => {
    const match: Match = { id: testUuid(50), round: 1, field: 1, slotA: groupRank('A', 1), slotB: teamSlot(UFER) };

    const assigned = assignTeamToSide(match, 'A', NORD);

    expect(assigned.slotA).toEqual({ ...teamSlot(NORD), assignedBy: 'reassigned' }); // A-36b: Merkmal lokal
    expect('teamA' in assigned || 'teamB' in assigned).toBe(false);
  });

  it('lokale Ablage: ein gespeichertes Spiel mit Alt-Feld teamA verliert es beim Lesen (Zod), die Seiten bleiben', () => {
    const stale = { id: testUuid(51), round: 1, field: 1, slotA: teamSlot(NORD), slotB: teamSlot(UFER), teamA: 'FC Nord' };
    const parsed = MatchSchema.parse(stale);
    expect('teamA' in parsed).toBe(false);
    expect(parsed.slotA).toEqual(teamSlot(NORD));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Quelltext-Wächter (Pflichttest Schritt 6: grep `\.teamA\b|\.teamB\b` in src ausserhalb Tests/Fixtures = 0)
// ---------------------------------------------------------------------------------------------------------------

const SRC = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return ['__tests__', '__fixtures__', 'test', 'test-data'].includes(entry) ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const productive = sourceFiles(SRC).map((file) => relative(SRC, file));

describe('Quelltext-Wächter – kein Übergangsfeld teamA/teamB im Produktivcode', () => {
  it('Gegenbeispiel: kein `.teamA`/`.teamB` im Produktivcode (alle Bereiche, auch Spur B)', () => {
    const hits = productive.flatMap((file) =>
      readFileSync(join(SRC, file), 'utf8').split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => /\.team[AB]\b/.test(text)),
    );

    expect(hits).toEqual([]);
  }, 30_000);

  it('Gegenbeispiel: `teamA:`/`teamB:` nur noch als fremde Schlüssel (Anzeige-Parameter, Import-Dateiformat)', () => {
    const writers = productive.filter((file) => /\bteam[AB]:\s/.test(readFileSync(join(SRC, file), 'utf8')));

    // ScheduleTab (i18n-Parameter), Korrektur-Dialog/-Banner und ReplanPanel (Anzeige-Props mit Namen),
    // ImportTemplates (Dateiformat der Import-Vorlage) – keiner davon ist ein Feld am Spiel.
    const unexpected = writers.filter((file) => ![
      'features/tournament-management/ScheduleTab.tsx', 'components/dialogs/ImportTemplates.ts',
      'components/dialogs/CorrectionDialog.tsx', 'components/schedule/CorrectionBanner.tsx',
      'features/tournament-creation/components/ReplanPanel.tsx',
    ].includes(file));
    expect(unexpected).toEqual([]);
  }, 30_000);
});
