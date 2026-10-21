/**
 * A-12a Pflichttest über den echten Weg (Plan GA4 v2 § 5 A-12a): Assistent veröffentlicht
 * (`TournamentCreationService.publish` → `generateFullSchedule`) → `mapTournamentToSupabase` (die Zeilen, die
 * `SupabaseRepository.save()` an die Cloud schickt). Geprüft werden die Insert-Zeilen der Finalrunde: Herkunft je Seite
 * (`origin_a/b`), `final_type`, `phase`, `is_final` und die Einstellung `finals_config.placements`.
 *
 * Record Turniermodi (2026-10-01): @TM-001, @TM-002 (Zeile 2×4), @TM-004 (alle vier Zeilen), @TM-005, @TM-142.
 * Befunde: C-FINALPHASE-AUS-ID (HF als `final` gespeichert), C-GENERATOR-HERKUNFT-GRUPPENNAMEN (feste „Gruppe A/B“),
 * C-GENERATOR-GRUPPENZAHL-DEFAULT (`numberOfGroups ?? 2`).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TournamentCreationService } from '../../services/TournamentCreationService';
import { mapTournamentToSupabase } from '../../repositories/supabaseMappers';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type { FinalsConfig, Team, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '..';
import { testUuid } from '../../../test/testIds';
import { createMockTournament } from '../../../test/factories';

type Row = ReturnType<typeof mapTournamentToSupabase>['matchRows'][number];
type Origin = { kind: 'groupRank'; group: string; rank: number } | { kind: 'matchResult'; matchId: string; role: string };

const OWNER = testUuid(900);
const repository = (): ITournamentRepository => ({ save: vi.fn(() => Promise.resolve()) }) as unknown as ITournamentRepository;

beforeAll(() => {
  // publish() erzeugt einen Share-Code über window.crypto (utils/shareCode.ts).
  vi.stubGlobal('window', { crypto: globalThis.crypto });
});

const teamsIn = (groups: readonly string[], perGroup: number): Team[] =>
  groups.flatMap((group, g) =>
    Array.from({ length: perGroup }, (_, n) => ({ id: testUuid(g * 20 + n + 1), name: `Team ${group}${n + 1}`, group })),
  );

/** „Hallencup Nord“: 2 Gruppen à 4 Teams, Gruppen + Finalrunde. */
const hallencup = (finalsConfig: FinalsConfig, groups: readonly string[] = ['A', 'B'], perGroup = 4): Partial<Tournament> => {
  const teams = teamsIn(groups, perGroup);
  return {
    title: 'Hallencup Nord', date: '2026-11-14', timeSlot: '13:00', numberOfFields: 2, numberOfTeams: teams.length,
    numberOfGroups: groups.length, groupSystem: 'groupsAndFinals', groupPhaseGameDuration: 10, finalsConfig, teams,
  };
};

async function publishedRows(input: Partial<Tournament>) {
  const tournament = await new TournamentCreationService(repository()).publish(input);
  const { tournamentRow, matchRows } = mapTournamentToSupabase(tournament, OWNER);
  const finals = matchRows.filter((r) => r.is_final === true).sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0));
  return { tournament, tournamentRow, matchRows, finals };
}

/** Herkunft als kurzer Text: „1A“, „Verlierer 1. Halbfinale“. */
function originText(origin: unknown, rows: readonly Row[]): string {
  const o = origin as Origin | null;
  if (o === null || o === undefined) { return '–'; }
  if (o.kind === 'groupRank') { return `${o.rank}${o.group}`; }
  const target = rows.find((r) => r.id === o.matchId)?.label ?? '?';
  return `${o.role === 'winner' ? 'Sieger' : 'Verlierer'} ${target}`;
}

const table = (finals: readonly Row[]) =>
  finals.map((r) => [r.label, originText(r.origin_a, finals), originText(r.origin_b, finals), r.final_type, r.phase]);

