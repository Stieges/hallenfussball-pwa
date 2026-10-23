/**
 * scripts/lib/engineSeed.ts — framework-freie Bausteine für den Engine-Seed (A-23, übernimmt C3b-3a).
 *
 * Der Seed schreibt Spiele ausschließlich über die RPC `append_match_events` (Owner-JWT). Die
 * RPC meldet Ablehnungen im Ergebnis (`results[]`) und nicht als Fehler -- deshalb prüft dieses
 * Modul jede Antwort laut (S2) und jede Seed-Vorbedingung mit einer klaren Meldung (S1, S3, S4,
 * S6/S7, S8). Keine Netzwerk- oder Datenbankzugriffe; alles ist rein und einzeln testbar.
 */

import type { EventType } from '../../src/core/match';

export interface SeedEventInput {
  key: string;
  type: EventType;
  side?: 'home' | 'away';
  atOffsetMs: number;
  payload?: Record<string, unknown>;
  targetKey?: string;
}

/** Ein Ereignis im Umschlag, den `append_match_events` erwartet (wie `MatchCommands.submit`). */
export interface SeedEnvelope {
  id: string;
  type: EventType;
  at: number;
  section: number;
  clockMs: number;
  teamId: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
}

export interface BuildEventsContext {
  slug: string;
  seedNow: number;
  homeTeamId: string;
  awayTeamId: string;
  idFor: (key: string) => string;
}

/** Mindestdauer eines Engine-Spiels, damit Auto-Finish im Test nie dazwischenfunkt (S4). */
export const MIN_DURATION_SECONDS = 3600;
/** Toleranz der gespeicherten MATCH_START-Zeit gegenüber `seedNow - 60 s` (S3). */
export const START_AT_TOLERANCE_MS = 2000;

/**
 * S3: baut die Umschläge. Zeiten streng aufsteigend und alle <= `seedNow` (der Server klemmt
 * `least(at, now)` und hebt ein früheres `at` still an). MATCH_START: section 1, clockMs 0.
 */
export function buildEngineEvents(specs: readonly SeedEventInput[], ctx: BuildEventsContext): SeedEnvelope[] {
  const idByKey = new Map(specs.map((spec) => [spec.key, ctx.idFor(spec.key)]));
  let previousAt = Number.NEGATIVE_INFINITY;
  let startAt: number | null = null;
  return specs.map((spec) => {
    const at = ctx.seedNow + spec.atOffsetMs;
    if (at > ctx.seedNow) {
      throw new Error(`Spiel ${ctx.slug}: Ereignis ${spec.key} liegt nach der Serverzeit des Seed-Laufs.`);
    }
    if (at <= previousAt) {
      throw new Error(`Spiel ${ctx.slug}: Ereignis ${spec.key} ist nicht streng aufsteigend (Zeit ${at} <= ${previousAt}).`);
    }
    previousAt = at;
    const isStart = spec.type === 'MATCH_START';
    if (isStart) {
      startAt = at;
    }
    if (!isStart && startAt === null) {
      throw new Error(`Spiel ${ctx.slug}: Ereignis ${spec.key} steht vor dem MATCH_START.`);
    }
    let teamId: string | null = null;
    if (spec.side === 'home') {
      teamId = ctx.homeTeamId;
    } else if (spec.side === 'away') {
      teamId = ctx.awayTeamId;
    }
    let targetId: string | null = null;
    if (spec.targetKey !== undefined) {
      const target = idByKey.get(spec.targetKey);
      if (target === undefined) {
        throw new Error(`Spiel ${ctx.slug}: Ereignis ${spec.key} verweist auf unbekanntes Ziel ${spec.targetKey}.`);
      }
      targetId = target;
    }
    return {
      id: idByKey.get(spec.key) ?? ctx.idFor(spec.key),
      type: spec.type,
      at,
      section: 1,
      clockMs: isStart ? 0 : at - (startAt ?? at),
      teamId,
      targetId,
      payload: spec.payload ? { ...spec.payload } : {},
    };
  });
}

export interface AppendResponseLike {
  error?: string;
  results?: ReadonlyArray<{ id: string | null; status: string; code?: string }>;
}

/** S2: wirft bei `CLIENT_OUTDATED` und bei jedem Ergebnis, das nicht `accepted` ist. */
export function assertAllAccepted(slug: string, events: readonly SeedEnvelope[], response: AppendResponseLike): void {
  if (response.error === 'CLIENT_OUTDATED') {
    throw new Error(`Spiel ${slug}: append_match_events meldet CLIENT_OUTDATED (min_client_format zu hoch für den Seed).`);
  }
  const results = response.results ?? [];
  if (results.length !== events.length) {
    throw new Error(`Spiel ${slug}: ${events.length} Ereignisse gesendet, aber ${results.length} Ergebnisse erhalten.`);
  }
  events.forEach((event, index) => {
    const result = results[index];
    if (result.status !== 'accepted') {
      throw new Error(
        `Spiel ${slug}: Ereignis ${event.type} (${event.id}) nicht angenommen: Status ${result.status}, Code ${result.code ?? '-'}.`
      );
    }
  });
}

