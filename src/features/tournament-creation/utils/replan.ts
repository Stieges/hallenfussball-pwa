/**
 * replan — Neuplanung (Struktur ändern) vor dem ersten Anpfiff.
 *
 * Die Anpfiff-Prüfung nutzt die GEMEINSAME Funktion `getMatchStartState`
 * (src/utils/matchStartState.ts, @LZ-003 / B-01a) – keine Kopie.
 */
import type { Match, Team, Tournament } from '../../../types/tournament';
import {
  generateFullSchedule,
  type GeneratedSchedule,
} from '../../../core/generators';
import {
  getMatchStartState,
  type MatchStartState,
} from '../../../utils/matchStartState';
import { matchHasResult } from '../../../utils/teamHelpers';
import { replaceSides } from './matchSides';
import { transitionalSides } from '../../../core/models/matchSlot';
import { teamReplacedLabel } from '../../tournament-admin/constants/admin.constants';

/** „Spiel mit Ereignissen" (@W5-009): Ergebnis, Laufzeit-Events oder Status ungleich geplant. */
function matchHasEvents(match: Match): boolean {
  return (
    match.scoreA !== undefined ||
    match.scoreB !== undefined ||
    matchHasResult(match) ||
    (match.events?.length ?? 0) > 0 ||
    (match.matchStatus !== undefined && match.matchStatus !== 'scheduled')
  );
}

export type ReplanAvailability = 'offered' | 'refused-after-kickoff' | 'unknown';

/** W4: die erlaubten i18n-Schlüssel für Grund und Vorschlag. */
export type ReplanTextKey =
  | 'replan.reasonFieldRemoved'
  | 'replan.reasonOverlap'
  | 'replan.reasonGeneratorFailed'
  | 'replan.reasonRefusedKickoff'
  | 'replan.reasonRefusedUnknown';

export type ReplanSuggestionKey =
  | 'replan.suggestionCollision'
  | 'replan.suggestionMinRestOrAddField'
  | 'replan.suggestionRestoreTeam';

/** W4: Uhrzeit je nach gewählter Sprache. */
export function formatReplanTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export type ReplanPreviewResult =
  | {
      status: 'preview';
      schedule: GeneratedSchedule;
      endTime: Date;
      /** @W5-009: Spiele mit Ereignissen, die der neue Plan nicht entfallen lässt. */
      keptMatches: Match[];
      /** @W5-009: Hinweis je geschütztem Spiel – es wird NICHT entfernt. */
      keptNotices: Array<{ matchId: string; willBeRemoved: false }>;
      /** @W5-009: Behaltene Spiele ohne Gegenstück im neuen Plan (Konflikt). */
      conflictMatchIds: string[];
    }
  | {
      status: 'impossible';
      /** W4: i18n-Schlüssel statt deutscher Rohtext. */
      reasonKey: ReplanTextKey;
      suggestionKey: ReplanSuggestionKey;
      detail?: string;
    }
  /** @W5-008: Nach dem Anpfiff ist keine Neuplanung möglich (fail-closed). */
  | { status: 'refused'; reasonKey: ReplanTextKey; detail?: string };

export function getReplanAvailability(
  tournament: Pick<Tournament, 'matches' | 'status' | 'publishedAt'>
): ReplanAvailability {
  const isEstablished =
    tournament.status === 'published' || tournament.publishedAt !== undefined;
  const startState = getMatchStartState(
    tournament.matches,
    undefined,
    isEstablished
  );
  if (startState === 'not-started') {
    return 'offered';
  }
  return startState === 'started' ? 'refused-after-kickoff' : 'unknown';
}

/**
 * C-WIZ-NOREGEN: Plant bei Strukturänderung (Teams/Felder) neu – der Generator
 * wird nur genutzt, nie geändert. isRemoved-Teams spielen nicht mit (Controller-
 * Zusatz: Neuplanung filtert !isRemoved).
 */
