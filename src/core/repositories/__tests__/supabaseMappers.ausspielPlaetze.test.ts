/**
 * Paket TB-B, Task TB-3' (Kern): Turnierfeld `placementsToPlayOut` („Diese Plätze müssen bei Gleichstand ausgespielt
 * werden“) im `tournaments.config`-JSONB (keine Migration) – Voreinstellung nur Platz 1 (Daniel K10), Zod `.catch([1])`,
 * Mapper hin und zurück, lokale Hydration, nur vorhandene Plätze (@W2A-073). Dazu @W2A-072 (Kern): eine Entscheidung
 * im `config` nennt weder Person noch Zeitpunkt noch Grund; Altwerte entfernt das Schema beim Lesen, also beim nächsten
 * Schreiben. Der anonyme REST-Abruf ohne App (RLS-Matrix) braucht den lokalen Stack und steht aus (Report TB-3').
 */
import { describe, expect, it } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { hydrateTournament } from '../hydration';
import { writeStandingDecisionsToCloud } from '../standingDecisionsCloud';
import { TournamentSchema } from '../../models/schemas/TournamentSchema';
import { effectivePlacementsToPlayOut, offeredPlaces } from '../../standings/playOutPlaces';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';
import type { Tournament } from '../../../types/tournament';
import { DATA, league } from '../../standings/__tests__/fixtures';
import { jgj, MemoryRepo, nikolaus, order, shared, shootout } from '../../standings/__tests__/decisionTestKit';
import { testUuid } from '../../../test/testIds';

/** Team-IDs sind UUIDs (wie am Server, `standing_decision_valid`, A-13b-S Punkt 7). */
const TEAM_A = testUuid(1);
const TEAM_B = testUuid(2);

function fromConfig(config: object): Tournament {
  return mapTournamentFromSupabase(createTournamentRow({ config: JSON.parse(JSON.stringify(config)) as TournamentRow['config'] }), [], []);
}

function wireConfig(tournament: Tournament): Record<string, unknown> {
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  return (JSON.parse(JSON.stringify(tournamentRow)) as { config: Record<string, unknown> }).config;
}

const turnier = { ...league('RKMUNO', DATA.ET_055).tournament, sportId: 'football-indoor' };

describe("TB-3' Einstellung „Plätze ausspielen“ im config", () => {
  it('@W2A-066:teil ohne Angabe gilt nur Platz 1 (Cloud, lokal, Schema); eine gespeicherte Auswahl bleibt, auch „kein Platz“', () => {
    expect(fromConfig({}).placementsToPlayOut).toEqual([1]);
    expect(hydrateTournament({ ...turnier, placementsToPlayOut: undefined }).placementsToPlayOut).toEqual([1]);
    expect(TournamentSchema.safeParse(turnier).data?.placementsToPlayOut).toEqual([1]);

    for (const auswahl of [[1, 2, 3], [], [3]]) {
      const t = fromConfig({ placementsToPlayOut: auswahl });
      expect(t.placementsToPlayOut).toEqual(auswahl);
      expect(wireConfig(t).placementsToPlayOut).toEqual(auswahl);
      expect(hydrateTournament({ ...turnier, placementsToPlayOut: auswahl }).placementsToPlayOut).toEqual(auswahl);
      expect(TournamentSchema.safeParse({ ...turnier, placementsToPlayOut: auswahl }).data?.placementsToPlayOut).toEqual(auswahl);
    }
  });

  it('@W2A-066:teil ein unbrauchbarer Wert macht das Turnier nicht ungültig, es gilt die Voreinstellung', () => {
    for (const kaputt of ['1-3', [0], [1.5], [-2], null, { a: 1 }]) {
      expect(fromConfig({ placementsToPlayOut: kaputt }).placementsToPlayOut).toEqual([1]);
      expect(hydrateTournament({ ...turnier, placementsToPlayOut: kaputt }).placementsToPlayOut).toEqual([1]);
      const parsed = TournamentSchema.safeParse({ ...turnier, placementsToPlayOut: kaputt });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.placementsToPlayOut).toEqual([1]);
    }
  });

  it('@W2A-073 Platz 1 bis 6 angehakt, ein Team entfernt: angeboten und angehakt sind nur noch Platz 1 bis 5, ohne Fehler', () => {
    const sechs = jgj('RKMUNO', DATA.ET_055, [1, 2, 3, 4, 5, 6]);
    expect(offeredPlaces(sechs.teams)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(effectivePlacementsToPlayOut(sechs)).toEqual([1, 2, 3, 4, 5, 6]);

    const fuenf = { ...sechs, teams: sechs.teams.slice(0, 5) };
    expect(() => effectivePlacementsToPlayOut(fuenf)).not.toThrow();
    expect(offeredPlaces(fuenf.teams)).toEqual([1, 2, 3, 4, 5]);
    expect(effectivePlacementsToPlayOut(fuenf)).toEqual([1, 2, 3, 4, 5]);
    // Mehrere Gruppen: angeboten bis zur Teamzahl der größten Gruppe.
    const gruppen = [...sechs.teams.slice(0, 4).map((t) => ({ ...t, group: 'A' })), ...sechs.teams.slice(4).map((t) => ({ ...t, group: 'B' }))];
    expect(offeredPlaces(gruppen)).toEqual([1, 2, 3, 4]);
  });
});

