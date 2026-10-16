/**
 * Status-Hinweis des Ausgangs (C2b): ein Banner nach dem LiveCockpit-Muster.
 * Prioritaet (Produktentscheidung): clientOutdated > authRequired > notReady > review.
 * `onReload` ist injiziert (Standard-Aufrufer: window.location.reload).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { OutboxStatus } from '../../../core/match/client/outboxTypes';
import { cssVars } from '../../../design-tokens';
import { reviewTotal } from './useOutboxStatus';

export type OutboxNoticeKind = 'clientOutdated' | 'authRequired' | 'notReady' | 'review';

export interface OutboxNoticeProps {
  status: OutboxStatus;
  /** Spielbezug fuer `pausedMatches`/`reviewByMatch`; ohne ihn gilt die Gesamtzahl. */
  matchId?: string;
  onReload: () => void;
}

const noticeStyle: CSSProperties = {
  background: cssVars.colors.warningBannerBg,
  border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.semibold,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: cssVars.spacing.sm,
};

function reviewCountOf(status: OutboxStatus, matchId: string | undefined): number {
  return matchId === undefined ? reviewTotal(status) : reviewTotal(status, [matchId]);
}

function noticeKind(status: OutboxStatus, matchId: string | undefined): OutboxNoticeKind | null {
  if (status.clientOutdated) {
    return 'clientOutdated';
  }
  if (status.authRequired) {
    return 'authRequired';
  }
  if (matchId !== undefined && status.pausedMatches[matchId] === 'notReady') {
    return 'notReady';
  }
  return reviewCountOf(status, matchId) > 0 ? 'review' : null;
}

export function OutboxNotice({ status, matchId, onReload }: OutboxNoticeProps) {
  const { t } = useTranslation('common');
  const kind = noticeKind(status, matchId);
  if (kind === null) {
    return null;
  }
  const text =
    kind === 'review'
      ? t('outbox.notice.review', { count: reviewCountOf(status, matchId) })
      : t(`outbox.notice.${kind}`);
  return (
    <div data-testid="outbox-notice" data-kind={kind} role="status" style={noticeStyle}>
      <span>{text}</span>
      {kind === 'clientOutdated' && (
        <Button data-testid="outbox-notice-reload" variant="secondary" onClick={onReload}>
          {t('outbox.notice.reloadNow')}
        </Button>
      )}
    </div>
  );
}