export function buildReplanPreview(
  tournament: Tournament
): ReplanPreviewResult {
  const activeTeams = tournament.teams.filter((team) => !team.isRemoved);
  const replanInput: Tournament = {
    ...tournament,
    teams: activeTeams,
    numberOfTeams: activeTeams.length,
    // C-WIZ-NOREGEN: mit vorhandenen matches behält der Generator den alten
    // Plan – die Neuplanung verlangt eine frische Losen- und Zeitvergabe.
    matches: [],
  };
  try {
    const schedule = generateFullSchedule(replanInput);
    // @W5-009: Ein Spiel mit Ereignissen darf die Neuplanung nicht entfallen
    // lassen – es bleibt erhalten und ERSETZT das generierte Spiel mit
    // derselben Paarung und Phase (ohne Anhängen). Nach dem Controller-Ruling
    // behält es Anstoßzeit und Feld; kollidiert der neue Plan damit, gilt
    // @W5-008 (Grund und Lösungsvorschlag, nicht bestätigbar).
    const keptMatches = tournament.matches.filter(matchHasEvents);
    // G6/W3: Spieldauer je Phase – Finalrunde hat eine eigene Dauer.
    const durationFor = (phase: string | undefined): number =>
      phase && phase !== 'groupStage'
        ? (tournament.finalRoundGameDuration ??
            tournament.groupPhaseGameDuration ??
            0)
        : (tournament.groupPhaseGameDuration ?? 0);
    const keptByPairing = keptMatches.map((m) => ({
      match: m,
      pairing: [m.teamA, m.teamB].sort().join(':'),
      phase: m.phase ?? (m.isFinal ? 'final' : 'groupStage'),
    }));
    const usedGenerated = new Set<string>();
    const replacements = new Map<string, Match>();
    const conflictMatchIds: string[] = [];
    for (const kept of keptByPairing) {
      const counterpart = schedule.allMatches.find(
        (g) =>
          !usedGenerated.has(g.id) &&
          [g.originalTeamA, g.originalTeamB].sort().join(':') === kept.pairing &&
          g.phase === kept.phase
      );
      if (counterpart) {
        usedGenerated.add(counterpart.id);
        replacements.set(counterpart.id, kept.match);
      } else {
        conflictMatchIds.push(kept.match.id);
      }
    }
    const merged = schedule.allMatches.map((g) => {
      const kept = replacements.get(g.id);
      if (!kept) {
        return g;
      }
      // Controller-Ruling: Mit persistierter Anstoßzeit behält das geschützte
      // Spiel Anstoßzeit UND Feld. Ohne persistierte Anstoßzeit gilt der neue
      // Slot (Ergebnis/Ereignisse bleiben in jedem Fall erhalten).
      const keptTime = kept.scheduledTime;
      const pinned = keptTime !== undefined;
      const keptStart = pinned ? new Date(keptTime) : g.startTime;
      return {
        ...g,
        id: kept.id,
        field: pinned ? kept.field : g.field,
        startTime: keptStart,
        endTime: new Date(
          keptStart.getTime() + durationFor(kept.phase ?? (kept.isFinal ? 'final' : 'groupStage')) * 60000
        ),
        originalTeamA: kept.teamA,
        originalTeamB: kept.teamB,
      };
    });
    // @W5-009 ohne Gegenstück: angehängt und im Panel als Konflikt gemeldet.
    const appended = keptMatches
      .filter((m) => conflictMatchIds.includes(m.id))
      .map((m) => {
        const keptStart = m.scheduledTime ? new Date(m.scheduledTime) : schedule.endTime;
        return {
          ...schedule.allMatches[0],
          id: m.id,
          field: m.field,
          slot: schedule.allMatches.length,
          startTime: keptStart,
          endTime: new Date(
            keptStart.getTime() + durationFor(m.phase ?? (m.isFinal ? 'final' : 'groupStage')) * 60000
          ),
          originalTeamA: m.teamA,
          originalTeamB: m.teamB,
          phase: (m.phase ?? (m.isFinal ? 'final' : 'groupStage')) as (typeof schedule.allMatches)[number]['phase'],
          finalType: m.finalType,
          label: m.label,
          group: m.group,
          referee: m.referee,
        };
      });
    const allMatches = [...merged, ...appended];
    // W2/E1/E4 (@W5-008): Kollision = Zeit-Überlappung auf demselben Feld für
    // ALLE behaltenen Spiele (nicht nur ersetzte). Ein behaltenes Spiel auf
    // einem entfernten Feld ist ebenfalls ein Konflikt.
    const keptIds = new Set(keptMatches.map((m) => m.id));
    const overlaps = (a: typeof allMatches[number], b: typeof allMatches[number]): boolean =>
      a.startTime.getTime() < b.endTime.getTime() &&
      b.startTime.getTime() < a.endTime.getTime();
    const removedField = allMatches.some(
      (m) => keptIds.has(m.id) && m.field > tournament.numberOfFields
    );
    const collision =
      removedField ||
      allMatches.some(
        (m) =>
          keptIds.has(m.id) &&
          allMatches.some((o) => o !== m && o.field === m.field && overlaps(m, o))
      );
    if (collision) {
      return {
        status: 'impossible',
        reasonKey: removedField
          ? 'replan.reasonFieldRemoved'
          : 'replan.reasonOverlap',
        suggestionKey: 'replan.suggestionCollision',
      };
    }
    const endTime = allMatches.reduce(
      (max, m) => (m.endTime > max ? m.endTime : max),
      schedule.endTime
    );
    return {
      status: 'preview',
      schedule: { ...schedule, allMatches },
      endTime,
      keptMatches,
      keptNotices: keptMatches.map((m) => ({
        matchId: m.id,
        willBeRemoved: false as const,
      })),
      conflictMatchIds,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      status: 'impossible',
      reasonKey: 'replan.reasonGeneratorFailed',
      suggestionKey:
        activeTeams.length === 0
          ? 'replan.suggestionRestoreTeam'
          : 'replan.suggestionMinRestOrAddField',
      detail,
    };
  }
}

