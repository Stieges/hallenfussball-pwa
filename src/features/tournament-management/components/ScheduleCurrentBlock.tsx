/**
 * ScheduleCurrentBlock – oben im Spielplan der Turnierleitung steht die Karte zum laufenden oder nächsten Spiel (@ZP-109).
 *
 * Die Wahl trifft `currentBlockOf` (wie der Zuschauer-Kopf, @ZM-141): läuft ein Spiel, eine Karte je laufendem Spiel (zwei Felder, zwei
 * Karten), sonst das nächste. Sind alle beendet, steht keine Karte; im Bearbeiten-Modus blendet der Aufrufer sie aus. Kein Filter und
 * keine Status-Wahl ändert sie. Die Haupttaste führt ins Cockpit und kommt aus `matchActionsFor` (kein Recht: keine Taste; Helfer
 * „Zum Cockpit“, Turnierleitung beim geplanten Spiel „Spiel im Cockpit anpfeifen“); der Wechsel bei laufendem anderen Spiel läuft über den
 * Handler des Aufrufers (@SL-194). „Danach“ nennt das nächste Spiel desselben Felds, nie das laufende selbst.
 * Darunter schwebt unter 1280 Bildpunkten die Taste „Zum laufenden Spiel“ (`JumpToLiveButton`).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { GeneratedSchedule } from '../../../core/generators';
import type { MatchView, TournamentView, ViewLocale } from '../../../core/view';
import type { Match, Tournament } from '../../../types/tournament';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { MatchStatusBadge } from '../../../components/ui/molecules/MatchStatusBadge';
import { MatchClock } from '../../../components/ui/molecules/MatchClock';
import { CurrentMatchCard } from '../../../components/schedule/CurrentMatchCard';
import { currentBlockOf, kastenOf } from '../../../components/schedule/currentBlockOf';
import { buildSideContext, matchHeading, sideName } from '../../../components/schedule/matchSides';
import { cardStatusOf } from '../../../components/schedule/matchResult';
import { matchActionsFor, type MatchActionRights } from '../../../components/schedule/actionMenu/matchActions';
import { useElapsedSeconds } from '../../../components/schedule/useTickingNow';
import { useSpectatorClocks } from '../../../components/schedule/useSpectatorClocks';
import { JumpToLiveButton } from './JumpToLiveButton';

export interface ScheduleCurrentBlockProps {
  view: TournamentView;
  schedule: GeneratedSchedule;
  tournament: Pick<Tournament, 'teams' | 'groups'>;
  /** Spiele mit den Ständen der Verwaltung (Uhr und Zeitstrafen) */
  currentMatches: readonly Match[];
  elapsedSeconds: (matchId: string) => number | undefined;
  locale: ViewLocale;
  rights: MatchActionRights;
  /** Ins Cockpit (mit Rückfrage bei laufendem anderen Spiel, @SL-194); ohne Handler keine Taste */
  onNavigateToCockpit?: (matchId: string) => void;
}

const blockStyle: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.md };
const dotStyle: CSSProperties = {
  display: 'inline-block',
  width: cssVars.spacing.sm,
  height: cssVars.spacing.sm,
  marginRight: cssVars.spacing.xs,
  borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.statusLive,
};
const headLeftStyle: CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', columnGap: cssVars.spacing.sm, rowGap: cssVars.spacing.xs };
const timeStyle: CSSProperties = { color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md };
const timeStrongStyle: CSSProperties = { color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.extrabold };
const actionsStyle: CSSProperties = { display: 'grid', gap: cssVars.spacing.xs, padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}` };
const hintStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const afterStyle: CSSProperties = {
  margin: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}`,
  paddingTop: cssVars.spacing.sm,
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  display: 'grid',
  gap: cssVars.spacing.xs,
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textSecondary,
};
const afterTeamStyle: CSSProperties = { color: cssVars.colors.textPrimary, fontWeight: cssVars.fontWeights.semibold, overflowWrap: 'break-word' };

/** Nur der Weg ins Cockpit ist hier angeschlossen; alle anderen Aktionen des Blatts bleiben in der Auswahl der Liste */
const COCKPIT_ONLY = { enterResult: false, cockpit: true, shiftFrom: false, referee: false, field: false, forfeit: false, correct: false, endAndEnter: false } as const;

