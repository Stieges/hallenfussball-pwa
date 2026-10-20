/**
 * tests/e2e/cloud/schreibweg-nur-ereignisse.cloud.spec.ts — A-08g: der Server nimmt Spielstand nur über
 * Ereignisse an (@FU-084, @FU-085) und Nachträge nach dem Abpfiff (@FU-056). Echter Weg: Oberfläche
 * (Nachtrag), RPC und direkte REST-Aufrufe mit dem Schlüssel von Tom (Helfer) bzw. Olli (Eigentümer),
 * Gegenprobe per Service-Role.
 *
 * Direktweg-INSERT (Befund C-MATCH-EVENTS-DIREKTWEG, geschlossen mit A-08h): ein Alt-Format-Eintrag wird von
 * der Datenbank abgelehnt, weil anon/authenticated kein Tabellenrecht auf match_events mehr haben (42501).
 * Nur cloud-desktop (je Test ein eigener Engine-Cup, Seed wird verbraucht).
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import {
  appendAsRole,
  engineCupTarget,
  expectSeededEngineMatch,
  fetchEngineRows,
  openCockpit,
  type AppendAsRoleEvent,
} from './engineHelpers';
import { fetchMatchRow } from './helpers';
import { restAsRole, serviceRest } from './restAsRole';
import { engineCupIds, engineEventId, type EngineCupSlug } from './testData';

function goal(teamId: string, clockMs: number): AppendAsRoleEvent {
  return { id: randomUUID(), type: 'GOAL', at: Date.now(), section: 1, clockMs, teamId, targetId: null, payload: {} };
}

async function expectScore(matchId: string, scoreA: number, scoreB: number, status: string): Promise<void> {
  const row = await fetchMatchRow(matchId);
  expect([row.score_a, row.score_b, row.match_status]).toEqual([scoreA, scoreB, status]);
}

function legacyGoalRow(matchId: string): Record<string, unknown> {
  return { id: randomUUID(), match_id: matchId, type: 'GOAL', timestamp_seconds: 42, score_home: 5, score_away: 0 };
}

async function insertLegacyGoalAsHelper(slug: EngineCupSlug): Promise<{ rowId: string; status: number }> {
  const row = legacyGoalRow(engineCupIds(slug).matchId);
  const res = await restAsRole('helper', 'POST', 'match_events', row);
  return { rowId: row.id as string, status: res.status };
}

async function legacyRowCount(rowId: string): Promise<number> {
  return ((await serviceRest('GET', `match_events?id=eq.${rowId}&select=id`)).json as unknown[]).length;
}

test.describe('Schreibweg nur über Ereignisse', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  test('@FU-084 beendetes Spiel: ein Tor über die Schnittstelle wird abgelehnt, der Spielstand bleibt', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    const seeded = await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const answer = await appendAsRole('helper', ids.matchId, [goal(ids.homeTeamId, 61000)]);
    expect(answer.results[0].status).toBe('rejected');
    test.info().annotations.push({ type: 'Ablehnungsgrund', description: String(answer.results[0].code) });
    await expectScore(ids.matchId, 1, 1, 'finished');
    expect((await fetchEngineRows(ids.matchId)).length).toBe(seeded);
  });

  test('@FU-084 Gegenbeispiel: laufendes Spiel nimmt dasselbe Tor an (die Ablehnung hängt am Zustand)', async () => {
    const ids = engineCupIds('SCHREIBWEGLAUF');
    await expectSeededEngineMatch(engineCupTarget('SCHREIBWEGLAUF'));
    const answer = await appendAsRole('helper', ids.matchId, [goal(ids.homeTeamId, 61000)]);
    expect(answer.results[0].status).toBe('accepted');
    await expect.poll(async () => (await fetchMatchRow(ids.matchId)).score_a, { timeout: 10000 }).toBe(2);
  });

  // A-11 Fixrunde 3 (Gegenteil-Pin umgeschrieben, nicht gelöscht): vorher „Helfer-PATCH → 42501 vom Spaltenwächter“.
  // Seit 20261110_001 (matches_update_v4 = manageSchedule) lässt RLS den Helfer gar nicht an die Zeile: 200 mit 0 Zeilen.
  // @FU-084 verlangt nur „die Datenbank speichert nichts, der Spielstand bleibt“ -- das gilt auf beiden Wegen. Den
  // Spaltenwächter selbst belegt die Gegenprobe darunter mit einer Rolle, die RLS durchlässt (Olli, manageSchedule).
  test('@FU-084 Spalten-PATCH auf matches.score_a durch den Helfer: die Datenbank speichert nichts, der Spielstand bleibt', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const res = await restAsRole('helper', 'PATCH', `matches?id=eq.${ids.matchId}`, { score_a: 7 });
    const rejected = res.status >= 400;
    const noRowWritten = res.status < 300 && Array.isArray(res.json) && res.json.length === 0;
    expect(rejected || noRowWritten, `${res.status} ${res.text}`).toBe(true);
    await expectScore(ids.matchId, 1, 1, 'finished');
  });

  test('@FU-084 Gegenprobe Spaltenwächter: auch Olli (RLS lässt ihn an die Zeile) kann score_a nicht direkt setzen (42501)', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const res = await restAsRole('owner', 'PATCH', `matches?id=eq.${ids.matchId}`, { score_a: 7 });
    expect(res.status, res.text).toBeGreaterThanOrEqual(400);
    expect(res.text).toContain('42501');
    await expectScore(ids.matchId, 1, 1, 'finished');
  });

  test('@FU-084 Direktweg-INSERT einer Alt-Format-GOAL-Zeile ändert den Spielstand nicht', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const { rowId } = await insertLegacyGoalAsHelper('SCHREIBWEG');
    try {
      await expectScore(ids.matchId, 1, 1, 'finished');
    } finally {
      await serviceRest('DELETE', `match_events?id=eq.${rowId}`);
    }
  });

  test('@FU-084 Direktweg-INSERT einer Alt-Format-GOAL-Zeile wird abgelehnt und nicht gespeichert', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const { rowId, status } = await insertLegacyGoalAsHelper('SCHREIBWEG');
    const stored = await legacyRowCount(rowId);
    await serviceRest('DELETE', `match_events?id=eq.${rowId}`);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(stored).toBe(0);
    // Gherkin @FU-084: „Und der Spielstand bleibt unverändert“.
    await expectScore(ids.matchId, 1, 1, 'finished');
  });

  test('@FU-085 Eine Engine-Zeile lässt sich per UPDATE und DELETE nicht ändern (Eigentümer und Helfer)', async () => {
    const ids = engineCupIds('SCHREIBWEG');
    const seeded = await expectSeededEngineMatch(engineCupTarget('SCHREIBWEG'));
    const goalId = engineEventId('SCHREIBWEG', 'goal-home');
    const target = `match_events?id=eq.${goalId}`;

    const ownerPatch = await restAsRole('owner', 'PATCH', target, { payload: { playerNumber: 99 } });
    expect(ownerPatch.status, ownerPatch.text).toBeGreaterThanOrEqual(400);
    expect(ownerPatch.text).toContain('42501');
    const ownerDelete = await restAsRole('owner', 'DELETE', target);
    expect(ownerDelete.status, ownerDelete.text).toBeGreaterThanOrEqual(400);
    expect(ownerDelete.text).toContain('42501');
    // Helfer (A-08h): ebenfalls hart 42501, das Tabellenrecht ist für alle Client-Rollen entzogen.
    for (const res of [await restAsRole('helper', 'PATCH', target, { payload: { playerNumber: 98 } }), await restAsRole('helper', 'DELETE', target)]) {
      expect(res.status, res.text).toBeGreaterThanOrEqual(400);
      expect(res.text).toContain('42501');
    }

    const rows = await fetchEngineRows(ids.matchId);
    expect(rows.length).toBe(seeded);
    expect(rows.find((row) => row.id === goalId)?.payload).toMatchObject({ playerNumber: 7 });
    await expectScore(ids.matchId, 1, 1, 'finished');
  });

  test('@FU-056 Helfer trägt nach dem Abpfiff die fehlende Rückennummer nach, der Stand bleibt; gesetzte Nummer ist gesperrt', async ({ asRole }) => {
    const ids = engineCupIds('NACHTRAG');
    const seeded = await expectSeededEngineMatch(engineCupTarget('NACHTRAG'));
    const goalHomeId = engineEventId('NACHTRAG', 'goal-home');
    const goalAwayId = engineEventId('NACHTRAG', 'goal-away');
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expect(helperPage.locator('[data-testid="scoreboard-state"]')).toHaveText('Ende', { timeout: 15000 });

    // Gegenbeispiel: die schon gesetzte Nummer 7 ist gesperrt, es entsteht kein Eintrag.
    await helperPage.getByRole('button', { name: `TOR ${ids.homeTeamName} #7 bearbeiten` }).click();
    await expect(helperPage.locator('[data-testid="event-edit-locked"]')).toHaveText('Korrektur nur durch die Turnierleitung');
    await helperPage.keyboard.press('Escape');
    expect((await fetchEngineRows(ids.matchId)).length).toBe(seeded);

    // Die fehlende Nummer lässt sich ergänzen.
    await helperPage.getByRole('button', { name: `TOR ${ids.awayTeamName} bearbeiten` }).click();
    await helperPage.locator('[data-testid="event-edit-number"]').fill('9');
    await helperPage.locator('[data-testid="event-edit-save"]').click();
    await expect.poll(async () => (await fetchEngineRows(ids.matchId)).slice(seeded).map((row) => [row.type, row.target_event_id]), { timeout: 10000 }).toEqual([['AMEND', goalAwayId]]);
    await expectScore(ids.matchId, 1, 1, 'finished');
    await helperPage.reload();
    await helperPage.waitForLoadState('networkidle');
    await expect(helperPage.getByText(`TOR ${ids.awayTeamName} #9`)).toBeVisible({ timeout: 15000 });

    // Server: dieselbe Nachtragung auf die gesetzte Nummer lehnt er für den Helfer ab.
    const locked = await appendAsRole('helper', ids.matchId, [
      { id: randomUUID(), type: 'AMEND', at: Date.now(), section: 1, clockMs: 0, teamId: null, targetId: goalHomeId, payload: { playerNumber: 8 } },
    ]);
    expect(locked.results[0].status).toBe('rejected');
  });
});
