/**
 * Entwurf des Spielplan-Bearbeitens (@ZP-101 bis @ZP-104): jede Änderung im Bearbeiten-Modus ist ein Schritt.
 * Der Entwurf = gespeichertes Turnier + Schritte der Reihe nach. Gespeichert wird erst mit „Speichern“ (ein Update).
 *
 * Rein (kein React). Angepfiffene Spiele (läuft, Halbzeit, beendet) ändern sich nie (@ZP-093): ein Tausch, der eines
 * berührt, entfällt ganz; bei „neu verteilen“ entfällt nur der Eintrag dieses Spiels. Ebenso wird nichts still
 * überschrieben (Funktionalität F, @ZP-102): jeder Eintrag trägt den Wert, von dem er ausging (`from`); hat ein anderes
 * Gerät das Spiel inzwischen geändert, entfällt er. Beides wird als `skipped` gemeldet.
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
  /** Werte, von denen der Eintrag ausging (je geändertem Feld); weicht der Stand beim Anwenden ab, entfällt er */
  from: { scheduledTime?: Date; field?: number; referee?: number | null };
}

export interface DraftStep {
  kind: DraftStepKind;
  patches: MatchPatch[];
  /** Alles oder nichts: berührt der Schritt ein angepfiffenes Spiel, entfällt er ganz (Tausch, Verschieben). */
  atomic: boolean;
  /** Hand-Zuteilungen der Schiedsrichter: Zahl = setzen, null = entfernen. */
  manual?: Record<string, number | null>;
}

/** Ein nicht übernommener Teil des Entwurfs: der Schritt, die betroffenen Spiele, welche angepfiffen bzw. anderswo geändert sind. */
export interface SkippedChange {
  kind: DraftStepKind;
  matchIds: string[];
  startedIds: string[];
  changedIds: string[];
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

const sameTime = (a: Match['scheduledTime'], b: Match['scheduledTime']): boolean =>
  (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/** Steht das Spiel noch auf den Werten, von denen der Eintrag ausging? */
function unchangedSince(match: Match | null, patch: MatchPatch): boolean {
  if (!match) { return true; } // unbekanntes Spiel: der Eintrag wird ohnehin übersprungen
  return (patch.scheduledTime === undefined || sameTime(match.scheduledTime, patch.from.scheduledTime))
    && (patch.field === undefined || match.field === patch.from.field)
    && (patch.referee === undefined || (match.referee ?? null) === (patch.from.referee ?? null));
}

/** Wendet die Schritte der Reihe nach auf `base` an; angepfiffene und anderswo geänderte Spiele bleiben unberührt. */
export function applyDraftSteps(base: Tournament, steps: readonly DraftStep[]): DraftResult {
  const byId = new Map(base.matches.map((m) => [m.id, m]));
  const started = new Set(base.matches.filter(isStartedMatch).map((m) => m.id));
  let manual: Record<string, number | null> | undefined;
  let fieldAssignments: Record<string, number> | undefined;
  const skipped: SkippedChange[] = [];
  let appliedSteps = 0;

  for (const step of steps) {
    const blocked = (p: MatchPatch) => ({
      started: started.has(p.matchId),
      changed: !started.has(p.matchId) && !unchangedSince(byId.get(p.matchId) ?? null, p),
    });
    const touchedStarted = step.patches.filter((p) => blocked(p).started).map((p) => p.matchId);
    const touchedChanged = step.patches.filter((p) => blocked(p).changed).map((p) => p.matchId);
    if (step.atomic && touchedStarted.length + touchedChanged.length > 0) {
      skipped.push({ kind: step.kind, matchIds: step.patches.map((p) => p.matchId), startedIds: touchedStarted, changedIds: touchedChanged });
      continue;
    }
    let appliedAny = false;
    const skippedIds = new Set<string>();
    for (const patch of step.patches) {
      const match = byId.get(patch.matchId);
      if (!match) { continue; }
      const b = blocked(patch);
      if (b.started || b.changed) {
        skippedIds.add(patch.matchId);
        skipped.push({ kind: step.kind, matchIds: [patch.matchId], startedIds: b.started ? [patch.matchId] : [], changedIds: b.changed ? [patch.matchId] : [] });
        continue;
      }
      byId.set(patch.matchId, applyPatch(match, patch));
      appliedAny = true;
      if (step.kind === 'field' && patch.field !== undefined) {
        fieldAssignments = { ...(fieldAssignments ?? base.fieldAssignments ?? {}), [patch.matchId]: patch.field };
      }
    }
    for (const [matchId, value] of Object.entries(step.manual ?? {})) {
      if (started.has(matchId) || skippedIds.has(matchId)) { continue; }
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

/** Phase für das Tauschen (@ZP-107): Gruppenphase oder Finalrunde (alle Finalspiele zählen zusammen). */
export function swapPhaseOf(match: { phase?: string; isFinal?: boolean }): 'group' | 'finals' {
  return (match.phase ?? (match.isFinal ? 'final' : 'groupStage')) === 'groupStage' ? 'group' : 'finals';
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
      { matchId: a.id, scheduledTime: b.scheduledTime, field: b.field, from: { scheduledTime: a.scheduledTime, field: a.field } },
      { matchId: b.id, scheduledTime: a.scheduledTime, field: a.field, from: { scheduledTime: b.scheduledTime, field: b.field } },
    ],
  };
}

/** Schiedsrichter eines Spiels von Hand (@W3-011); `null`, wenn sich nichts ändert. */
export function refereeStep(draft: Tournament, matchId: string, referee: number | null): DraftStep | null {
  const match = draft.matches.find((m) => m.id === matchId);
  if (!match || (match.referee ?? null) === referee) { return null; }
  return { kind: 'referee', atomic: true, patches: [{ matchId, referee, from: { referee: match.referee ?? null } }], manual: { [matchId]: referee } };
}

/** Feld eines Spiels; `null`, wenn sich nichts ändert. */
export function fieldStep(draft: Tournament, matchId: string, field: number): DraftStep | null {
  const match = draft.matches.find((m) => m.id === matchId);
  if (!match || match.field === field) { return null; }
  return { kind: 'field', atomic: true, patches: [{ matchId, field, from: { field: match.field } }] };
}

/** Schritt aus dem Unterschied zweier Spiellisten (Raster: Ablegen auf einen Platz); `null` ohne Unterschied. */
export function diffStep(before: readonly Match[], after: readonly Match[]): DraftStep | null {
  const old = new Map(before.map((m) => [m.id, m]));
  const patches: MatchPatch[] = [];
  for (const next of after) {
    const prev = old.get(next.id);
    if (!prev) { continue; }
    const patch: MatchPatch = { matchId: next.id, from: {} };
    if (!sameTime(prev.scheduledTime, next.scheduledTime) && next.scheduledTime) { patch.scheduledTime = next.scheduledTime; patch.from.scheduledTime = prev.scheduledTime; }
    if (prev.field !== next.field) { patch.field = next.field; patch.from.field = prev.field; }
    if ((prev.referee ?? null) !== (next.referee ?? null)) { patch.referee = next.referee ?? null; patch.from.referee = prev.referee ?? null; }
    if (Object.keys(patch.from).length > 0) { patches.push(patch); }
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
