/**
 * „Gruppe wieder öffnen“ (GA4 A-13c; Mockup Zustände 22, 23; @TM-072, @TM-099): Grund Pflicht (höchstens 500 Zeichen, nur für die
 * Turnierleitung sichtbar), leer ist die Haupttaste gesperrt. Der Dialog sagt, wozu Wiederöffnen dient und dass einzelne
 * Korrekturen auch ohne Wiederöffnen gehen (@TM-071).
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { groupNameOf, withGroup } from './completionTexts';
import { GroupDialogShell } from './GroupDialogShell';
import { MAX_REOPEN_REASON, type GroupCompletionApi, type ReopenError } from './useGroupCompletion';

const area: CSSProperties = {
  display: 'block', width: '100%', minHeight: `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.sm})`, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  font: 'inherit', fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.bodyLg, color: cssVars.colors.textPrimary,
  background: cssVars.colors.background, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md, resize: 'vertical', boxSizing: 'border-box',
};
const label: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: cssVars.spacing.sm, fontWeight: cssVars.fontWeights.semibold, marginBottom: cssVars.spacing.xs };
const hint: CSSProperties = { margin: `${cssVars.spacing.xs} 0 0`, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, color: cssVars.colors.textPrimary };

export interface GroupReopenDialogProps {
  api: GroupCompletionApi;
  groupId: string;
  reason: string;
  busy: boolean;
  error: ReopenError | null;
}

export const GroupReopenDialog = ({ api, groupId, reason, busy, error }: GroupReopenDialogProps) => {
  const { t } = useTranslation('tournament');
  const name = groupNameOf(api.tournament, groupId);
  const canSave = reason.trim().length > 0 && reason.length <= MAX_REOPEN_REASON && !busy;
  const errorText = error === null ? null
    : error === 'NOT_COMPLETED' || error === 'REASON_REQUIRED' ? t(`groupCompletion.reopen.errors.${error}`) : t(`groupCompletion.errors.${error}`);
  const footer = (
    <>
      <Button variant="primary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.primary }} disabled={!canSave} onClick={api.confirmReopen} data-primary data-testid="group-reopen-confirm">
        {t('groupCompletion.reopen.confirm')}
      </Button>
      <Button variant="secondary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.primary }} disabled={busy} onClick={api.close} data-testid="group-reopen-cancel">
        {t('groupCompletion.dialog.cancel')}
      </Button>
    </>
  );
  return (
    <GroupDialogShell title={t('groupCompletion.reopen.title', withGroup(name))} onClose={api.close} footer={footer} data-testid="group-reopen-dialog">
      <p style={{ margin: 0 }}>{t('groupCompletion.reopen.body', withGroup(name))}</p>
      <div>
        <div style={label}>
          <label htmlFor="group-reopen-reason">{t('groupCompletion.reopen.reasonLabel')}</label>
          <span style={{ color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal, fontSize: cssVars.fontSizes.sm }}>{t('groupCompletion.reopen.reasonCount', { count: reason.length, max: MAX_REOPEN_REASON })}</span>
        </div>
        <textarea
          id="group-reopen-reason"
          style={area}
          value={reason}
          maxLength={MAX_REOPEN_REASON}
          required
          aria-describedby="group-reopen-reason-hint"
          onChange={(event) => { api.setReopenReason(event.target.value); }}
          data-testid="group-reopen-reason"
        />
        <p id="group-reopen-reason-hint" style={hint}>{t('groupCompletion.reopen.reasonHint')}</p>
      </div>
      {errorText !== null ? <InlineNotice tone="error" data-testid="group-reopen-error"><span>{errorText}</span></InlineNotice> : null}
    </GroupDialogShell>
  );
};