export function ScheduleCurrentBlock({
  view, schedule, tournament, currentMatches, elapsedSeconds, locale, rights, onNavigateToCockpit,
}: ScheduleCurrentBlockProps): ReactElement | null {
  const { t } = useTranslation('tournament');
  const clockOf = useSpectatorClocks(view, useElapsedSeconds(view, currentMatches, elapsedSeconds), currentMatches);
  const current = currentBlockOf(view);
  // Alle beendet: keine Karte (@ZP-109); „zuletzt beendet“ gibt es nur beim Zuschauer
  if (current === null || current.kind === 'last') {
    return null;
  }
  const shown: readonly MatchView[] = current.kind === 'live' ? current.matches : [current.match];
  const sides = buildSideContext({ teams: tournament.teams, groups: tournament.groups, matches: schedule.allMatches, view, locale }, schedule.allMatches);
  const nameOf = (mv: MatchView): string => {
    const scheduled = schedule.allMatches.find((m) => m.id === mv.id);
    return (scheduled === undefined ? undefined : matchHeading(scheduled, sides)) ?? t('scheduleCurrent.match', { number: mv.matchNumber ?? '' });
  };

  const card = (mv: MatchView): ReactElement | null => {
    const scheduled = schedule.allMatches.find((m) => m.id === mv.id);
    if (scheduled === undefined) {
      return null;
    }
    const live = current.kind === 'live';
    const status = cardStatusOf(mv);
    const clock = status === 'running' ? clockOf(mv.id) : null;
    const cockpit = matchActionsFor({ status: mv.status, rights, wired: COCKPIT_ONLY }).find((a) => a === 'kickOff' || a === 'toCockpit');
    const after = live ? view.currentFor(mv.field).next : undefined;
    const afterScheduled = after === undefined || after.id === mv.id ? undefined : schedule.allMatches.find((m) => m.id === after.id);
    // Pause, Halbzeit, Verlängerung, Strafstoßschießen: das Wort steht im Kopf (Abzeichen), der Zustand ist nie nur an der Farbe der Uhr zu erkennen (@OB-066)
    const stateWord = live && mv.badge.kind === 'badge' && mv.badge.state !== 'live' ? mv.badge : null;
    const head = (
      <span style={headLeftStyle}>
        <span data-testid={`schedule-current-meta-${mv.id}`}>
          {live && <span style={dotStyle} aria-hidden="true" />}
          {t(live ? 'scheduleCurrent.live' : 'scheduleCurrent.next', { name: nameOf(mv), field: mv.field })}
        </span>
        {stateWord !== null && <MatchStatusBadge model={stateWord} size="card" testId={`schedule-current-badge-${mv.id}`} />}
      </span>
    );
    const headRight = live
      ? (clock !== null ? <MatchClock clock={clock} size="card" testId={`schedule-current-clock-${mv.id}`} /> : undefined)
      : (mv.kickoff === undefined ? undefined : (
        <span style={timeStyle} data-testid={`schedule-current-time-${mv.id}`}>
          <span style={timeStrongStyle}>{mv.kickoff.time}</span>{t('scheduleCurrent.clockUnit') === '' ? '' : ` ${t('scheduleCurrent.clockUnit')}`}
        </span>
      ));
    return (
      <CurrentMatchCard
        key={mv.id}
        match={mv}
        scheduled={scheduled}
        sides={sides}
        clock={clock}
        kasten={kastenOf(mv, view)}
        head={head}
        headRight={headRight}
        headVariant="plain"
        frame="live"
        showPlannedZero={false}
        testIdPrefix="schedule-current"
        focusTarget={`${nameOf(mv)}, ${t('scheduleCurrent.field', { field: mv.field })}`}
        kind={current.kind}
        actions={cockpit !== undefined && onNavigateToCockpit !== undefined ? (
          <div style={actionsStyle}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Icons.Monitor size={iconSizeValues.sm} />}
              onClick={() => onNavigateToCockpit(mv.id)}
              data-testid={`schedule-current-cockpit-${mv.id}`}
              data-primary
            >
              {t(cockpit === 'kickOff' ? 'scheduleCurrent.kickOff' : 'scheduleCurrent.toCockpit')}
            </Button>
            {cockpit === 'kickOff' && <p style={hintStyle}>{t('scheduleCurrent.kickOffHint')}</p>}
          </div>
        ) : undefined}
        footer={after !== undefined && afterScheduled !== undefined ? (
          <div style={afterStyle} data-testid={`schedule-current-after-${mv.id}`}>
            <span>
              <strong style={{ color: cssVars.colors.textPrimary }}>{t('scheduleCurrent.after')}</strong>{' '}
              {t('scheduleCurrent.afterMatch', { name: nameOf(after), time: after.kickoff?.time ?? '' })}
            </span>
            <span style={afterTeamStyle}>{sideName(afterScheduled, 'A', sides)}</span>
            <span style={afterTeamStyle}>{sideName(afterScheduled, 'B', sides)}</span>
          </div>
        ) : undefined}
      />
    );
  };

  const firstLive = current.kind === 'live' ? current.matches[0] : undefined;
  return (
    <section style={blockStyle} data-testid="schedule-current" data-current-kind={current.kind} data-no-float-cover>
      {shown.map(card)}
      {firstLive !== undefined && <JumpToLiveButton targetId={`schedule-current-card-${firstLive.id}`} />}
    </section>
  );
}
