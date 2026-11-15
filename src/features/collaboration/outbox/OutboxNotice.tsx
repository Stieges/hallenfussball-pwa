/**
 * Status-Hinweis des Ausgangs (C2b): ein Banner nach dem LiveCockpit-Muster.
 * Prioritaet (Produktentscheidung): clientOutdated > authRequired > notReady > tournamentFinished > review.
 * `tournamentFinished` (R3-2a, @FU-018, @HE-070): nach dem Abschluss angekommene Einträge sind an die Turnierleitung übergeben.
 * `onReload` ist injiziert (Standard-Aufrufer: window.location.reload).
 * `onLogin` (@OB-087 Zeile 3): bei abgelaufener Sitzung steht „Anmelden“ am Hinweis; ohne `onLogin` (Aufrufer ohne Router) bleibt es beim Text.
 * Nach der Anmeldung gehen die wartenden Einträge von selbst raus (`OutboxSender.resumeAuth` über den neuen Token des Kontos).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../../../components/ui/Icons';
import { ArbeitsTaste } from '../../../components/ui/molecules/ArbeitsTaste';
import { HinweisMitTaste } from '../../../components/ui/molecules/HinweisMitTaste';
import type { OutboxStatus } from '../../../core/match/client/outboxTypes';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { afterFinishTotal, reviewTotal } from './useOutboxStatus';

export type OutboxNoticeKind = 'clientOutdated' | 'authRequired' | 'notReady' | 'tournamentFinished' | 'review';

export interface OutboxNoticeProps {
  status: OutboxStatus;
  /** Spielbezug fuer `pausedMatches`/`reviewByMatch`; ohne ihn gilt die Gesamtzahl. */
  matchId?: string;
  onReload: () => void;
  /** Öffnet die Anmeldung; ohne diese Funktion zeigt der Hinweis bei `authRequired` keine Taste. */
  onLogin?: () => void;
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

function afterFinishCountOf(status: OutboxStatus, matchId: string | undefined): number {
  return matchId === undefined ? afterFinishTotal(status) : afterFinishTotal(status, [matchId]);
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
  if (afterFinishCountOf(status, matchId) > 0) {
    return 'tournamentFinished';
  }
  return reviewCountOf(status, matchId) > 0 ? 'review' : null;
}

export function OutboxNotice({ status, matchId, onReload, onLogin }: OutboxNoticeProps) {
  const { t } = useTranslation('common');
  const kind = noticeKind(status, matchId);
  if (kind === null) {
    return null;
  }
  const text =
    kind === 'review'
      ? t('outbox.notice.review', { count: reviewCountOf(status, matchId) })
      : kind === 'tournamentFinished'
        ? t('outbox.notice.tournamentFinished', { count: afterFinishCountOf(status, matchId) })
        : t(`outbox.notice.${kind}`);
  // Mit Taste (@OB-087, „A“): die Taste steht rechts in der Zeile des Hinweises (`HinweisMitTaste`); die Hinweise ohne Aktion bleiben, wie sie waren.
  const taste = kind === 'clientOutdated'
    ? <ArbeitsTaste imHinweis onClick={onReload} data-testid="outbox-notice-reload">{t('outbox.notice.reloadNow')}</ArbeitsTaste>
    : kind === 'authRequired' && onLogin !== undefined
      ? <ArbeitsTaste imHinweis onClick={onLogin} data-testid="outbox-notice-login">{t('actions.login')}</ArbeitsTaste>
      : null;
  if (taste !== null) {
    const symbol = kind === 'authRequired' ? <Icons.Lock size={iconSizeValues.md} /> : <Icons.AlertTriangle size={iconSizeValues.md} />;
    return (
      <div data-testid="outbox-notice" data-kind={kind}>
        <HinweisMitTaste symbol={symbol} titel={text} taste={taste} />
      </div>
    );
  }
  return (
    <div data-testid="outbox-notice" data-kind={kind} role="status" style={noticeStyle}>
      <span>{text}</span>
    </div>
  );
}