/**
 * @W5-005: Nach Bestätigung ersetzt der neue Spielplan den alten.
 * Ersetzt ausschließlich matches – Einstellungen bleiben unangetastet.
 */
export function applyReplan(
  tournament: Tournament,
  preview: Extract<ReplanPreviewResult, { status: 'preview' }>
): Tournament {
  const keptById = new Map(preview.keptMatches.map((m) => [m.id, m]));
  const matches: Match[] = preview.schedule.allMatches.map((m, index) => {
    // @W5-009: Das behaltene Spiel liegt mit seinen Ergebnissen im Plan.
    const kept = keptById.get(m.id);
    if (kept) {
      // G6/W3: eine Wahrheitsquelle – das merged-Item (Zeit/Feld aus dem
      // Merge) mit den Daten aus kept (Ergebnis, Events, Status).
      return {
        ...kept,
        field: m.field,
        slot: m.slot,
        scheduledTime: m.startTime,
      };
    }
    return ({
    id: m.id,
    round: Math.floor(index / preview.schedule.numberOfFields) + 1,
    field: m.field,
    slot: m.slot,
    ...transitionalSides(m.slotA, m.slotB),
    slotA: m.slotA,
    slotB: m.slotB,
    group: m.group,
    isFinal: m.phase !== 'groupStage',
    phase: m.phase,
    finalType: m.finalType,
    label: m.label,
      scheduledTime: m.startTime,
      referee: m.referee,
    });
  });
  return { ...tournament, matches };
}

export interface ReplanSession {
  preview: ReplanPreviewResult;
  /** @W5-007: Abbrechen – gibt den unveränderten IST-Stand zurück. */
  cancel: () => Tournament;
  /** @W5-005: Bestätigen – ersetzt den Spielplan, Einstellungen bleiben. */
  confirm: () => Tournament;
}

/**
 * @W5-007: Vorschau einer Neuplanung, abbrechbar. Bis zur Bestätigung wird
 * nichts verändert – cancel() liefert den Ist-Stand zurück.
 */
export function openReplan(
  current: Tournament,
  updated: Tournament,
  startState: MatchStartState
): ReplanSession {
  // @W5-008: Nach dem Anpfiff (oder wenn der Startzustand nicht feststellbar
  // ist) wird keine Neuplanung angeboten – confirm gibt den Ist-Stand zurück.
  const preview: ReplanPreviewResult =
    startState === 'not-started'
      ? buildReplanPreview(updated)
      : {
          status: 'refused',
          reasonKey:
            startState === 'started'
              ? 'replan.reasonRefusedKickoff'
              : 'replan.reasonRefusedUnknown',
        };
  return {
    preview,
    cancel: () => current,
    confirm: () =>
      preview.status === 'preview'
        ? applyReplan(updated, preview)
        : current,
  };
}

export interface ReplaceTeamResult {
  tournament: Tournament;
  logEntry: { label: string; timestamp: string; person: string };
}

/**
 * @W5-010: Team ersetzen – Team N übernimmt Platz, Spiele und bisherige
 * Ergebnisse von Team C. Paarungen und Anstoßzeiten bleiben unverändert,
 * es wird nichts neu gelost. Der Verlauf hält „Team C durch Team N ersetzt"
 * mit Zeit und Person fest.
 */
export function replaceTeam(
  tournament: Tournament,
  change: { fromTeamId: string; toTeam: Team; person: string }
): ReplaceTeamResult {
  const teams = tournament.teams.map((team) =>
    team.id === change.fromTeamId ? change.toTeam : team
  );
  const matches = tournament.matches.map((match) =>
    replaceSides(match, change.fromTeamId, change.toTeam.id)
  );
  const fromName =
    tournament.teams.find((team) => team.id === change.fromTeamId)?.name ??
    change.fromTeamId;
  return {
    tournament: { ...tournament, teams, matches },
    logEntry: {
      label: teamReplacedLabel(fromName, change.toTeam.name),
      timestamp: new Date().toISOString(),
      person: change.person,
    },
  };
}
