/**
 * CurrentMatchPanel - Hauptpanel für aktuelles Spiel
 *
 * Zeigt: Scoreboard, Timer, Controls, Events
 * Reine Präsentation - alle Daten über Props
 *
 * QW-001: Uses modal dialogs instead of window.prompt/confirm
 */

import { CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { Card } from '../ui';
import { useToast } from '../ui/Toast';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LiveMatch, MatchSummary } from './MatchCockpit';
import { TiebreakerBanner } from './TiebreakerBanner';
import { PenaltyShootoutDialog } from './PenaltyShootoutDialog';
import { EditScoreDialog } from './EditScoreDialog';
import { EditTimeDialog } from './EditTimeDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';

// Panel sub-components (extracted for maintainability)
import {
  LastMatchBanner,
  MatchMeta,
  Scoreboard,
  FinishPanel,
  EventsList,
} from './panels';

interface CurrentMatchPanelProps {
  currentMatch: LiveMatch | null;
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;

  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onAdjustTime(matchId: string, newElapsedSeconds: number): void;
  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;

  // Tiebreaker callbacks
  onStartOvertime?(matchId: string): void;
  onStartGoldenGoal?(matchId: string): void;
  onStartPenaltyShootout?(matchId: string): void;
  onRecordPenaltyResult?(matchId: string, homeScore: number, awayScore: number): void;
  onForceFinish?(matchId: string): void;
  onCancelTiebreaker?(matchId: string): void;
}

export const CurrentMatchPanel: React.FC<CurrentMatchPanelProps> = ({
  currentMatch,
  lastFinishedMatch,
  onStart,
  onPause,
  onResume,
  onFinish,
  onGoal,
  onUndoLastEvent,
  onManualEditResult,
  onAdjustTime,
  onLoadNextMatch,
  onReopenLastMatch,
  // Tiebreaker callbacks
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onRecordPenaltyResult,
  onForceFinish,
  onCancelTiebreaker,
}) => {
  const { t } = useTranslation('cockpit');
  useToast();
  const isMobile = useIsMobile();

  // QW-001: Dialog states
  const [showEditScoreDialog, setShowEditScoreDialog] = useState(false);
  const [showEditTimeDialog, setShowEditTimeDialog] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.md,
  };

  const cardTitleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  };

  const cardSubtitleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  return (
    <Card>
      {/* HEADER */}
      <div style={cardHeaderStyle}>
        <div>
          <div style={cardTitleStyle}>{t('currentMatch.title')}</div>
          <div style={cardSubtitleStyle}>
            {currentMatch
              ? t('currentMatch.subtitle', { number: currentMatch.number, phase: currentMatch.phaseLabel })
              : t('currentMatch.noActiveMatch')}
          </div>
        </div>
        <div style={cardSubtitleStyle}>
          {currentMatch && t('currentMatch.scheduledKickoff', { time: currentMatch.scheduledKickoff })}
        </div>
      </div>

      {/* LAST MATCH BANNER */}
      {lastFinishedMatch && currentMatch?.status === 'NOT_STARTED' && (
        <LastMatchBanner
          lastMatch={lastFinishedMatch}
          onReopen={() => onReopenLastMatch(lastFinishedMatch.match.fieldId)}
        />
      )}

      {/* MATCH CONTENT */}
      {currentMatch ? (
        <>
          {/* MATCH META */}
          <MatchMeta
            refereeName={currentMatch.refereeName}
            matchId={currentMatch.id}
            durationSeconds={currentMatch.durationSeconds}
          />

          {/* SCOREBOARD */}
          <Scoreboard
            match={currentMatch}
            onGoal={onGoal}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onFinish={onFinish}
            onOpenTimeDialog={() => setShowEditTimeDialog(true)}
            onOpenRestartConfirm={() => setShowRestartConfirm(true)}
          />

          {/* TIEBREAKER BANNER - shown when finals match ends in draw */}
          {currentMatch.awaitingTiebreakerChoice && onStartOvertime && onStartGoldenGoal && onStartPenaltyShootout && onForceFinish && (
            <TiebreakerBanner
              match={currentMatch}
              onStartOvertime={onStartOvertime}
              onStartGoldenGoal={onStartGoldenGoal}
              onStartPenaltyShootout={onStartPenaltyShootout}
              onForceFinish={onForceFinish}
            />
          )}

          {/* PENALTY SHOOTOUT DIALOG - shown during penalty phase */}
          {currentMatch.playPhase === 'penalty' && onRecordPenaltyResult && onCancelTiebreaker && (
            <PenaltyShootoutDialog
              match={currentMatch}
              onSubmit={onRecordPenaltyResult}
              onCancel={onCancelTiebreaker}
            />
          )}

          {/* FINISH PANEL */}
          {currentMatch.status === 'FINISHED' && (
            <FinishPanel
              match={currentMatch}
              onResume={() => onStart(currentMatch.id)}
              onEdit={() => setShowEditScoreDialog(true)}
              onNext={() => onLoadNextMatch(currentMatch.fieldId)}
            />
          )}

          {/* EVENTS LIST */}
          <EventsList
            events={currentMatch.events.map(e => ({
              id: e.id,
              time: e.timestampSeconds,
              type: e.type,
              payload: e.payload,
              scoreAfter: e.scoreAfter
            }))}
            onUndo={() => onUndoLastEvent(currentMatch.id)}
            onManualEdit={() => setShowEditScoreDialog(true)}
          />
        </>
      ) : (
        <div style={{ padding: cssVars.spacing.xl, textAlign: 'center', color: cssVars.colors.textSecondary }}>
          {t('currentMatch.emptyState')}
        </div>
      )}

      {/* QW-001: Modal Dialogs */}
      {showEditScoreDialog && currentMatch && (
        <EditScoreDialog
          homeTeamName={currentMatch.homeTeam.name}
          awayTeamName={currentMatch.awayTeam.name}
          currentHomeScore={currentMatch.homeScore}
          currentAwayScore={currentMatch.awayScore}
          onSubmit={(homeScore, awayScore) => {
            onManualEditResult(currentMatch.id, homeScore, awayScore);
            setShowEditScoreDialog(false);
          }}
          onCancel={() => setShowEditScoreDialog(false)}
        />
      )}

      {showEditTimeDialog && currentMatch && (
        <EditTimeDialog
          currentElapsedSeconds={currentMatch.elapsedSeconds}
          durationSeconds={currentMatch.durationSeconds}
          onSubmit={(newElapsedSeconds) => {
            onAdjustTime(currentMatch.id, newElapsedSeconds);
            setShowEditTimeDialog(false);
          }}
          onCancel={() => setShowEditTimeDialog(false)}
        />
      )}

      {showRestartConfirm && currentMatch && (
        <ConfirmDialog
          title={t('currentMatch.restartTitle')}
          message={t('currentMatch.restartMessage')}
          confirmLabel={t('currentMatch.restart')}
          cancelLabel={t('currentMatch.cancel')}
          variant="danger"
          onConfirm={() => {
            onStart(currentMatch.id);
            setShowRestartConfirm(false);
          }}
          onCancel={() => setShowRestartConfirm(false)}
        />
      )}
    </Card>
  );
};