describe('@TM-004 Pflichttest echter Weg: Platzierungsspiele je Platz bis in die Cloud-Zeile', () => {
  const HF = [
    ['1. Halbfinale', '1A', '2B', null, 'semifinal'],
    ['2. Halbfinale', '1B', '2A', null, 'semifinal'],
  ];
  const P7 = ['Spiel um Platz 7', '4A', '4B', 'seventhEighth', 'final'];
  const P5 = ['Spiel um Platz 5', '3A', '3B', 'fifthSixth', 'final'];
  const P3 = ['Spiel um Platz 3', 'Verlierer 1. Halbfinale', 'Verlierer 2. Halbfinale', 'thirdPlace', 'final'];
  const F = ['Finale', 'Sieger 1. Halbfinale', 'Sieger 2. Halbfinale', 'final', 'final'];

  it.each([
    { auswahl: 'keine', placements: [], erwartet: [...HF, F] },
    { auswahl: 'Platz 3', placements: [3], erwartet: [...HF, P3, F] },
    { auswahl: 'Platz 3 und 7', placements: [3, 7], erwartet: [...HF, P7, P3, F] },
    { auswahl: 'alle', placements: [3, 5, 7], erwartet: [...HF, P7, P5, P3, F] },
  ])('@TM-004 Auswahl $auswahl: Spiele, Herkunft je Seite, final_type, phase', async ({ placements, erwartet }) => {
    const { finals, tournamentRow } = await publishedRows(hallencup({ preset: 'top-4', placements }));

    expect(table(finals)).toEqual(erwartet);
    // „jedes dieser Spiele hat auf jeder Seite eine Herkunft“
    expect(finals.every((r) => r.origin_a !== null && r.origin_b !== null && r.origin_a !== undefined && r.origin_b !== undefined)).toBe(true);
    // Die Auswahl selbst landet in der Einstellung (finals_config, JSONB – keine Migration)
    expect((tournamentRow.finals_config as FinalsConfig | null)?.placements).toEqual(placements);
  });

  it('@TM-004 Vorlage „Alle Plätze“ ohne eigene Auswahl: Platz 7, 5, 3 und Finale', async () => {
    const { finals } = await publishedRows(hallencup({ preset: 'all-places' }));
    expect(table(finals)).toEqual([...HF, P7, P5, P3, F]);
  });
});

describe('@TM-005 / @TM-142 Pflichttest echter Weg: Vorlage „Top 4“', () => {
  it('@TM-142 @TM-005 2 Gruppen: HF1 1A–2B, HF2 1B–2A, Platz 3 = Verlierer HF1 gegen Verlierer HF2, dann Finale', async () => {
    const { finals } = await publishedRows(hallencup({ preset: 'top-4' }));

    expect(table(finals)).toEqual([
      ['1. Halbfinale', '1A', '2B', null, 'semifinal'],
      ['2. Halbfinale', '1B', '2A', null, 'semifinal'],
      ['Spiel um Platz 3', 'Verlierer 1. Halbfinale', 'Verlierer 2. Halbfinale', 'thirdPlace', 'final'],
      ['Finale', 'Sieger 1. Halbfinale', 'Sieger 2. Halbfinale', 'final', 'final'],
    ]);
  });

  it('@TM-142 1 Gruppe: HF1 Erster gegen Vierter, HF2 Zweiter gegen Dritter, dann Platz 3 und Finale', async () => {
    const { finals } = await publishedRows(hallencup({ preset: 'top-4' }, ['A'], 5));

    expect(table(finals).map((row) => row.slice(0, 3))).toEqual([
      ['1. Halbfinale', '1A', '4A'],
      ['2. Halbfinale', '2A', '3A'],
      ['Spiel um Platz 3', 'Verlierer 1. Halbfinale', 'Verlierer 2. Halbfinale'],
      ['Finale', 'Sieger 1. Halbfinale', 'Sieger 2. Halbfinale'],
    ]);
    expect(finals.map((r) => r.phase)).toEqual(['semifinal', 'semifinal', 'final', 'final']);
  });

  it('@TM-142 Gegenbeispiel: bei 2 Gruppen treffen im Halbfinale nie zwei Teams derselben Gruppe aufeinander', async () => {
    for (const preset of ['top-4', 'all-places'] as const) {
      const { finals } = await publishedRows(hallencup({ preset }));
      for (const semi of finals.filter((r) => r.phase === 'semifinal')) {
        expect((semi.origin_a as Origin & { group: string }).group).not.toBe((semi.origin_b as Origin & { group: string }).group);
      }
    }
  });

  it('A-12a Halbfinale bleiben Finalrunde: is_final = true, Spielnummern streng steigend, Finale zuletzt (@TM-144)', async () => {
    const { finals, matchRows } = await publishedRows(hallencup({ preset: 'all-places' }));
    const groupNumbers = matchRows.filter((r) => r.is_final === false).map((r) => r.match_number ?? 0);

    expect(finals.every((r) => r.is_final)).toBe(true);
    expect(Math.min(...finals.map((r) => r.match_number ?? 0))).toBeGreaterThan(Math.max(...groupNumbers));
    expect(finals.at(-1)?.final_type).toBe('final');
    expect(finals.at(-1)?.field).toBe(1);
  });
});

