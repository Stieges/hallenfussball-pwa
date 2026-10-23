/**
 * GA4 A-13c: Plan eines Abschlusses aus Turnier und neuen Entscheidungen – rein, ohne React, ohne Schreibweg.
 * Der Ablauf der Oberfläche (`useGroupCompletion`) ruft `planCompletion` nach jeder Eingabe neu auf:
 *   OPEN_MATCHES / UNKNOWN_GROUP → ablehnen (@TM-054),
 *   DECISION_REQUIRED → die Blöcke aus `groupTieView` (keine eigene Regel, @TM-043, @TM-048, @TM-060),
 *   READY → die Anfrage für `completeGroup`: Rangfolge ohne entfernte Teams (@TM-149), Kopie der geltenden Entscheidungen
 *   (@W2A-058, auch die neuen, mit Grund bei einer Reihenfolge), Stand der Gruppe (R-GA4v2-3).
 * Neue Entscheidungen gelten dabei nur im Plan – gespeichert wird erst mit `complete_group` (@TM-049: ohne Eingabe bleibt die
 * Gruppe offen). Dazu die Wirkung („Danach besetzt: Halbfinale 1 Heim FC Nord, …“) als Vorschau.
 */
import type { Match, StandingDecision, Tournament } from '../../types/tournament';
import type { CompleteGroupRequest, DecisionWithReason } from '../repositories/groupCompletionCloud';
import { slotSource } from '../models/matchSlot';
import { decisionBasis, sortedIds, type DecisionDraft } from '../standings/decisions';
import { tableInput } from '../standings/tournamentTable';
import type { OpenTieBlock } from '../standings/tieViews';
import {
  everCompleted, groupState, prepareGroupCompletion, prepareRecompletion, type CompletionTournament,
} from './GroupCompletionService';

/** Eine Seite der Finalrunde, die der Abschluss besetzt (oder neu besetzt). */
export interface CompletionEffectEntry {
  matchId: string;
  /** Spielbezeichnung wie im Spiel gespeichert (z. B. „1. Halbfinale“); fehlt sie, bleibt sie leer. */
  label: string;
  side: 'A' | 'B';
  /** Platz in der Gruppe (Herkunft). */
  rank: number;
  teamId: string;
}

/** Seiten der Finalrunde mit Herkunft `groupId`, die mit der Rangfolge besetzt werden; offene Plätze (`openRanks`) bleiben offen. */
export function completionEffect(
  tournament: Pick<Tournament, 'matches'>,
  groupId: string,
  ranking: readonly string[],
  openRanks: readonly number[] = [],
): CompletionEffectEntry[] {
  const entry = (match: Match, side: 'A' | 'B'): CompletionEffectEntry[] => {
    const source = slotSource(side === 'A' ? match.slotA : match.slotB);
    if (source?.kind !== 'groupRank' || source.group !== groupId || openRanks.includes(source.rank)) {
      return [];
    }
    const teamId = ranking[source.rank - 1];
    return teamId === undefined ? [] : [{ matchId: match.id, label: match.label ?? '', side, rank: source.rank, teamId }];
  };
  return tournament.matches.filter((m) => m.isFinal === true).flatMap((m) => [...entry(m, 'A'), ...entry(m, 'B')]);
}

/** Neue Entscheidung, noch nicht gespeichert; der Grund einer Reihenfolge geht nur an den Server (@W2A-072). */
export type NewDecision = DecisionWithReason;

/**
 * Entwurf der Turnierleitung → Entscheidung mit Kennung und Grundlage (wie `StandingDecisionService.decide`). Die Kennung
 * vergibt der Aufrufer einmal je Entwurf, damit ein erneuter Plan dieselbe Kennung nutzt.
 */
export function draftToDecision(tournament: CompletionTournament, draft: DecisionDraft, id: string): NewDecision {
  const input = tableInput(tournament.teams, tournament.matches, tournament, draft.groupId);
  return {
    id,
    groupId: input.groupId,
    teamIds: sortedIds(draft.teamIds),
    order: [...draft.order],
    kind: draft.kind,
    ...(draft.kind === 'shootout' && draft.shootout !== undefined ? { shootout: { ...draft.shootout } } : {}),
    basis: decisionBasis(input, draft.teamIds),
    ...(draft.kind === 'order' && draft.reason !== undefined ? { reason: draft.reason.trim() } : {}),
  };
}

export type CompletionPlan =
  | { code: 'UNKNOWN_GROUP' }
  | { code: 'OPEN_MATCHES'; open: number }
  | { code: 'DECISION_REQUIRED'; blocks: OpenTieBlock[] }
  | {
    code: 'READY';
    request: CompleteGroupRequest;
    /** Turnier mit den neuen Entscheidungen (nur für Anzeige und Vorschau, nie gespeichert). */
    preview: Tournament;
    /** Die Gruppe war schon einmal abgeschlossen (nach Korrektur oder wieder geöffnet): Taste heißt „Erneut abschließen“. */
    again: boolean;
  };

/**
 * Plan für den Abschluss von `groupId` (Gruppenkennung wie `groupKeyOf`, `''` bei Jeder gegen jeden). `decisions` sind die in
 * diesem Ablauf neu eingetragenen Entscheidungen; sie zählen im Plan wie gespeicherte (@W2A-058: eine schon gültige
 * Entscheidung aus der Tabelle wird nicht erneut verlangt).
 */
export function planCompletion(tournament: Tournament, groupId: string, decisions: readonly NewDecision[] = []): CompletionPlan {
  const known = tournament.standingDecisions ?? [];
  const withNew: Tournament = decisions.length === 0 ? tournament : {
    ...tournament,
    standingDecisions: [...known, ...decisions.map(({ reason: _reason, ...decision }): StandingDecision => decision)],
  };
  const prepared = groupState(withNew, groupId) === 'stale' ? prepareRecompletion(withNew, groupId) : prepareGroupCompletion(withNew, groupId);
  if (prepared.code !== 'READY') {
    return prepared;
  }
  const reasonOf = new Map(decisions.flatMap((d) => (d.reason !== undefined ? [[d.id, d.reason] as const] : [])));
  return {
    code: 'READY',
    preview: withNew,
    again: everCompleted(tournament, groupId),
    request: {
      groupId,
      ranking: prepared.ranking,
      openRanks: prepared.openRanks,
      tieDecisions: prepared.tieDecisions.map((d) => (reasonOf.has(d.id) ? { ...d, reason: reasonOf.get(d.id) } : d)),
      knownDecisionIds: known.filter((d) => d.groupId === groupId).map((d) => d.id),
      expectedState: prepared.expectedState,
    },
  };
}
