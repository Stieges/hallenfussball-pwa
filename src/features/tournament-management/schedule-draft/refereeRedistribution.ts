/**
 * Schiedsrichter der offenen Spiele neu nach den Regeln verteilen (@W3-034, @W3-035): eine Funktion für
 * „SR neu verteilen“ (Werkzeugleiste) und „Zuteilung zurücksetzen“ (Block „Manuelle Schiedsrichter-Zuweisung“).
 *
 * Regeln = dieselben wie beim Erzeugen des Spielplans (`assignReferees`). Angepfiffene Spiele (läuft, Halbzeit,
 * beendet) behalten ihren Schiedsrichter und ihre Hand-Zuteilung; Uhrzeiten, Felder und Ergebnisse bleiben unberührt.
 * Rein (kein React).
 */
import { assignReferees } from '../../../core/generators/refereeAssigner';
import type { Tournament } from '../../../types/tournament';
import { isStartedMatch } from '../../schedule-editor/utils/startedGuard';
import type { DraftStep, MatchPatch } from './draftSteps';

export interface RefereeRedistribution {
  /** Schritt mit den neuen Schiedsrichtern und den entfernten Hand-Zuteilungen; `null` = nichts zu ändern */
  step: DraftStep | null;
  /** Offene Spiele mit Hand-Zuteilung, deren Schiedsrichter sich dadurch ändert (Rückfrage @W3-035) */
  overwrittenManualIds: string[];
}

const timeOf = (value: Date | string | undefined): number => (value ? new Date(value).getTime() : 0);

/**
 * Neu verteilen für alle offenen Spiele. Die Reihenfolge der Spiele kommt aus den aktuellen Uhrzeiten (nach Tauschen
 * stimmt der gespeicherte Platz `slot` nicht mehr), deshalb wird `slot` für die Rechnung neu gezählt.
 */
export function redistributeOpenReferees(
  tournament: Tournament,
  kind: 'redistributeReferees' | 'resetReferees' = 'redistributeReferees',
): RefereeRedistribution {
  const config = tournament.refereeConfig;
  if (!config || config.mode === 'none') { return { step: null, overwrittenManualIds: [] }; }

  const startedIds = new Set(tournament.matches.filter(isStartedMatch).map((m) => m.id));
  const times = [...new Set(tournament.matches.map((m) => timeOf(m.scheduledTime)))].sort((a, b) => a - b);
  const slotOf = new Map(times.map((t, index) => [t, index]));
  const input = tournament.matches.map((m) => ({
    ...m,
    slot: slotOf.get(timeOf(m.scheduledTime)) ?? 0,
    referee: startedIds.has(m.id) ? m.referee : undefined,
  }));
  const startedManual = Object.fromEntries(
    Object.entries(config.manualAssignments ?? {}).filter(([id]) => startedIds.has(id)),
  );
  const assigned = new Map(assignReferees(input, tournament.teams, { ...config, manualAssignments: startedManual }).map((m) => [m.id, m.referee]));

  const manualIds = new Set(Object.keys(config.manualAssignments ?? {}));
  const patches: MatchPatch[] = [];
  const manual: Record<string, null> = {};
  const overwrittenManualIds: string[] = [];
  for (const match of tournament.matches) {
    if (startedIds.has(match.id)) { continue; }
    const next = assigned.get(match.id) ?? null;
    const changed = (match.referee ?? null) !== next;
    if (changed) { patches.push({ matchId: match.id, referee: next, from: { referee: match.referee ?? null } }); }
    if (manualIds.has(match.id)) {
      manual[match.id] = null;
      if (changed) { overwrittenManualIds.push(match.id); }
    }
  }
  const hasManual = Object.keys(manual).length > 0;
  if (patches.length === 0 && (kind === 'redistributeReferees' || !hasManual)) {
    return { step: null, overwrittenManualIds: [] };
  }
  return {
    step: { kind, atomic: false, patches, ...(hasManual ? { manual } : {}) },
    overwrittenManualIds,
  };
}
