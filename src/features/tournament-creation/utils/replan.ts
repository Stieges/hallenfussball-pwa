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
import { teamReplacedLabel } from '../../tournament-admin/constants/admin.constants';

/** „Spiel mit Ereignissen" (@W5-009): Ergebnis, Laufzeit-Events oder Status ungleich geplant. */
function matchHasEvents(match: Match): boolean {
  return (
    matchHasResult(match) ||
    (match.events?.length ?? 0) > 0 ||
    (match.matchStatus !== undefined && match.matchStatus !== 'scheduled')
  );
}

export type ReplanAvailability = 'offered' | 'refused-after-kickoff' | 'unknown';

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
  | { status: 'impossible'; reason: string; suggestion: string }
  /** @W5-008: Nach dem Anpfiff ist keine Neuplanung möglich (fail-closed). */
  | { status: 'refused'; reason: string };

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
          keptStart.getTime() + (tournament.groupPhaseGameDuration ?? 0) * 60000
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
            keptStart.getTime() + (tournament.groupPhaseGameDuration ?? 0) * 60000
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
    // Controller-Ruling: Behaltener Anstoß kollidiert mit dem neuen Plan.
    const slotCount = new Map<string, number>();
    for (const m of allMatches) {
      const key = `${m.field}|${m.startTime.getTime()}`;
      slotCount.set(key, (slotCount.get(key) ?? 0) + 1);
    }
    const keptIds = new Set(Array.from(replacements.values()).map((m) => m.id));
    const collision = allMatches.some(
      (m) =>
        keptIds.has(m.id) &&
        (slotCount.get(`${m.field}|${m.startTime.getTime()}`) ?? 0) > 1
    );
    if (collision) {
      return {
        status: 'impossible',
        reason:
          'Ein bereits gespieltes Spiel behält seinen Anstoß – der neue Plan belegt denselben Slot auf demselben Feld.',
        suggestion:
          'Mindestpause senken, ein Feld hinzufügen oder das behaltene Spiel vor der Neuplanung verschieben.',
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
    const reason = err instanceof Error ? err.message : String(err);
    const suggestion =
      activeTeams.length === 0
        ? 'Team wiederherstellen oder ein neues Team anlegen.'
        : 'Mindestpause senken oder ein Feld hinzufuegen.';
    return { status: 'impossible', reason, suggestion };
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
      return kept;
    }
    return ({
    id: m.id,
    round: Math.floor(index / preview.schedule.numberOfFields) + 1,
    field: m.field,
    slot: m.slot,
    teamA: m.originalTeamA,
    teamB: m.originalTeamB,
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
  startState: MatchStartState = 'not-started'
): ReplanSession {
  // @W5-008: Nach dem Anpfiff (oder wenn der Startzustand nicht feststellbar
  // ist) wird keine Neuplanung angeboten – confirm gibt den Ist-Stand zurück.
  const preview: ReplanPreviewResult =
    startState === 'not-started'
      ? buildReplanPreview(updated)
      : {
          status: 'refused',
          reason:
            startState === 'started'
              ? 'Das Turnier hat bereits angepfiffen – eine Neuplanung ist nur vor dem ersten Spiel möglich.'
              : 'Der Startzustand des Turniers ist nicht feststellbar – eine Neuplanung ist deshalb nicht möglich.',
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
