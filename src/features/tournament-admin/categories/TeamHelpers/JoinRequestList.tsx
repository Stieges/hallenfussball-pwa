/**
 * JoinRequestList – offene Beitrittsanfragen (A-18a, Mockup M4 `r1`/`r2n`/`r3`): Name, Uhrzeit, Hinweise zu bekannten Namen
 * (S-2, @HE-106) und gleichwertig „Zulassen“ / „Ablehnen“. Die Prüfzahl steht hier bewusst NICHT (S-1, @HE-021): Olli wählt
 * sie erst im Zulassen-Blatt unter vier Zahlen, der Server erzwingt sie. Bei gleichen Namen steht oberhalb der Liste
 * „2 Anfragen mit dem Namen Tom“. Reine Darstellung; ohne Netz sind beide Tasten gesperrt (@HE-047).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/Button';
import { Icons } from '../../../../components/ui/Icons';
import { InlineNotice } from '../../../../components/ui/molecules/InlineNotice';
import { cssVars, iconSizeValues } from '../../../../design-tokens';
import { deviceLabelText } from '../../../../core/device/deviceLabel';
import { noticeText, noticeTitle } from './noticeStyles';
import { duplicateNames, formatClock, requestMarks, type JoinRequestRow } from './helperAdminModel';

export interface JoinRequestListProps {
  requests: readonly JoinRequestRow[];
  disabled: boolean;
  onApprove: (request: JoinRequestRow) => void;
  onDecline: (request: JoinRequestRow) => void;
}

const sectionHead: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: `${cssVars.spacing.xs} ${cssVars.spacing.md}` };
const h2: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm };
const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm };
const hintText: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const name: CSSProperties = { margin: 0, fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word', color: cssVars.colors.textPrimary };
const actions: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.sm };
const buttonStyle: CSSProperties = { minHeight: cssVars.touchTargets.primary, padding: `0 ${cssVars.spacing.sm}` };
const mark: CSSProperties = { display: 'inline-flex', alignItems: 'flex-start', gap: cssVars.spacing.xs, alignSelf: 'flex-start', padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningSolid}`, borderRadius: cssVars.borderRadius.md, backgroundColor: cssVars.colors.background, backgroundImage: `linear-gradient(${cssVars.colors.warningLight}, ${cssVars.colors.warningLight})`, color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold };

function rowStyle(hasMark: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: cssVars.spacing.xs,
    border: `${cssVars.borderWidth.thin} solid ${hasMark ? cssVars.colors.warningSolid : cssVars.colors.border}`,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  };
}

export const JoinRequestList = ({ requests, disabled, onApprove, onDecline }: JoinRequestListProps) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language === 'en' ? 'en-GB' : 'de-DE';
  const dupes = duplicateNames(requests);
  return (
    <section style={stack} data-testid="join-requests">
      <div style={sectionHead}>
        <h2 style={h2}>{t('teamHelpers.requests.title')}</h2>
        <span style={meta} data-testid="join-requests-count">
          {requests.length === 0 ? t('teamHelpers.requests.none') : t('teamHelpers.requests.count', { count: requests.length })}
        </span>
      </div>
      {requests.length === 0 ? <p style={hintText}>{t('teamHelpers.requests.empty')}</p> : null}
      {dupes.map((d) => (
        <InlineNotice key={d.name.toLowerCase()} tone="warn" data-testid="dup-name-hint">
          <b style={noticeTitle}>{t('teamHelpers.requests.sameNameTitle', { count: d.count, name: d.name })}</b>
          <span style={noticeText}>{t('teamHelpers.requests.sameNameText')}</span>
        </InlineNotice>
      ))}
      {requests.length > 0 ? (
        <ul style={list}>
          {requests.map((request) => {
            const marks = requestMarks(request);
            const isDup = request.sameNamePending > 1;
            return (
              <li key={request.id} style={rowStyle(isDup || marks.length > 0)} data-testid="join-request" data-request-id={request.id}>
                <p style={name} data-teamname>{request.name}</p>
                <p style={meta}>{t('teamHelpers.requests.requestedAt', { time: formatClock(request.createdAt, locale) })}</p>
                {marks.map((m) => (
                  <span key={m.kind} style={mark} data-testid="same-name-mark" data-kind={m.kind}>
                    <span style={{ color: cssVars.colors.warningSolid, display: 'flex' }} aria-hidden="true"><Icons.AlertTriangle size={iconSizeValues.xs} /></span>
                    <span>
                      {m.kind === 'member'
                        ? (deviceLabelText(m.deviceLabel) === null
                          ? t('teamHelpers.requests.markMemberNoDevice', { name: m.name })
                          : t('teamHelpers.requests.markMember', { name: m.name, device: deviceLabelText(m.deviceLabel) }))
                        : t('teamHelpers.requests.markDeclined', { name: m.name, time: formatClock(m.at, locale) })}
                    </span>
                  </span>
                ))}
                <div style={actions}>
                  <Button variant="secondary" size="lg" style={buttonStyle} disabled={disabled} onClick={() => onApprove(request)} data-testid="request-approve">
                    {t('teamHelpers.requests.approve')}
                  </Button>
                  <Button variant="secondary" size="lg" style={buttonStyle} disabled={disabled} onClick={() => onDecline(request)} data-testid="request-decline">
                    {t('teamHelpers.requests.decline')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};