const VERBOTEN = ['decidedBy', 'decidedAt', 'reason'];

describe("TB-3' Entscheidung im öffentlich lesbaren config ohne Person, Zeit, Grund", () => {
  it.each([
    { entscheidung: 'Strafstoßschießen 4:3 für DJK Otting (Nikolaus)', bau: () => nikolaus(), draft: shootout('D', 'P', 4, 3) },
    { entscheidung: '„Ergebnis so akzeptieren“ bei nur Platz 1 und 2 (Nikolaus)', bau: () => nikolaus([1, 2]), draft: shared(['P', 'D']) },
    { entscheidung: 'Reihenfolge Ufer, West, Ost mit Grund „Strafstoßschießen“ (@W2A-044)', bau: () => jgj('WOUMNB', DATA.W2A_044, [1, 2, 3]), draft: order(['U', 'W', 'O'], 'Strafstoßschießen') },
  ])('@W2A-072:teil $entscheidung: config-Eintrag ohne Person, Zeitpunkt und Grund', async ({ bau, draft }) => {
    const repo = new MemoryRepo(bau());
    expect((await repo.service().decide(repo.tournament.id, draft)).ok).toBe(true);
    const config = wireConfig({ ...repo.tournament, sportId: 'football-indoor' });
    const gespeichert = config.standingDecisions as Array<Record<string, unknown>>;
    expect(gespeichert).toHaveLength(1);
    for (const feld of VERBOTEN) {
      expect(gespeichert[0]).not.toHaveProperty(feld);
    }
    expect(JSON.stringify(gespeichert)).not.toMatch(/Strafstoßschießen|Olli|user-|\d{4}-\d{2}-\d{2}T/);
    // Gegenbeispiel: Reihenfolge und Ergebnis bleiben erhalten (die Tabelle braucht sie).
    expect(gespeichert[0]).toMatchObject({ kind: draft.kind, order: draft.order });
  });

  it('@W2A-072:teil Altwerte (Person, Zeit, Grund) aus dem config fallen beim Lesen weg und kommen beim nächsten Schreiben nicht zurück', () => {
    const alt = {
      id: 'e-1', groupId: '', teamIds: [TEAM_A, TEAM_B], order: [TEAM_B, TEAM_A], kind: 'shootout', shootout: { winner: 4, loser: 3 },
      decidedBy: { userId: 'user-olli', name: 'Olli' }, decidedAt: '2026-12-06T14:32:00.000Z', reason: 'Hallenzeit', basis: 'x',
    };
    const gelesen = fromConfig({ standingDecisions: [alt] });
    expect(gelesen.standingDecisions).toEqual([{ id: 'e-1', groupId: '', teamIds: [TEAM_A, TEAM_B], order: [TEAM_B, TEAM_A], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x' }]);
    const geschrieben = wireConfig(gelesen).standingDecisions as Array<Record<string, unknown>>;
    for (const feld of VERBOTEN) {
      expect(geschrieben[0]).not.toHaveProperty(feld);
    }
    expect(TournamentSchema.safeParse({ ...turnier, standingDecisions: [alt] }).data?.standingDecisions?.[0]).not.toHaveProperty('decidedBy');
    // Gegenbeispiel: ein anderes unbekanntes Feld macht die Entscheidung weiter ungültig (strikt).
    expect(fromConfig({ standingDecisions: [{ ...alt, spielerName: 'Max' }] }).standingDecisions).toEqual([]);
  });
});

describe("TB-3' Cloud-Schreibweg der Entscheidungen ohne Altwerte", () => {
  it('@W2A-072:teil eine lokal gespeicherte Entscheidung mit Person, Zeit und Grund kommt ohne diese Angaben ins config', async () => {
    let geschrieben: { config: { standingDecisions: Array<Record<string, unknown>> } } | undefined;
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { config: { andere: 1 }, version: 3 }, error: null }) }) }),
        update: (payload: typeof geschrieben) => {
          geschrieben = payload;
          return { eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 't1' }], error: null }) }) }) };
        },
      }),
    };
    const alt = {
      id: 'e-1', groupId: '', teamIds: [TEAM_A, TEAM_B], order: [TEAM_B, TEAM_A], kind: 'shared' as const, basis: 'x',
      decidedBy: { userId: 'user-olli', name: 'Olli' }, decidedAt: '2026-12-06T14:32:00.000Z', reason: 'Hallenzeit',
    };
    await writeStandingDecisionsToCloud(client as unknown as Parameters<typeof writeStandingDecisionsToCloud>[0], 't1', [alt], 3);
    expect(geschrieben?.config.standingDecisions).toEqual([{ id: 'e-1', groupId: '', teamIds: [TEAM_A, TEAM_B], order: [TEAM_B, TEAM_A], kind: 'shared', basis: 'x' }]);
    // Gegenbeispiel: das übrige config bleibt.
    expect(geschrieben?.config).toMatchObject({ andere: 1 });
  });
});
