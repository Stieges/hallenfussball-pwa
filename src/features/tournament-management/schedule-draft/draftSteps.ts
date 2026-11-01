/**
 * Entwurf des Spielplan-Bearbeitens (@ZP-101 bis @ZP-104): jede Änderung im Bearbeiten-Modus ist ein Schritt.
 * Der Entwurf = gespeichertes Turnier + Schritte der Reihe nach. Gespeichert wird erst mit „Speichern“ (ein Update).
 *
 * Rein (kein React). Angepfiffene Spiele (läuft, Halbzeit, beendet) ändern sich nie (@ZP-093): ein Tausch, der eines
 * berührt, entfällt ganz; bei „neu verteilen“ entfällt nur der Eintrag dieses Spiels. Beides wird als `skipped` gemeldet.
 */
import type { Match, Tournament } from '../../../types/tournament';
import { isStartedMatch } from '../../schedule-editor/utils/startedGuard';

export type DraftStepKind = 'swap' | 'move' | 'referee' | 'field' | 'redistributeReferees' | 'redistributeFields' | 'resetReferees';

/** Neue Werte eines Spiels; nicht gesetzte Felder bleiben. `referee: null` = kein Schiedsrichter. */
export interface MatchPatch {
  matchId: string;
  scheduledTime?: Date;
  field?: number;
  referee?: number | null;
}

export interface DraftStep {
  kind: DraftStepKind;
  patches: MatchPatch[];
  /** Alles oder nichts: berührt der Schritt ein angepfiffenes Spiel, entfällt er ganz (Tausch, Verschieben). */
  atomic: boolean;
  /** Hand-Zuteilungen der Schiedsrichter: Zahl = setzen, null = entfernen. */
  manual?: Record<string, number | null>;
}

/** Ein nicht übernommener Teil des Entwurfs: der Schritt, die betroffenen Spiele und welches davon angepfiffen ist. */
export interface SkippedChange {
  kind: DraftStepKind;
  matchIds: string[];
  startedIds: string[];
}

export interface DraftResult {
  tournament: Tournament;
  skipped: SkippedChange[];
  /** Zahl der Schritte, von denen mindestens ein Teil übernommen wurde */
  appliedSteps: number;
}

function applyPatch(match: Match, patch: MatchPatch): Match {
  const next: Match = { ...match };
  if (patch.scheduledTime !== undefined) { next.scheduledTime = patch.scheduledTime; }
  if (patch.field !== undefined) { next.field = patch.field; }
  if (patch.referee !== undefined) { next.referee = patch.referee ?? undefined; }
  return next;
}

/** Wendet die Schritte der Reihe nach auf `base` an; angepfiffene Spiele aus `base` bleiben unberührt. */
export function applyDraftSteps(base: Tournament, steps: readonly DraftStep[]): DraftResult {
  const byId = new Map(base.matches.map((m) => [m.id, m]));
  const started = new Set(base.matches.filter(isStartedMatch).map((m) => m.id));
  let manual: Record<string, number | null> | undefined;
  let fieldAssignments: Record<string, number> | undefined;
  const skipped: SkippedChange[] = [];
  let appliedSteps = 0;

  for (const step of steps) {
    const touchedStarted = step.patches.map((p) => p.matchId).filter((id) => started.has(id));
    if (step.atomic && touchedStarted.length > 0) {
      skipped.push({ kind: step.kind, matchIds: step.patches.map((p) => p.matchId), startedIds: touchedStarted });
      continue;
    }
    let appliedAny = false;
    for (const patch of step.patches) {
      const match = byId.get(patch.matchId);
      if (!match) { continue; }
      if (started.has(patch.matchId)) {
        skipped.push({ kind: step.kind, matchIds: [patch.matchId], startedIds: [patch.matchId] });
        continue;
      }
      byId.set(patch.matchId, applyPatch(match, patch));
      appliedAny = true;
      if (step.kind === 'field' && patch.field !== undefined) {
        fieldAssignments = { ...(fieldAssignments ?? base.fieldAssignments ?? {}), [patch.matchId]: patch.field };
      }
    }
    for (const [matchId, value] of Object.entries(step.manual ?? {})) {
      if (started.has(matchId)) { continue; }
      manual = { ...(manual ?? {}), [matchId]: value };
      appliedAny = true;
    }
    if (appliedAny) { appliedSteps += 1; }
  }

  const tournament: Tournament = { ...base, matches: base.matches.map((m) => byId.get(m.id) ?? m) };
  if (fieldAssignments) { tournament.fieldAssignments = fieldAssignments; }
  if (manual) {
    const config = base.refereeConfig ?? { mode: 'organizer' as const };
    const assignments: Record<string, number> = { ...(config.manualAssignments ?? {}) };
    for (const [matchId, value] of Object.entries(manual)) {
      if (value === null) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Hand-Zuteilung entfernen
        delete assignments[matchId];
      } else {
        assignments[matchId] = value;
      }
    }
    tournament.refereeConfig = { ...config, manualAssignments: assignments };
  }
  return { tournament, skipped, appliedSteps };
}

