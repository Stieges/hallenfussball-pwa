/**
 * Liste „Nach dem Ende eingetroffen“ (@LZ-039, @LZ-040, @FU-018; Mockup Zustand C): zu jedem Eintrag, der nach dem Abschluss ankam,
 * die Zeile „Tor für SC Ost (#7), Spiel 15“, das Spiel, wer wann erfasst hat und wann er ankam. Namen nach E8: Mitglieder-
 * liste (Server `label`), das eigene Konto mit dem eigenen Namen, sonst „Helfer-Gerät“ – nie eine E-Mail. Rein bis auf `t`.
 */
import type { Tournament } from '../../../types/tournament';
import type { LateEntry } from '../../../core/repositories/lateEntriesRead';
import { EventTypeSchema } from '../../../core/match/types';
import { eventTypeKey } from '../../collaboration/outbox/rejectionText';
import { slotLabel, teamDisplayName } from '../../../core/view/originText';
import { formatClock } from './finishFormat';
import type { FinishT } from './finishItems';

export interface LateEntryView {
  id: string;
  title: string;
  matchLine: string | null;
  byLine: string;
  receivedLine: string | null;
}

export interface LateEntryContext {
  tournament: Pick<Tournament, 'teams' | 'matches' | 'groups'>;
  /** Konto dieses Geräts: sein Eintrag trägt den eigenen Namen. */
  self?: { id: string; name: string | null };
  language?: string;
}

export function describeLateEntry(entry: LateEntry, ctx: LateEntryContext, t: FinishT): LateEntryView {
  const language = ctx.language ?? 'de';
  const type = EventTypeSchema.safeParse(entry.type);
  const typeLabel = t(`common:${type.success ? eventTypeKey(type.data) : 'outbox.eventType.unknown'}`);
  const match = ctx.tournament.matches.find((candidate) => candidate.id === entry.matchId);
  const team = entry.teamId === null ? null : teamDisplayName(ctx.tournament.teams, entry.teamId);
  const what = team === null
    ? t('tournament:finish.late.whatNoTeam', { type: typeLabel })
    : entry.playerNumber === null
      ? t('tournament:finish.late.what', { type: typeLabel, team })
      : t('tournament:finish.late.whatPlayer', { type: typeLabel, team, number: entry.playerNumber });
  const number = match?.matchNumber;
  const title = number === undefined
    ? t('tournament:finish.late.entryNoNumber', { what })
    : t('tournament:finish.late.entry', { what, number });
  const slots = { teams: ctx.tournament.teams, matches: ctx.tournament.matches, groups: ctx.tournament.groups };
  const matchLine = match === undefined ? null : `${slotLabel(match.slotA, slots)} – ${slotLabel(match.slotB, slots)}`;
  const name = entry.actorName ?? (ctx.self?.id === entry.actor ? ctx.self.name : null) ?? t('tournament:finish.late.unknownDevice');
  const at = formatClock(entry.recordedAt, language);
  const received = formatClock(entry.receivedAt, language);
  return {
    id: String(entry.id),
    title,
    matchLine,
    byLine: at === null ? t('tournament:finish.late.byNoTime', { name }) : t('tournament:finish.late.by', { name, time: at }),
    receivedLine: received === null ? null : t('tournament:finish.late.received', { time: received }),
  };
}