/** S1: beide Team-IDs müssen gesetzt und gleich den Seed-Team-IDs sein. */
export function assertTeamsSet(
  slug: string,
  row: { team_a_id: string | null; team_b_id: string | null },
  expected: { homeTeamId: string; awayTeamId: string }
): void {
  if (row.team_a_id !== expected.homeTeamId || row.team_b_id !== expected.awayTeamId) {
    throw new Error(`Spiel ${slug}: team_a_id/team_b_id leer oder abweichend (A=${row.team_a_id}, B=${row.team_b_id}) – Spielseiten ohne Team-Referenz?`);
  }
}

/** S3: die gespeicherte MATCH_START-Zeit liegt bei `seedNow - 60 s` (± Toleranz). */
export function assertStartAtNearSeed(slug: string, storedAtMs: number, seedNow: number, startOffsetMs: number): void {
  const expected = seedNow + startOffsetMs;
  if (Math.abs(storedAtMs - expected) > START_AT_TOLERANCE_MS) {
    throw new Error(`Spiel ${slug}: MATCH_START gespeichert bei ${storedAtMs}, erwartet ${expected} ± ${START_AT_TOLERANCE_MS} (Serverzeit-Basis ${seedNow}).`);
  }
}

function readNumber(source: unknown, key: string): number | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

/** S4 (running): `live_state` nach dem MATCH_START trägt >= 3600 s und genau einen Abschnitt. */
export function assertRunningDuration(slug: string, liveState: unknown): void {
  const duration = readNumber(liveState, 'durationSeconds');
  const sections = readNumber(liveState, 'sections');
  if (duration === null || duration < MIN_DURATION_SECONDS || sections !== 1) {
    throw new Error(`Spiel ${slug}: Dauer-Assertion verletzt (durationSeconds=${duration}, sections=${sections}; erwartet >= ${MIN_DURATION_SECONDS} und 1).`);
  }
}

/** S4 (finished): `live_state` ist NULL, geprüft wird die gespeicherte MATCH_START-Zeile. */
export function assertFinishedDuration(slug: string, startPayload: unknown): void {
  const rules = typeof startPayload === 'object' && startPayload !== null ? (startPayload as Record<string, unknown>).rules : null;
  const sections = readNumber(rules, 'sections');
  const sectionSeconds = readNumber(rules, 'sectionSeconds');
  if (sections === null || sectionSeconds === null || sections * sectionSeconds < MIN_DURATION_SECONDS) {
    throw new Error(`Spiel ${slug}: Dauer-Assertion verletzt (sections=${sections}, sectionSeconds=${sectionSeconds}; Produkt < ${MIN_DURATION_SECONDS}).`);
  }
}

/** S4 (untouched) und S8 (Altspiel): erwarteter Status, Anzahl Engine-Zeilen. */
export function assertStateAndEngineRows(
  slug: string,
  actual: { status: string | null; engineRows: number },
  expected: { status: string; engineRows: number }
): void {
  if (actual.status !== expected.status || actual.engineRows !== expected.engineRows) {
    throw new Error(
      `Spiel ${slug}: Zustand weicht ab (Status ${actual.status}, Engine-Zeilen ${actual.engineRows}; erwartet ${expected.status}, ${expected.engineRows}).`
    );
  }
}

export interface FieldMatchLike {
  id: string;
  field: number;
  slot: number;
  status: string | null;
}

/**
 * S6/S7: das Engine-Laufspiel liegt auf Feld 1, und jedes Feld-1-Spiel mit kleinerem Slot ist
 * beendet -- sonst träfe die Auto-Auswahl des Cockpits ein anderes Spiel.
 */
export function assertAutoSelectHitsEngineMatch(cupName: string, matches: readonly FieldMatchLike[], engineMatchId: string): void {
  const engineMatch = matches.find((match) => match.id === engineMatchId);
  if (!engineMatch || engineMatch.field !== 1) {
    throw new Error(`${cupName}: Auto-Auswahl träfe nicht das Engine-Laufspiel (liegt nicht auf Feld 1).`);
  }
  const blocker = matches.find((match) => match.field === 1 && match.slot < engineMatch.slot && match.status !== 'finished');
  if (blocker) {
    throw new Error(`${cupName}: Auto-Auswahl träfe ${blocker.id}, nicht das Engine-Laufspiel.`);
  }
}