/** Tausch: Spiel A bekommt Uhrzeit und Feld von B und umgekehrt (@ZP-100). `null`, wenn ein Spiel fehlt. */
export function swapStep(draft: Tournament, matchIdA: string, matchIdB: string): DraftStep | null {
  const a = draft.matches.find((m) => m.id === matchIdA);
  const b = draft.matches.find((m) => m.id === matchIdB);
  if (!a || !b || !a.scheduledTime || !b.scheduledTime || a.id === b.id) { return null; }
  return {
    kind: 'swap',
    atomic: true,
    patches: [
      { matchId: a.id, scheduledTime: b.scheduledTime, field: b.field },
      { matchId: b.id, scheduledTime: a.scheduledTime, field: a.field },
    ],
  };
}

/** Schiedsrichter eines Spiels von Hand (@W3-011); `null`, wenn sich nichts ändert. */
export function refereeStep(draft: Tournament, matchId: string, referee: number | null): DraftStep | null {
  const match = draft.matches.find((m) => m.id === matchId);
  if (!match || (match.referee ?? null) === referee) { return null; }
  return { kind: 'referee', atomic: true, patches: [{ matchId, referee }], manual: { [matchId]: referee } };
}

/** Feld eines Spiels; `null`, wenn sich nichts ändert. */
export function fieldStep(draft: Tournament, matchId: string, field: number): DraftStep | null {
  const match = draft.matches.find((m) => m.id === matchId);
  if (!match || match.field === field) { return null; }
  return { kind: 'field', atomic: true, patches: [{ matchId, field }] };
}

const sameTime = (a: Match['scheduledTime'], b: Match['scheduledTime']): boolean =>
  (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/** Schritt aus dem Unterschied zweier Spiellisten (Raster: Ablegen auf einen Platz); `null` ohne Unterschied. */
export function diffStep(before: readonly Match[], after: readonly Match[]): DraftStep | null {
  const old = new Map(before.map((m) => [m.id, m]));
  const patches: MatchPatch[] = [];
  for (const next of after) {
    const prev = old.get(next.id);
    if (!prev) { continue; }
    const patch: MatchPatch = { matchId: next.id };
    if (!sameTime(prev.scheduledTime, next.scheduledTime) && next.scheduledTime) { patch.scheduledTime = next.scheduledTime; }
    if (prev.field !== next.field) { patch.field = next.field; }
    if ((prev.referee ?? null) !== (next.referee ?? null)) { patch.referee = next.referee ?? null; }
    if (Object.keys(patch).length > 1) { patches.push(patch); }
  }
  return patches.length > 0 ? { kind: 'move', atomic: true, patches } : null;
}

/** Je Spiel: was sich im Entwurf gegenüber dem gespeicherten Turnier ändert (Markierung an den Karten). */
export function changedValues(base: Tournament, draft: Tournament): {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
} {
  const old = new Map(base.matches.map((m) => [m.id, m]));
  const refereeAssignments: Record<string, number | null> = {};
  const fieldAssignments: Record<string, number> = {};
  for (const m of draft.matches) {
    const prev = old.get(m.id);
    if (!prev) { continue; }
    if ((prev.referee ?? null) !== (m.referee ?? null)) { refereeAssignments[m.id] = m.referee ?? null; }
    if (prev.field !== m.field || !sameTime(prev.scheduledTime, m.scheduledTime)) { fieldAssignments[m.id] = m.field; }
  }
  return { refereeAssignments, fieldAssignments };
}
