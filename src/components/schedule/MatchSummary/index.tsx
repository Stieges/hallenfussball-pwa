/**
 * MatchSummary - Summary view for finished matches
 *
 * Shows score and events when clicking on the circle of a finished match.
 * Responsive: Dialog on desktop, BottomSheet on mobile.
 *
 * @see docs/concepts/MATCH-SUMMARY-KONZEPT.md
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { useBreakpoint } from '../../../hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { ScoreHeader } from './ScoreHeader';
import { EventList } from './EventList';
import type { RuntimeMatchEvent } from '../../../types/tournament';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Home team score */
  homeScore: number;
  /** Away team score */
  awayScore: number;
  /** Home team ID (for event matching) */
  homeTeamId: string;
  /** Away team ID (for event matching) */
  awayTeamId: string;
  /** Home team display name */
  homeTeamName: string;
  /** Away team display name */
  awayTeamName: string;
  /** Match events */
  events: RuntimeMatchEvent[];
  /** Callback to edit the score */
  onEditScore?: () => void;
  /** Callback to edit an event */
  onEditEvent?: (event: RuntimeMatchEvent) => void;
}

// ---------------------------------------------------------------------------
// Desktop Dialog Component
// ---------------------------------------------------------------------------

function MatchSummaryDialog({
  isOpen,
  onClose,
  homeScore,
  awayScore,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  events,
  onEditScore,
  onEditEvent,
}: MatchSummaryProps) {
  const { t } = useTranslation('tournament');

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.full,
    cursor: 'pointer',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.xl,
  };

  const contentStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  };

  const eventsSectionStyle: CSSProperties = {
    maxHeight: 300,
    overflowY: 'auto',
  };

  return (
    <DialogSurface
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={dialogWidths.md}
      zIndex={cssVars.zIndex.floating}
      ariaLabel={t('matchSummary.title')}
      testId="match-summary-dialog"
      scrimTestId="match-summary-backdrop"
    >
      <div>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('matchSummary.title')}</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            aria-label={t('matchSummary.close')}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* Score */}
          <ScoreHeader
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            homeScore={homeScore}
            awayScore={awayScore}
            onEditScore={onEditScore}
          />

          {/* Events */}
          <div>
            <h3 style={sectionTitleStyle}>{t('matchSummary.events.title')}</h3>
            <div style={eventsSectionStyle}>
              <EventList
                events={events}
                homeTeamId={homeTeamId}
                awayTeamId={awayTeamId}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                onEventEdit={onEditEvent}
              />
            </div>
          </div>
        </div>
      </div>
    </DialogSurface>
  );
}

// ---------------------------------------------------------------------------
// Mobile BottomSheet Component
// ---------------------------------------------------------------------------

function MatchSummarySheet({
  isOpen,
  onClose,
  homeScore,
  awayScore,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  events,
  onEditScore,
  onEditEvent,
}: MatchSummaryProps) {
  const { t } = useTranslation('tournament');

  const sectionTitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  };

  const eventsSectionStyle: CSSProperties = {
    maxHeight: '40vh',
    overflowY: 'auto',
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('matchSummary.title')}
    >
      <div style={contentStyle}>
        {/* Score */}
        <ScoreHeader
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          homeScore={homeScore}
          awayScore={awayScore}
          onEditScore={onEditScore}
          compact
        />

        {/* Events */}
        <div>
          <h3 style={sectionTitleStyle}>{t('matchSummary.events.title')}</h3>
          <div style={eventsSectionStyle}>
            <EventList
              events={events}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              onEventEdit={onEditEvent}
              compact
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Main Component - Responsive Switch
// ---------------------------------------------------------------------------

export function MatchSummary(props: MatchSummaryProps) {
  const { breakpoint } = useBreakpoint();
  const isMobile = breakpoint === 'mobile';

  if (isMobile) {
    return <MatchSummarySheet {...props} />;
  }

  return <MatchSummaryDialog {...props} />;
}

export default MatchSummary;
