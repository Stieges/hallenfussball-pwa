/**
 * B-26: Vorschau vor dem Bestätigen (ab dem ersten Anpfiff, @ZP-017) und Vorschau „Ursprüngliche Zeiten“ (@ZP-036, @ZP-037).
 * Oben die Zusammenfassung, darunter jedes Spiel mit alter und neuer Uhrzeit; der Hinweis „Noch nichts geändert“ steht
 * immer da: ohne die Haupttaste ändert sich nichts (@ZP-018). Warnungen sperren nie (@ZP-096).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { Dialog } from '../../../components/dialogs/Dialog';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { Icons } from '../../../components/ui/Icons';
import type { ShiftPlan } from '../../../core/services/scheduleShift';
import { clockText, keptText, matchList, warningText } from './timeShiftText';

interface TimeShiftPreviewProps {
  isOpen: boolean;
  kind: 'shift' | 'restore';
  plan: ShiftPlan | undefined;
  /** Spielnamen „Heim – Gast“ je Spiel-ID */
  pairingOf: (matchId: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

const head: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const sub: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const body: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.xl };
const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' };
const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: cssVars.spacing.sm,
  alignItems: 'center',
  padding: `${cssVars.spacing.sm} 0`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  fontSize: cssVars.fontSizes.sm,
  color: cssVars.colors.textPrimary,
};
const number: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, whiteSpace: 'nowrap' };
const pairing: CSSProperties = { minWidth: 0, overflowWrap: 'anywhere', color: cssVars.colors.textSecondary };
const change: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const old: CSSProperties = { color: cssVars.colors.textSecondary, textDecoration: 'line-through' };
const fix: CSSProperties = { margin: 0, display: 'flex', gap: cssVars.spacing.sm, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };

export function TimeShiftPreview({ isOpen, kind, plan, pairingOf, onConfirm, onCancel }: TimeShiftPreviewProps) {
  const { t } = useTranslation('tournament');
  if (plan === undefined) {
    return null;
  }
  const count = plan.changes.length;
  const action = kind === 'restore' ? t('timeShift.restoreConfirm') : t('timeShift.confirm', { count });
  const past = plan.kept.filter((k) => k.reason === 'past');
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={kind === 'restore' ? t('timeShift.restoreTitle') : t('timeShift.previewTitle')}
      maxWidth={dialogWidths.md}
      footer={(
        <DialogActions
          secondary={[{ label: t('timeShift.cancel'), onClick: onCancel, 'data-testid': 'time-shift-preview-cancel' }]}
          primary={{ label: action, onClick: onConfirm, disabled: kind === 'shift' && count === 0, 'data-testid': 'time-shift-confirm' }}
        />
      )}
    >
      <div style={body} data-testid={kind === 'restore' ? 'time-shift-restore-preview' : 'time-shift-preview'}>
        <div>
          <p style={head}>{t('timeShift.summaryCount', { count })}</p>
          <p style={sub}>{t('timeShift.previewEnd', { end: clockText(plan.newEnd) ?? '–', oldEnd: clockText(plan.oldEnd) ?? '–' })}</p>
        </div>
        <InlineNotice tone="info">
          <span><b>{t('timeShift.previewUnchanged', { action })}</b></span>
        </InlineNotice>
        {plan.warnings.map((w, i) => (
          <InlineNotice key={i} tone="warn" data-testid="time-shift-warning">
            <span><b>{warningText(t, w)}</b> {t('timeShift.warnCanConfirm')}</span>
          </InlineNotice>
        ))}
        <ul style={list} data-testid="time-shift-preview-list">
          {plan.changes.map((c) => (
            <li key={c.matchId} style={row} aria-label={t('timeShift.previewRow', { number: c.matchNumber ?? '?', from: clockText(c.from), to: clockText(c.to) })}>
              <span style={number}>{t('timeShift.matchName', { number: c.matchNumber ?? '?' })}</span>
              <span style={pairing}>{pairingOf(c.matchId)}</span>
              <span style={change}>
                <span style={old}>{clockText(c.from)}</span>
                <Icons.ChevronRight size={iconSizeValues.xs} />
                <b>{clockText(c.to)}</b>
              </span>
            </li>
          ))}
        </ul>
        <p style={fix}>
          <span aria-hidden="true"><Icons.Info size={iconSizeValues.sm} /></span>
          <span>
            {kind === 'restore' ? t('timeShift.restoreFix') : plan.kept.length > 0 ? `${t('timeShift.keptLabel')} ${keptText(t, plan.kept)}. ${t('timeShift.keptRule')}` : t('timeShift.keptRule')}
            {past.length > 0 ? ` ${t('timeShift.restorePast', { matches: matchList(t, past.map((k) => k.matchNumber)) })}` : ''}
          </span>
        </p>
      </div>
    </Dialog>
  );
}
