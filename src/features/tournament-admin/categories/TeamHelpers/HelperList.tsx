/**
 * HelperList – Helfer-Übersicht der Turnierleitung (A-18a, Mockup M4 `r1`/`r8`, @HE-052, @HE-075, @HE-077, @HE-049):
 * je Zugang „Tom – Feld 2 – steuert“ bzw. „Clara – ohne Feld – zuletzt 12:03“ und das Gerät (immer über `deviceLabelText`,
 * Review #331). Ein Gerät, ein Zugang: derselbe Name kann mehrfach vorkommen (neues Handy, Tablet). Tasten „Entziehen“ und
 * „Nur zusehen“; entzogene Zugänge bleiben als „Zugang entzogen“ stehen, nie gelöscht (R-GA5-10, @HE-104). Kein Rollenwechsel
 * für Geräte außer „Nur zusehen“ (@HE-084). Reine Darstellung.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/Button';
import { TextTag } from '../../../../components/ui/atoms/TextTag';
import { cssVars } from '../../../../design-tokens';
import { deviceLabelText } from '../../../../core/device/deviceLabel';
import { formatClock, sortedHelperRows, type HelperMemberRow, type HelperRowModel } from './helperAdminModel';

export interface HelperListProps {
  members: readonly HelperMemberRow[];
  disabled: boolean;
  onRevoke: (row: HelperRowModel) => void;
  onWatchOnly: (row: HelperRowModel) => void;
}

const sectionHead: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: `${cssVars.spacing.xs} ${cssVars.spacing.md}` };
const h2: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm };
const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm };
const hintText: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const line: CSSProperties = { margin: 0, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.title, overflowWrap: 'break-word', color: cssVars.colors.textPrimary };
const actions: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.sm };
const buttonStyle: CSSProperties = { minHeight: cssVars.touchTargets.primary, padding: `0 ${cssVars.spacing.sm}` };

function rowStyle(revoked: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: cssVars.spacing.xs,
    border: `${cssVars.borderWidth.thin} ${revoked ? 'dashed' : 'solid'} ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  };
}

export const HelperList = ({ members, disabled, onRevoke, onWatchOnly }: HelperListProps) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language === 'en' ? 'en-GB' : 'de-DE';
  const rows = sortedHelperRows(members);
  const active = rows.filter((r) => !r.revoked).length;

  const describe = (row: HelperRowModel): string => {
    const field = row.field === null ? t('teamHelpers.helpers.noField') : t('teamHelpers.helpers.field', { field: row.field });
    let status = '';
    if (!row.revoked) {
      if (row.status.kind === 'controls') {
        status = t('teamHelpers.helpers.controls');
      } else if (row.status.kind === 'seen') {
        status = t('teamHelpers.helpers.lastSeen', { time: formatClock(row.status.at, locale) });
      } else {
        status = t('teamHelpers.helpers.unseen');
      }
    }
    return [row.name, field, status].filter((part) => part !== '').join(' – ');
  };

  return (
    <section style={stack} data-testid="helper-list">
      <div style={sectionHead}>
        <h2 style={h2}>{t('teamHelpers.helpers.title')}</h2>
        <span style={meta} data-testid="helper-list-count">
          {active === 0 ? t('teamHelpers.helpers.none') : t('teamHelpers.helpers.count', { count: active })}
        </span>
      </div>
      {rows.length === 0 ? <p style={hintText}>{t('teamHelpers.helpers.empty')}</p> : null}
      {rows.length > 0 ? (
        <ul style={list}>
          {rows.map((row) => {
            const device = deviceLabelText(row.deviceLabel);
            return (
              <li key={row.memberId} style={rowStyle(row.revoked)} data-testid="helper-row" data-member-id={row.memberId} data-state={row.revoked ? 'revoked' : row.viewerOnly ? 'viewer' : 'helper'}>
                <p style={line} data-teamname>{describe(row)}</p>
                <p style={meta}>{device === null ? t('teamHelpers.helpers.deviceUnknown') : t('teamHelpers.helpers.device', { device })}</p>
                {row.revoked ? <TextTag testId="helper-revoked-tag">{t('teamHelpers.helpers.revokedTag')}</TextTag> : null}
                {!row.revoked && row.viewerOnly ? <TextTag testId="helper-viewer-tag">{t('teamHelpers.helpers.viewerTag')}</TextTag> : null}
                {!row.revoked ? (
                  <div style={actions}>
                    <Button variant="secondary" size="lg" style={buttonStyle} disabled={disabled} onClick={() => onRevoke(row)} data-testid="helper-revoke">
                      {t('teamHelpers.helpers.revoke')}
                    </Button>
                    {!row.viewerOnly ? (
                      <Button variant="secondary" size="lg" style={buttonStyle} disabled={disabled} onClick={() => onWatchOnly(row)} data-testid="helper-viewer">
                        {t('teamHelpers.helpers.watchOnly')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p style={hintText}>{t('teamHelpers.helpers.hint')}</p>
    </section>
  );
};
