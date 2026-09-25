/**
 * tests/e2e/cloud/protect-matches-with-events.cloud.spec.ts — Cloud-Nachweis für A6
 * (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md, Befund C-K6; Fixrunde 1,
 * task-A6-review.md, I2/Ruling AN): "owner speichert einen Spielplan, in dem ein Spiel mit
 * Ereignissen fehlt → Spiel + Ereignisse bleiben, der Rest wird gespeichert, ein sichtbarer
 * Hinweis erscheint (KEIN dauerhafter Fehler in der Warteschlange)." Zusätzlich ein Cloud-Nachweis
 * für die geänderte `SupabaseRepository.delete()` (I3): ein Turnier mit Spielen UND Ereignissen
 * lässt sich vollständig löschen (Kaskade).
 *
 * Läuft nur in den `cloud-*`-Projekten, braucht einen laufenden lokalen Stack MIT der neuen
 * Migration (`20260925_002_protect_matches_with_events.sql`, `npm run test:env:up`/`:reset`
 * spielt sie automatisch mit ein, siehe `scripts/lib/migrations-since-baseline.sh`).
 *
 * Eigene, komplett selbst angelegte Turnier-Fixtures (nicht einer der geteilten Seed-Turniere aus
 * `testData.ts`) -- laufen parallel zu jedem anderen Cloud-Spec, ohne dessen Daten zu berühren.
 * Rückbau im `finally`: EIN service-role-DELETE auf die jeweilige Turnierzeile reicht (Kaskade).
 *
 * Wie der fehlende Spielplan-Eintrag entsteht: Es gibt aktuell KEINEN normalen UI-Pfad, der ein
 * bereits erfasstes, mit Ereignissen versehenes Spiel aus einem veröffentlichten Turnier entfernt
 * (Team-Entfernen ist nur im Wizard VOR der Veröffentlichung möglich, siehe task-A6-report.md) --
 * genau das ist der Kern von C-K6: das Szenario ist ein Gerät mit veralteter lokaler Spielliste,
 * kein normaler Klickpfad. Der erste Test bildet GENAU das nach: Er baut über die ECHTE
 * App-Mapping-Funktion (`mapTournamentFromSupabase`, dieselbe, die `OfflineRepository` beim Laden
 * benutzt) ein echtes `Tournament`-Domainobjekt aus den tatsächlichen DB-Zeilen, OHNE das Spiel
 * mit dem Ereignis -- und legt es als `SAVE_TOURNAMENT`-Mutation in `localStorage['mutation_queue_v1']`
 * ab (derselbe Speicherort, den `GenericMutationQueue` selbst verwendet, siehe
 * `MutationQueue.ts#storageKey`). Ein Seiten-Reload lässt die ECHTE `MutationQueue` diese Mutation
 * verarbeiten -- ab hier läuft der komplette Produktionscode (`GenericMutationQueue.process()` →
 * `MutationQueue.execute()` → `SupabaseRepository.save()`) unverändert gegen den lokalen Stack.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
import { E2E_USERS } from './testData';
import { mapTournamentFromSupabase } from '../../../src/core/repositories/supabaseMappers';
import type { Database } from '../../../src/types/supabase';

type TournamentRow = Database['public']['Tables']['tournaments']['Row'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];

async function fetchOwnerId(url: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(
    `${url}/rest/v1/profiles?email=eq.${encodeURIComponent(E2E_USERS.owner.email)}&select=id`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`Owner-Profil-Lookup fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  const ownerId = rows[0]?.id;
  if (!ownerId) {
    throw new Error('Owner-Profil nicht gefunden (E2E-Seed nicht gelaufen?).');
  }
  return ownerId;
}

test('Owner speichert einen Spielplan ohne ein Spiel mit Ereignissen: Spiel + Ereignisse bleiben, Rest wird gespeichert, sichtbarer Hinweis (A6, Ruling AN)', async ({
  asRole,
}) => {
  const { url, headers } = getLocalServiceRoleClient();
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  const tournamentId = randomUUID();
  const teamAId = randomUUID();
  const teamBId = randomUUID();
  const matchKeepId = randomUUID(); // bleibt im lokalen Spielplan, bekommt eine neue field-Nummer -- muss durchgespeichert werden
  const matchStaleId = randomUUID(); // fehlt im "veralteten" lokalen Spielplan, hat bereits ein Ereignis

  try {
    // --- 1. Fixture per Service-Role anlegen (RLS umgangen, wie in allen Cloud-Specs) --------
    const ownerId = await fetchOwnerId(url, headers);

    const tournamentRes = await fetch(`${url}/rest/v1/tournaments`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: tournamentId,
        owner_id: ownerId,
        status: 'published',
        title: 'A6 E2E — Spiel mit Ereignissen',
        date: '2026-09-25',
        // Gefunden beim Bau dieses Tests, unabhängig von A6 (nicht hier behoben, siehe Report
        // "Bedenken"): supabaseMappers.ts liest ein NULL start_time als `timeSlot: ''` (Zeile
        // ~543, `row.start_time ?? ''`), und schreibt beim Zurückspeichern
        // `tournament.startTime ?? tournament.timeSlot ?? null` (Zeile ~668) -- eine leere
        // Zeichenkette ist NICHT nullish, also landet '' statt null im UPDATE und Postgres lehnt
        // "invalid input syntax for type time" ab. Ein echter, per Wizard angelegter Tournament
        // hat immer eine start_time; dieser direkt per Service-Role angelegte Test-Fixture braucht
        // sie deshalb explizit, um denselben Rundweg (DB lesen -> mapTournamentFromSupabase ->
        // mapTournamentToSupabase -> DB schreiben) fehlerfrei zu durchlaufen wie ein echtes Gerät.
        start_time: '10:00:00',
        number_of_teams: 2,
        group_phase_duration: 15,
        config: { publishedAt: new Date().toISOString() },
      }),
    });
    if (!tournamentRes.ok) {
      throw new Error(`Turnier anlegen fehlgeschlagen: ${tournamentRes.status} ${await tournamentRes.text()}`);
    }

    const teamsRes = await fetch(`${url}/rest/v1/teams`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify([
        { id: teamAId, tournament_id: tournamentId, name: 'A6 Team A' },
        { id: teamBId, tournament_id: tournamentId, name: 'A6 Team B' },
      ]),
    });
    if (!teamsRes.ok) {
      throw new Error(`Teams anlegen fehlgeschlagen: ${teamsRes.status} ${await teamsRes.text()}`);
    }

    const matchesRes = await fetch(`${url}/rest/v1/matches`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify([
        {
          id: matchKeepId,
          tournament_id: tournamentId,
          round: 1,
          field: 1,
          match_number: 1,
          team_a_id: teamAId,
          team_b_id: teamBId,
          match_status: 'scheduled',
        },
        {
          id: matchStaleId,
          tournament_id: tournamentId,
          round: 1,
          field: 2,
          match_number: 2,
          team_a_id: teamAId,
          team_b_id: teamBId,
          match_status: 'scheduled',
        },
      ]),
    });
    if (!matchesRes.ok) {
      throw new Error(`Spiele anlegen fehlgeschlagen: ${matchesRes.status} ${await matchesRes.text()}`);
    }

    const eventRes = await fetch(`${url}/rest/v1/match_events`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: randomUUID(),
        match_id: matchStaleId,
        type: 'GOAL',
        timestamp_seconds: 42,
        score_home: 1,
        score_away: 0,
      }),
    });
    if (!eventRes.ok) {
      throw new Error(`Ereignis anlegen fehlgeschlagen: ${eventRes.status} ${await eventRes.text()}`);
    }

    // --- 2. Echte DB-Zeilen lesen und über die ECHTE App-Mapping-Funktion in ein Tournament-
    //        Domainobjekt verwandeln -- OHNE matchStaleId (der fehlende Spielplan-Eintrag), aber
    //        MIT einer geänderten Feld-Nummer für matchKeepId (field 1 -> 3), damit sich auch
    //        prüfen lässt, dass der Rest des Spielplans WIRKLICH gespeichert wird (Ruling AN:
    //        "alles andere speichert save() vollständig"), nicht nur "wirft nicht mehr". ---
    const [tournamentRowRes, teamRowsRes, matchRowsRes] = await Promise.all([
      fetch(`${url}/rest/v1/tournaments?id=eq.${tournamentId}&select=*`, { headers }),
      fetch(`${url}/rest/v1/teams?tournament_id=eq.${tournamentId}&select=*`, { headers }),
      fetch(`${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&select=*`, { headers }),
    ]);
    if (!tournamentRowRes.ok || !teamRowsRes.ok || !matchRowsRes.ok) {
      throw new Error('Fixture-Zeilen konnten nicht zurückgelesen werden.');
    }
    const tournamentRow = ((await tournamentRowRes.json()) as TournamentRow[])[0];
    const teamRows = (await teamRowsRes.json()) as TeamRow[];
    const allMatchRows = (await matchRowsRes.json()) as MatchRow[];
    if (!tournamentRow) {
      throw new Error('Turnierzeile nach dem Anlegen nicht gefunden.');
    }

    const staleMatchRows = allMatchRows
      .filter((m) => m.id !== matchStaleId) // <- der fehlende Spielplan-Eintrag
      .map((m) => (m.id === matchKeepId ? { ...m, field: 3 } : m)); // <- echte Planänderung, muss ankommen

    const mappedStalePayload = mapTournamentFromSupabase(tournamentRow, teamRows, staleMatchRows);
    // `version` bewusst entfernt: ohne sie nimmt `SupabaseRepository.save()` den
    // Legacy/Fallback-Zweig (blindes Upsert statt Optimistic-Locking-Vergleich) -- robuster
    // gegen einen möglichen Wettlauf mit `useInitialSync.ts#syncLocalToCloud`, das beim ALLERERSTEN
    // Laden einer der App noch unbekannten Seite ebenfalls die Turnierzeile anfasst (beobachtet:
    // ein `OptimisticLockError`, wenn `version` gesetzt blieb -- nicht Teil dessen, was A6 hier
    // beweisen soll). A6 selbst betrifft ausschließlich die matches-Behandlung weiter unten in
    // save(), nicht den Tournament-Zeilen-Schritt.
    const { version: _unusedVersion, ...stalePayload } = mappedStalePayload;

    // --- 3. Die veraltete SAVE_TOURNAMENT-Mutation VOR dem ersten Laden der Seite injizieren
    //        (`addInitScript`, läuft vor jedem Seitenskript inkl. der App selbst) -- EIN einziger
    //        Seitenaufbau statt "leer laden, dann neu laden": vermeidet einen zweiten,
    //        überflüssigen Initial-Sync-Durchlauf für dasselbe, der App bis dahin unbekannte
    //        Turnier (beobachtet: ein doppelt sichtbarer Toast bzw. ein zweiter, race-bedingter
    //        Fehler bei einem separaten Spiel-Update, wenn zwei Ladevorgänge aufeinanderfolgten).
    //        Die echte MutationQueue lädt `mutation_queue_v1` beim App-Start und verarbeitet es
    //        sofort (`if (navigator.onLine) { void this.process(); }`, GenericMutationQueue.ts). ---
    const ownerPage = await asRole('owner');
    await ownerPage.addInitScript((payload) => {
      const item = {
        id: 'a6-e2e-stale-save',
        type: 'SAVE_TOURNAMENT',
        payload,
        timestamp: Date.now(),
        retryCount: 0,
      };
      window.localStorage.setItem('mutation_queue_v1', JSON.stringify([item]));
    }, stalePayload);

    // --- 4. Sichtbarer Hinweis (I2, Ruling AN) -- ein Toast (role="alert"), KEIN dauerhafter
    //        Fehler in der Warteschlange. ---
    await ownerPage.goto(`/#/tournament/${tournamentId}/admin`);
    // `.first()`: React.StrictMode (main.tsx, nur im `npm run dev`-Server dieser Cloud-Projekte
    // aktiv, siehe playwright.config.ts) doppelt-invoked Effects/Renders und lässt hier bewusst
    // zwei MutationQueue-Instanzen kurz nebeneinander laufen -- in der Produktion (kein
    // StrictMode) verarbeitet genau EINE Instanz die Mutation einmal. Für diesen Test zählt nur:
    // MINDESTENS ein sichtbarer, korrekt formulierter Hinweis -- nicht die exakte Anzahl.
    const toast = ownerPage.getByRole('alert').filter({ hasText: 'Spiel 2' }).first();
    await expect(toast).toBeVisible({ timeout: 20000 });
    await expect(toast).toContainText('hat Einträge und wurde nicht gelöscht');

    // --- 5. Die Mutation gilt als ERFOLGREICH -- keine Dead-Letter-Anzeige (Ruling AN: das darf
    //        kein dauerhafter Fehler sein). Projekt-unabhängig über localStorage geprüft statt
    //        über `[data-testid="sync-status"]` -- AdminHeader (mit SyncStatusIndicator) sitzt
    //        hinter einer Spoke-Hub-Navigation auf `cloud-mobile`, die ohne einen zusätzlichen
    //        Klickpfad nicht erreichbar ist; der Toast (Schritt 4) und die DB-Zeilen (Schritt 6/7)
    //        sind der eigentliche, projektunabhängige Beleg. ---
    const failedTypesAfter = await ownerPage.evaluate(() => {
      const raw = window.localStorage.getItem('mutation_queue_failed_v1');
      if (!raw) { return []; }
      const parsed = JSON.parse(raw) as Array<{ id?: string }>;
      return parsed.map((item) => item.id).filter((id): id is string => typeof id === 'string');
    });
    expect(failedTypesAfter).not.toContain('a6-e2e-stale-save');

    // --- 6. Spiel + Ereignis stehen unverändert in der DB (nicht still gelöscht) ---------------
    const matchAfterRes = await fetch(
      `${url}/rest/v1/matches?id=eq.${matchStaleId}&select=id,field`,
      { headers }
    );
    const matchAfter = (await matchAfterRes.json()) as Array<{ id: string; field: number }>;
    expect(matchAfter).toHaveLength(1);
    expect(matchAfter[0]?.field).toBe(2); // unverändert -- die "stale" payload hatte es gar nicht mehr

    const eventsAfterRes = await fetch(
      `${url}/rest/v1/match_events?match_id=eq.${matchStaleId}&select=id`,
      { headers }
    );
    const eventsAfter = (await eventsAfterRes.json()) as Array<{ id: string }>;
    expect(eventsAfter).toHaveLength(1);

    // --- 7. Der Rest des Spielplans wurde WIRKLICH gespeichert (Ruling AN: "alles andere
    //        speichert save() vollständig") -- matchKeepId's field-Änderung kam an. ---
    const keepAfterRes = await fetch(
      `${url}/rest/v1/matches?id=eq.${matchKeepId}&select=field`,
      { headers }
    );
    const keepAfter = (await keepAfterRes.json()) as Array<{ field: number }>;
    expect(keepAfter[0]?.field).toBe(3);
  } finally {
    // Kaskade (A6): eine DELETE-Anweisung auf die Turnierzeile reicht -- matches/teams/match_events
    // hängen alle per Fremdschlüssel daran. Läuft auch dann sauber durch, wenn matchStaleId noch
    // Ereignisse hat (pg_trigger_depth() > 1 im Trigger).
    await safeCleanup('A6 E2E: Turnier-Fixture zurückbauen', async () => {
      const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${tournamentId}`, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' },
      });
      if (!res.ok) {
        throw new Error(`Rückbau fehlgeschlagen: ${res.status} ${await res.text()}`);
      }
    });
  }
});

test('Owner löscht ein Turnier mit Spielen UND Ereignissen vollständig (A6/I3, delete()-Kaskade)', async ({
  asRole,
}) => {
  const { url, headers } = getLocalServiceRoleClient();
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  const tournamentId = randomUUID();
  const matchId = randomUUID();

  try {
    const ownerId = await fetchOwnerId(url, headers);

    const tournamentRes = await fetch(`${url}/rest/v1/tournaments`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: tournamentId,
        owner_id: ownerId,
        status: 'published',
        title: 'A6 E2E — delete() Kaskade',
        date: '2026-09-25',
        number_of_teams: 2,
        group_phase_duration: 15,
        config: { publishedAt: new Date().toISOString() },
      }),
    });
    if (!tournamentRes.ok) {
      throw new Error(`Turnier anlegen fehlgeschlagen: ${tournamentRes.status} ${await tournamentRes.text()}`);
    }

    const matchRes = await fetch(`${url}/rest/v1/matches`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: matchId,
        tournament_id: tournamentId,
        round: 1,
        field: 1,
        match_number: 1,
        match_status: 'scheduled',
      }),
    });
    if (!matchRes.ok) {
      throw new Error(`Spiel anlegen fehlgeschlagen: ${matchRes.status} ${await matchRes.text()}`);
    }

    const eventRes = await fetch(`${url}/rest/v1/match_events`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        id: randomUUID(),
        match_id: matchId,
        type: 'GOAL',
        timestamp_seconds: 10,
        score_home: 1,
        score_away: 0,
      }),
    });
    if (!eventRes.ok) {
      throw new Error(`Ereignis anlegen fehlgeschlagen: ${eventRes.status} ${await eventRes.text()}`);
    }

    // Über die echte MutationQueue -- derselbe Mechanismus wie oben, hier für DELETE_TOURNAMENT
    // (OfflineRepository.delete() -> mutationQueue.enqueue('DELETE_TOURNAMENT', id), MutationQueue.ts).
    // Kein UI-Klickpfad: DangerZones "Turnier löschen" ist Soft-Delete (deletedAt), der harte
    // delete() läuft in der App erst über "Papierkorb leeren" (DashboardScreen) -- funktional
    // exakt derselbe Repository-Aufruf, hier direkt über die Queue ausgelöst, um die zusätzliche
    // Soft-Delete-Vorstufe nicht extra durchklicken zu müssen.
    const ownerPage = await asRole('owner');
    await ownerPage.goto('/#/');
    await ownerPage.waitForLoadState('networkidle');

    await ownerPage.evaluate((id) => {
      const item = {
        id: 'a6-e2e-delete-tournament',
        type: 'DELETE_TOURNAMENT',
        payload: id,
        timestamp: Date.now(),
        retryCount: 0,
      };
      window.localStorage.setItem('mutation_queue_v1', JSON.stringify([item]));
    }, tournamentId);

    await ownerPage.reload();
    await ownerPage.waitForLoadState('networkidle');

    // Kein `sync-status`-Element auf dem Dashboard (SyncStatusIndicator sitzt nur im AdminHeader/
    // LiveCockpit, siehe App.tsx) -- und nach dem Löschen wäre die Admin-Seite dieses Turniers
    // ohnehin weg. Definitiver Beleg statt UI-Status: die Turnierzeile ist in der DB verschwunden
    // (expect.poll, die MutationQueue verarbeitet nach dem Reload asynchron).
    await expect.poll(
      async () => {
        const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${tournamentId}&select=id`, { headers });
        return ((await res.json()) as unknown[]).length;
      },
      { message: 'Turnierzeile sollte nach der DELETE_TOURNAMENT-Mutation verschwunden sein', timeout: 20000 }
    ).toBe(0);

    // Spiel UND Ereignis sind ebenfalls vollständig weg (Kaskade) -- keine Waise.
    const matchAfterRes = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}&select=id`, { headers });
    expect((await matchAfterRes.json()) as unknown[]).toHaveLength(0);

    const eventsAfterRes = await fetch(
      `${url}/rest/v1/match_events?match_id=eq.${matchId}&select=id`,
      { headers }
    );
    expect((await eventsAfterRes.json()) as unknown[]).toHaveLength(0);
  } finally {
    // Falls der Test VOR dem eigentlichen delete() scheitert, bleibt die Turnierzeile stehen --
    // dann räumt dieselbe Kaskade sie hier auf. Ist sie schon weg (Erfolgsfall), ist das ein
    // no-op (DELETE auf 0 Zeilen ist kein Fehler).
    await safeCleanup('A6 E2E: delete()-Kaskade-Fixture zurückbauen (falls noch vorhanden)', async () => {
      const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${tournamentId}`, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' },
      });
      if (!res.ok) {
        throw new Error(`Rückbau fehlgeschlagen: ${res.status} ${await res.text()}`);
      }
    });
  }
});
