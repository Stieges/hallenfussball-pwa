/**
 * A-08f3a (Plan `task-A-08f3-plan.md` v3 § 2.1/§ 2.2): Spielfelder, die der Server führt.
 *
 * Der Client schreibt diese Spalten für bestehende Spiele nie in die Cloud (`mapMatchUpdateToSupabase`
 * entfernt sie). Sie entstehen am Server aus den Einträgen (`append_match_events` → `cache_columns`), der
 * dabei `matches.version` je Spiel erhöht. Die lokale Kopie ist für diese Felder nur Zwischenspeicher.
 * Bewusst NICHT dabei: Uhrfelder (gehören der Engine), Spielplan-Spalten (Versionsweg), Verlauf/Ereignisse.
 *
 * Regel S Stufe 1 (bis A-08f3e4): Übernahme für ein Spiel ⇔ Cloud-Revision > 1 und ≥ der zuletzt
 * übernommenen Revision (Monotonie). Revision 1 = keine Einträge; dort bleiben Altpfad-Ergebnisse
 * (Schnelleingabe, Überspringen) lokal, bis e2/e4 sie über den Server schreiben.
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import type { Match, Tournament } from '../models/types';

export const SERVER_LED_MATCH_FIELDS = [
    'scoreA', 'scoreB',
    'overtimeScoreA', 'overtimeScoreB',
    'penaltyScoreA', 'penaltyScoreB',
    'matchStatus', 'decidedBy', 'finishedAt',
    'skippedReason', 'skippedAt',
] as const satisfies ReadonlyArray<keyof Match>;

export type ServerLedMatchField = typeof SERVER_LED_MATCH_FIELDS[number];
export type ServerLedMatchPatch = Partial<Pick<Match, ServerLedMatchField>>;

/** Nur Stufe 1 bis A-08f3e4; Stufe 2 entfernt den Zweig „Revision 1 bleibt lokal“. */
export type ServerLedMode = 'stufe1';

/** Regel S Stufe 1 mit Monotonie: Revision > 1 und nicht älter als die zuletzt übernommene. */
export function isServerLed(revision: number | undefined, lastAdopted: number | undefined, _mode: ServerLedMode): boolean {
    if (revision === undefined || revision <= 1) { return false; }
    return revision >= (lastAdopted ?? 0);
}

/**
 * Alle server-geführten Felder eines Spiels, auch leere (ein Feld kann am Server geleert sein).
 * A-08f3a-F F1: NULL aus der Cloud (z. B. `decided_by`, Mapper liefert es ungefiltert) zählt wie leer, sonst
 * meldet jeder Abruf eine Schein-Änderung und schreibt; lokal bleiben Felder `undefined`, nie `null`.
 */
export function serverLedFieldsOf(match: Match): ServerLedMatchPatch {
    const patch: Record<string, unknown> = {};
    for (const field of SERVER_LED_MATCH_FIELDS) { patch[field] = match[field] ?? undefined; }
    return patch;
}

function differs(local: Match, patch: ServerLedMatchPatch): boolean {
    return SERVER_LED_MATCH_FIELDS.some((field) => field in patch && local[field] !== patch[field]);
}

/** Legt die Felder eines Patches auf die Spiele (übrige Felder und Spiele bleiben). */
export function applyServerLedPatch(matches: Match[], patch: ReadonlyMap<string, ServerLedMatchPatch>): Match[] {
    return matches.map((m) => {
        const fields = patch.get(m.id);
        return fields === undefined ? m : { ...m, ...fields };
    });
}

export interface ServerLedMergeResult {
    tournament: Tournament;
    /** Übernommene Revision je Spiel (auch ohne Feldänderung) – für die Monotonie-Ablage. */
    adopted: Map<string, number>;
    /** Felder der übernommenen Spiele, die sich lokal ändern. */
    patch: Map<string, ServerLedMatchPatch>;
    changed: boolean;
}

/** Führt die server-geführten Felder der Cloud in die lokale Kopie (nur Spiele, die es lokal gibt). */
export function mergeServerLedFields(
    local: Tournament,
    cloud: Tournament,
    revisions: ReadonlyMap<string, number>,
    lastAdopted: ReadonlyMap<string, number>,
    mode: ServerLedMode,
): ServerLedMergeResult {
    const localById = new Map(local.matches.map((m) => [m.id, m]));
    const adopted = new Map<string, number>();
    const patch = new Map<string, ServerLedMatchPatch>();
    for (const cloudMatch of cloud.matches) {
        const localMatch = localById.get(cloudMatch.id);
        const revision = revisions.get(cloudMatch.id);
        if (localMatch === undefined || revision === undefined || !isServerLed(revision, lastAdopted.get(cloudMatch.id), mode)) { continue; }
        adopted.set(cloudMatch.id, revision);
        const fields = serverLedFieldsOf(cloudMatch);
        if (differs(localMatch, fields)) { patch.set(cloudMatch.id, fields); }
    }
    const changed = patch.size > 0;
    const tournament = changed ? { ...local, matches: applyServerLedPatch(local.matches, patch) } : local;
    return { tournament, adopted, patch, changed };
}
