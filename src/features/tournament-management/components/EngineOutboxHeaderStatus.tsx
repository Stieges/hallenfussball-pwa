/**
 * EngineOutboxHeaderStatus (A-08f3e3, M-1): wartende und nicht übernommene Einträge im Kopf der
 * Turnierverwaltung -- auch im Spielplan. Datenquelle wie `AdminHeader.tsx` (useRejectedOutboxDialog +
 * RejectedOutboxDialog); bewusst OHNE den Realtime-Hinweis von SyncStatusIndicator (@FU-087). Im Live-Tab zeigt
 * das Cockpit denselben Status selbst. Szenarien: @FU-002 („1 Eintrag wartet“), @FU-004 (Ablehnung mit Details).
 * Fixrunde 1: unter 400 px nur Symbol mit Zahl (Text als aria-label/Tooltip, Muster Offline-Marke @OB-021, I-4);
 * die Ablehnungsliste nennt Spiel und Teams (M-4).
 */
import { useCallback, useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ui/Toast';
import { cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { useCompactHeader } from '../../../hooks/useCompactHeader';
import { buildValidMatches } from '../../../hooks/engineMatchModel';
import { SyncRejectedHint } from '../../collaboration/components/SyncRejectedHint';
import { RejectedOutboxDialog } from '../../collaboration/outbox/RejectedOutboxDialog';
import { useRejectedOutboxDialog } from '../../collaboration/outbox/useRejectedOutboxDialog';
import type { EventMatch } from '../../collaboration/outbox/rejectionText';

const wrapStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, marginRight: cssVars.spacing.sm, flexShrink: 0 };

const waitingStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.xs,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
  background: cssVars.colors.warningBannerBg,
  border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  whiteSpace: 'nowrap',
};

const rejectedStyle: CSSProperties = {
  ...waitingStyle,
  minHeight: cssVars.touchTargets.minimum,
  background: cssVars.colors.errorLight,
  border: `1px solid ${cssVars.colors.error}`,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
};

const compactStyle: CSSProperties = { minWidth: cssVars.touchTargets.minimum, minHeight: cssVars.touchTargets.minimum, paddingLeft: 0, paddingRight: 0 };

export function EngineOutboxHeaderStatus({ tournament }: { tournament: Tournament }) {
  const { t } = useTranslation('common');
  const { showError } = useToast();
  const kompakt = useCompactHeader();
  const outbox = useRejectedOutboxDialog(tournament.id, showError);
  const matches = useMemo(() => new Map(buildValidMatches(tournament).map((entry) => [entry.matchId, entry])), [tournament]);
  const matchFor = useCallback((matchId: string): EventMatch | undefined => {
    const entry = matches.get(matchId);
    return entry
      ? { number: entry.meta.number, home: entry.meta.homeTeam.name, away: entry.meta.awayTeam.name, teamAId: entry.ctx.teamAId, teamBId: entry.ctx.teamBId }
      : undefined;
  }, [matches]);
  const waitingText = t('syncStatus.waiting', { count: outbox.pendingCount });
  const rejectedText = t('outbox.rejected.countLabel', { count: outbox.rejectedCount });

  return (
    <span style={wrapStyle} data-testid="engine-outbox-status">
      {outbox.pendingCount > 0 && (
        <span role="status" data-testid="engine-outbox-waiting" aria-label={waitingText} title={waitingText} style={kompakt ? { ...waitingStyle, ...compactStyle } : waitingStyle}>
          {kompakt ? <><span aria-hidden="true">⏳</span><span aria-hidden="true">{outbox.pendingCount}</span></> : waitingText}
        </span>
      )}
      {outbox.rejectedCount > 0 && !kompakt && (
        <SyncRejectedHint count={outbox.rejectedCount} style={rejectedStyle} onShowRejected={outbox.show} />
      )}
      {outbox.rejectedCount > 0 && kompakt && (
        <button type="button" data-testid="sync-status-rejected" data-rejected={outbox.rejectedCount} aria-label={rejectedText} title={rejectedText} style={{ ...rejectedStyle, ...compactStyle }} onClick={outbox.show}>
          <span aria-hidden="true">⚠️</span><span aria-hidden="true">{outbox.rejectedCount}</span>
        </button>
      )}
      <RejectedOutboxDialog isOpen={outbox.isOpen} onClose={outbox.close} entries={outbox.entries} onDismiss={outbox.handleDismiss} matchFor={matchFor} />
    </span>
  );
}