describe('@TM-002 Pflichttest echter Weg: jede Gruppe in der Herkunft, keine fremde Gruppe (Zeile 2×4)', () => {
  it.each(['final-only', 'top-4', 'all-places'] as const)('@TM-002 2 × 4, Vorlage %s', async (preset) => {
    const { finals } = await publishedRows(hallencup({ preset }));
    const groups = new Set(finals.flatMap((r) => [r.origin_a, r.origin_b] as Origin[]).flatMap((o) => (o.kind === 'groupRank' ? [o.group] : [])));

    expect(finals.length).toBeGreaterThan(0);
    expect([...groups].sort()).toEqual(['A', 'B']);
  });

  it('@TM-002 C-GENERATOR-HERKUNFT-GRUPPENNAMEN: Herkünfte nennen die echten Gruppen des Turniers, nie ein festes „A/B“', async () => {
    const { finals } = await publishedRows(hallencup({ preset: 'all-places' }, ['Nord', 'Sued']));
    const groups = new Set(finals.flatMap((r) => [r.origin_a, r.origin_b] as Origin[]).flatMap((o) => (o.kind === 'groupRank' ? [o.group] : [])));

    expect([...groups].sort()).toEqual(['Nord', 'Sued']);
    expect(table(finals).slice(0, 2).map((row) => row.slice(1, 3))).toEqual([['1Nord', '2Sued'], ['1Sued', '2Nord']]);
  });

  it('@TM-002 Gegenbeispiel: 3 Gruppen ergeben beim Anlegen einen sichtbaren Fehler (nur 1 oder 2 Gruppen), keinen Plan ohne Gruppe C', async () => {
    await expect(publishedRows(hallencup({ preset: 'top-4' }, ['A', 'B', 'C']))).rejects.toThrow(/nur für 1 oder 2 Gruppen/);
  });
});

describe('@TM-013 A-12a der Generator prüft die Herkunft beim Anlegen (validateFinalsPlan aus A-12b)', () => {
  it('@TM-013 Gruppe B hat nur 1 Team, „Top 4“ braucht den Zweiten B → nicht übernommen, Meldung nennt Stelle und Grund', async () => {
    const teams = [...teamsIn(['A'], 4), ...teamsIn(['B'], 1).map((t) => ({ ...t, id: testUuid(99) }))];
    const input = { ...hallencup({ preset: 'top-4' }), teams, numberOfTeams: teams.length };

    await expect(publishedRows(input)).rejects.toThrow(/Halbfinale 1, Gastseite: „Zweiter Gruppe B“: Gruppe B hat nur 1 Team/);
  });

  it('@TM-013 Gegenbeispiel: gültige Pläne für 1 und 2 Gruppen gehen ohne Meldung durch', async () => {
    await expect(publishedRows(hallencup({ preset: 'all-places' }))).resolves.toBeDefined();
    await expect(publishedRows(hallencup({ preset: 'top-4' }, ['A'], 4))).resolves.toBeDefined();
  });
});

describe('A-12a Gruppenzahl beim Anlegen (C-GENERATOR-GRUPPENZAHL-DEFAULT)', () => {
  it('A-12a fehlt die Gruppenzahl, kommt beim Anlegen ein sichtbarer Fehler', async () => {
    const input = { ...hallencup({ preset: 'top-4' }), numberOfGroups: undefined };
    await expect(publishedRows(input)).rejects.toThrow(/Gruppenzahl/);
  });

  it('A-12a Gegenbeispiel: ohne Finalrunde („Keine Finalrunde“) braucht es keine Gruppenzahl', async () => {
    const input = { ...hallencup({ preset: 'none' }), numberOfGroups: undefined };
    const { finals } = await publishedRows(input);
    expect(finals).toEqual([]);
  });
});

describe('@TM-001 Die Turnierform legt die Folge der Phasen fest (Muss-Formen)', () => {
  it('@TM-001 Jeder gegen jeden → eine Gruppe', () => {
    const teams = teamsIn(['A'], 6).map(({ group: _group, ...team }) => team);
    const schedule = generateFullSchedule(createMockTournament({
      groupSystem: 'roundRobin', teams, numberOfTeams: 6, numberOfGroups: 1, finalsConfig: { preset: 'none' },
    }));

    expect(schedule.phases.map((p) => p.name)).toEqual(['groupStage']);
    expect(schedule.allMatches.every((m) => m.phase === 'groupStage')).toBe(true);
  });

  it('@TM-001 Gruppen + Finalrunde → Gruppenphase, Finalrunde (die Finalrunde ist EIN Abschnitt, auch mit Halbfinale)', async () => {
    const { tournament } = await publishedRows(hallencup({ preset: 'all-places' }));
    const schedule = generateFullSchedule(tournament);

    expect(schedule.phases.map((p) => p.name)).toEqual(['groupStage', 'final']);
    expect(schedule.phases[1].matches.map((m) => m.label)).toEqual([
      '1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 7', 'Spiel um Platz 5', 'Spiel um Platz 3', 'Finale',
    ]);
  });
});
