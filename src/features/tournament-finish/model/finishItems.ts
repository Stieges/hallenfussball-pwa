/**
 * Liste „noch offen“ im Dialog „Turnier abschließen“ (Zustand A, @LZ-010, @LZ-012, @LZ-013, @LZ-029): aus den Punkten des Servers
 * (`finish_preflight`/`finish_tournament`) und der Klärungsliste entsteht je Punkt EIN Eintrag mit Titel, Zusatzzeile und
 * Sprungziel. Rein bis auf das übergebene `t`; die Texte stehen in `tournament:finish.item.*`.
 *
 * Sprungziele (Plan R3-4, Mockup Zustand A): Spiel → Cockpit mit dem Spiel; Gruppe, Gleichstand, Folgen-Hinweis und
 * Klärung der Gruppe → Tabelle (dort stehen Abschluss, Entscheidung und Hinweise); Klärungsliste → Spielplan mit geöffneter Liste.
 */
import type { Tournament } from '../../../types/tournament';
import type { FinishItem, ReviewOpenItem } from '../../../core/repositories/lifecycleRpc';
import { slotLabel, teamDisplayName } from '../../../core/view/originText';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { formatClock } from './finishFormat';
import { OVERALL_GROUP } from '../../../core/models/standingsGroups';

export type FinishT = (key: string, options?: Record<string, unknown>) => string;

export interface FinishItemView {
  /** Stabiler Schlüssel für die Liste. */
  id: string;
  title: string;
  detail: string | null;
  /** Adresse des Sprungziels (App-intern). */
  target: string;
}

type TournamentForItems = Pick<Tournament, 'id' | 'teams' | 'matches' | 'groups'>;

const FINAL_TYPES = ['final', 'thirdPlace', 'fifthSixth', 'seventhEighth'] as const;
const finalTypeOf = (value: string | undefined): (typeof FINAL_TYPES)[number] | undefined => FINAL_TYPES.find((known) => known === value);

/** Sprungziel eines offenen Punktes. */
export function finishItemTarget(item: FinishItem, tournamentId: string): string {
  const base = `/tournament/${tournamentId}`;
  switch (item.kind) {
    case 'match_running':
    case 'match_undecided':
      return `${base}/live?matchId=${encodeURIComponent(item.matchId)}`;
    case 'review_open':
      return `${base}/schedule?klaerung=1`;
    case 'group_open':
    case 'group_stale':
    case 'tie_open':
    case 'notice_open':
    case 'clarification_open':
    case 'unknown':
      return `${base}/standings`;
  }
}

function groupName(tournament: TournamentForItems, groupId: string | undefined): string | null {
  if (groupId === undefined || groupId === OVERALL_GROUP) {
    return null;
  }
  return getGroupDisplayName(groupId, { groups: tournament.groups ?? [] });
}

function matchLine(tournament: TournamentForItems, item: { matchId: string; field?: number }, t: FinishT, language: string): { title: string; detail: string | null } | null {
  const match = tournament.matches.find((candidate) => candidate.id === item.matchId);
  if (match === undefined) {
    return null;
  }
  const ctx = { teams: tournament.teams, matches: tournament.matches, groups: tournament.groups };
  const sides = `${slotLabel(match.slotA, ctx)} – ${slotLabel(match.slotB, ctx)}`;
  const time = formatClock(match.scheduledTime, language);
  const field = item.field ?? match.field;
  const parts = [sides, ...(time ? [time] : []), ...(field ? [t('tournament:finish.item.field', { field })] : [])];
  return { title: '', detail: parts.join(' · ') };
}

/** „A und B“, „A, B und C“. */
function joinNames(names: readonly string[], and: string): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

function matchName(item: { matchNumber?: number; finalType?: string }, t: FinishT): string {
  const finalType = finalTypeOf(item.finalType);
  if (finalType !== undefined) {
    return t(`tournament:finals.labels.${finalType}`);
  }
  return item.matchNumber === undefined ? t('tournament:finish.item.matchUnknown') : t('tournament:finish.item.match', { number: item.matchNumber });
}

function serverItemView(item: Exclude<FinishItem, ReviewOpenItem>, tournament: TournamentForItems, t: FinishT, language: string): Omit<FinishItemView, 'id' | 'target'> {
  switch (item.kind) {
    case 'match_running':
    case 'match_undecided': {
      const name = matchName(item, t);
      const line = matchLine(tournament, item, t, language);
      return {
        title: t(item.kind === 'match_running' ? 'tournament:finish.item.matchRunning' : 'tournament:finish.item.matchUndecided', { name }),
        detail: line?.detail ?? null,
      };
    }
    case 'group_open':
    case 'group_stale': {
      const group = groupName(tournament, item.groupId);
      const suffix = group === null ? 'Single' : '';
      return {
        title: t(`tournament:finish.item.${item.kind === 'group_open' ? 'groupOpen' : 'groupStale'}${suffix}`, { group }),
        detail: t(item.kind === 'group_open' ? 'tournament:finish.item.groupOpenDetail' : 'tournament:finish.item.groupStaleDetail'),
      };
    }
    case 'tie_open': {
      const names = joinNames(item.teamIds.map((id) => teamDisplayName(tournament.teams, id)), t('tournament:finish.item.and'));
      const places = [...item.places].sort((a, b) => a - b).join('/');
      return {
        title: t('tournament:finish.item.tieOpen', { places }),
        detail: t('tournament:finish.item.tieOpenDetail', { names }),
      };
    }
    case 'notice_open': {
      const match = tournament.matches.find((candidate) => candidate.id === item.matchId);
      return {
        title: t('tournament:finish.item.noticeOpen'),
        detail: match?.matchNumber === undefined ? t('tournament:finish.item.noticeOpenDetailPlain') : t('tournament:finish.item.noticeOpenDetail', { number: match.matchNumber }),
      };
    }
    case 'clarification_open':
      return { title: t('tournament:finish.item.clarificationOpen'), detail: t('tournament:finish.item.clarificationOpenDetail') };
    case 'unknown':
      return { title: t('tournament:finish.item.unknown'), detail: t('tournament:finish.item.unknownDetail') };
  }
}

/** Der Eintrag zu einem offenen Punkt. */
export function describeFinishItem(item: FinishItem, tournament: TournamentForItems, t: FinishT, index: number, language = 'de'): FinishItemView {
  const target = finishItemTarget(item, tournament.id);
  if (item.kind === 'review_open') {
    const number = item.matchNumber;
    return {
      id: `review:${item.eventId}`,
      title: number === undefined ? t('tournament:finish.item.reviewOpenPlain') : t('tournament:finish.item.reviewOpen', { number }),
      detail: [t('tournament:finish.item.reviewOpenDetail'), ...(item.field ? [t('tournament:finish.item.field', { field: item.field })] : [])].join(' · '),
      target,
    };
  }
  return { id: `${item.kind}:${index}`, ...serverItemView(item, tournament, t, language), target };
}
