/**
 * TeamHelpersCategory – „Team & Helfer“ (A-18a, GA5, Mockup M4): Die Turnierleitung zeigt den Helfer-QR-Code, sieht die
 * Anfragen, lässt zu oder lehnt ab (Zulassen: Feld wählen, dann eine von vier Zahlknöpfen, S-1) und verwaltet die Zugänge
 * (entziehen, nur zusehen). Alte Einladungswege gibt es nicht mehr (@OB-005): Helfer kommen über den QR-Code hinzu.
 *
 * Alles läuft über die Server-Funktionen aus `_008` (`helperAccessRpc`); die Seite fragt nur ab, wenn die Rolle das Recht
 * „Helfer verwalten“ hat (@HE-062), alle 2 s und nur bei sichtbarer Seite. Ändern geht nur mit Netz (@HE-047).
 *
 * @see .superpowers/sdd/2026-10-03-mvp-bauplan/plan-GA5-helfer-v2.md § A-18a, Mockup M4 (r0–r10)
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../../../../components/ui/Icons';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { breakpointValues, cssVars, dialogWidths, iconSizeValues } from '../../../../design-tokens';
import type { Tournament } from '../../../../types/tournament';
import { useAuth } from '../../../auth/hooks/useAuth';
import { useCanState } from '../../../auth/hooks/useCan';
import { CategoryPage } from '../shared';
import { AccessChangeDialog, RenewCodeDialog } from './AccessDialogs';
import { ApproveSheet } from './ApproveSheet';
import { HelperCodeCard } from './HelperCodeCard';
import { HelperList } from './HelperList';
import { HelperNoRight } from './HelperNoRight';
import { JoinRequestList } from './JoinRequestList';
import type { HelperRowModel, JoinRequestRow } from './helperAdminModel';
import { useHelperAdminActions } from './useHelperAdminActions';
import { noticeText, noticeTitle } from './noticeStyles';
import { useJoinRequests } from './useJoinRequests';

interface TeamHelpersCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

type Dialog =
  | { type: 'approve'; request: JoinRequestRow }
  | { type: 'renew' }
  | { type: 'access'; kind: 'revoke' | 'watch_only'; row: HelperRowModel };

// Zwei Spalten (QR links, Anfragen und Helfer rechts) richten sich nach der Breite des Inhalts, nicht des Fensters: im Admin
// Center nimmt die Seitenleiste Platz (Mockup M4, Laptop). Ab `breakpoints.tablet` Inhaltsbreite stehen sie nebeneinander.
const columnsCss = `
  .th-cols { display: grid; gap: ${cssVars.spacing.md}; align-items: start; grid-template-columns: minmax(0, 1fr); }
  @container (min-width: ${breakpointValues.tablet}px) {
    .th-cols { grid-template-columns: ${dialogWidths.sm} minmax(0, 1fr); gap: ${cssVars.spacing.lg}; }
  }
`;
const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md, alignContent: 'start', minWidth: 0 };

export function TeamHelpersCategory({ tournamentId, tournament }: TeamHelpersCategoryProps) {
  const { t } = useTranslation('admin');
  const { user, isAuthenticated } = useAuth();
  // @HE-062: ohne das Recht „Helfer verwalten“ (Helfer-Gerät, Co-Admin ohne Recht) keine Abfrage, nur der Grund.
  const { allowed: canManage, isLoading: roleLoading } = useCanState('manageHelpers', tournamentId);
  const enabled = isAuthenticated && user !== null && canManage;

  const { list, loadState, offline, refresh } = useJoinRequests(tournamentId, enabled);
  const actions = useHelperAdminActions(tournamentId, enabled, refresh);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [lastField, setLastField] = useState<number | null>(null);

  const header = { icon: '👥', title: t('teamHelpers.title'), description: t('teamHelpers.description') };

  if (!isAuthenticated || !user) {
    return (
      <CategoryPage {...header}>
        <InlineNotice tone="info" data-testid="auth-required">
          <b style={noticeTitle}>{t('teamHelpers.authRequired')}</b>
          <span style={noticeText}>{t('teamHelpers.authRequiredDesc')}</span>
          <span style={noticeText}>{t('teamHelpers.goToSettings')}</span>
        </InlineNotice>
      </CategoryPage>
    );
  }
  // Solange die Rolle noch geladen wird (neues Gerät, kein Rollen-Gedächtnis), kein „kein Recht“: auch der Eigentümer sähe es kurz
  if (roleLoading && !canManage) {
    return (
      <CategoryPage {...header}>
        <p style={{ margin: 0, color: cssVars.colors.textSecondary }} role="status" data-testid="role-loading">{t('teamHelpers.loading')}</p>
      </CategoryPage>
    );
  }
  if (!canManage || loadState === 'noRight' || actions.codeState === 'noRight') {
    return (
      <CategoryPage {...header}>
        <HelperNoRight />
      </CategoryPage>
    );
  }

  const requests = list?.requests ?? [];
  const members = list?.members ?? [];
  const noNet = !actions.isOnline || offline;
  const locked = noNet || actions.busy;
  const noticeMessage = (() => {
    const n = actions.notice;
    if (n === null) {
      return null;
    }
    switch (n.kind) {
      case 'offline': return null; // zeigt der Hinweis „Geht nur mit Netz“
      case 'alreadyDecided': return n.decidedBy === null ? t('teamHelpers.notice.alreadyDecidedUnknown') : t('teamHelpers.notice.alreadyDecided', { name: n.decidedBy });
      case 'requestExpired': return t('teamHelpers.notice.requestExpired');
      default: return t('teamHelpers.notice.failed');
    }
  })();
  const showOffline = noNet || actions.notice?.kind === 'offline';

  const close = () => setDialog(null);
  const left = (
    <div style={stack}>
      <HelperCodeCard code={actions.code} state={actions.codeState} disabled={locked} onRenew={() => setDialog({ type: 'renew' })} />
    </div>
  );
  const right = (
    <div style={stack}>
      {showOffline ? (
        <InlineNotice tone="warn" icon={<Icons.WifiOff size={iconSizeValues.sm} />} data-testid="needs-network">
          <b style={noticeTitle}>{t('teamHelpers.offline.title')}</b>
          <span style={noticeText}>{t('teamHelpers.offline.text')}</span>
        </InlineNotice>
      ) : null}
      {noticeMessage !== null ? (
        <InlineNotice tone={actions.notice?.kind === 'failed' ? 'error' : 'info'} data-testid="action-notice">
          {noticeMessage}
        </InlineNotice>
      ) : null}
      {loadState === 'error' ? <InlineNotice tone="error" data-testid="load-error">{t('teamHelpers.loadError')}</InlineNotice> : null}
      {loadState === 'loading' ? <p style={{ margin: 0, color: cssVars.colors.textSecondary }} role="status">{t('teamHelpers.loading')}</p> : null}
      {loadState === 'ready' ? (
        <>
          <JoinRequestList
            requests={requests}
            disabled={locked}
            onApprove={(request) => { actions.clearNotice(); setDialog({ type: 'approve', request }); }}
            onDecline={(request) => { void actions.decline(request.id); }}
          />
          <HelperList
            members={members}
            disabled={locked}
            onRevoke={(row) => setDialog({ type: 'access', kind: 'revoke', row })}
            onWatchOnly={(row) => setDialog({ type: 'access', kind: 'watch_only', row })}
          />
        </>
      ) : null}
    </div>
  );

  return (
    <CategoryPage {...header}>
      <div style={{ containerType: 'inline-size' }}>
        <div className="th-cols" data-testid="team-helpers-page">
          {left}
          {right}
        </div>
        <style>{columnsCss}</style>
      </div>
      {dialog?.type === 'approve' ? (
        <ApproveSheet
          request={dialog.request}
          fieldCount={tournament.numberOfFields}
          initialField={lastField}
          onFieldChange={setLastField}
          onApprove={actions.approve}
          onClose={close}
          busy={actions.busy}
        />
      ) : null}
      {dialog?.type === 'renew' ? (
        <RenewCodeDialog
          openRequests={requests.length > 0 ? requests.length : (actions.code?.openRequests ?? 0)}
          busy={actions.busy}
          onClose={close}
          onRenew={(mode) => { void actions.renewCode(mode).then(close); }}
        />
      ) : null}
      {dialog?.type === 'access' ? (
        <AccessChangeDialog
          kind={dialog.kind}
          row={dialog.row}
          busy={actions.busy}
          onClose={close}
          onConfirm={() => { void actions.changeAccess(dialog.row.memberId, dialog.kind).then(close); }}
        />
      ) : null}
    </CategoryPage>
  );
}

export default TeamHelpersCategory;
