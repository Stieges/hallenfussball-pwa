/**
 * toMatchSummary – ein Spiel des Spielplans als `MatchSummary` für das Cockpit (aus `ManagementTab` ausgelagert, Plan LT-3, R-LT3).
 * Dazu die getragenen Farben der Seiten für die Zeile „Nächstes“ (@SL-160, @SL-161): über das Spiel des Turniers und `wornColors`
 * (@W3-028: vor dem Anpfiff die Teamfarbe, danach die gespeicherte Farbe), nie über das `ScheduledMatch`; ohne Farbe `null`.
 */
import type { TFunction } from 'i18next';
import type { ScheduledMatch } from '../../../core/generators';
import { wornColors } from '../../../core/models/kit';
import { matchLabelText } from '../../../core/models/slotLabel';
import { sideDisplay, type SideContext } from '../../../components/schedule/matchSides';
import type { MatchSummary } from '../../../components/live-cockpit/types';
import type { Tournament } from '../../../types/tournament';

export interface MatchSummaryContext {
  tournament: Pick<Tournament, 'matches' | 'teams'>;
  sides: SideContext;
  t: TFunction<'tournament'>;
}

export function toMatchSummary(sm: ScheduledMatch, ctx: MatchSummaryContext): MatchSummary {
  const home = sideDisplay(sm, 'A', ctx.sides);
  const away = sideDisplay(sm, 'B', ctx.sides);
  const match = ctx.tournament.matches.find((m) => m.id === sm.id);
  const farben = match ? wornColors(match, ctx.tournament.teams) : { a: undefined, b: undefined };
  return {
    id: sm.id,
    number: sm.matchNumber,
    phaseLabel: sm.label ? matchLabelText(sm.label) : (sm.phase === 'groupStage' ? ctx.t('management.groupStage') : ctx.t('management.finalRound')),
    scheduledKickoff: sm.time,
    fieldId: `field-${sm.field}`,
    homeTeam: { id: home.id, name: home.name },
    awayTeam: { id: away.id, name: away.name },
    tournamentPhase: sm.phase, // For detecting phase changes
    farben: { home: farben.a ?? null, away: farben.b ?? null },
  };
}
