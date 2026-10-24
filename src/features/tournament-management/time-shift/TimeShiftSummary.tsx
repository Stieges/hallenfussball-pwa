/**
 * B-26: was das Verschieben bewirkt, schon im Dialog (Mockup Bild 2/4/6): Anzahl, Bereich und neues Ende, was nicht verschoben
 * wird (@ZP-016, @ZP-062), die Sperre „Vergangenheit“ (@ZP-057) und vor dem ersten Anpfiff die Warnungen samt Hinweis zu
 * „ursprünglich“ (@ZP-089, @ZP-091). Nach dem ersten Anpfiff stehen die Warnungen in der Vorschau.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { ShiftPlan } from '../../../core/services/scheduleShift';
import { originalStartToShow } from '../../../core/services/scheduleShift';
import { clockText, keptText, matchList, rangeOf, warningText } from './timeShiftText';
import type { ShiftDirection } from './useTimeShift';

interface TimeShiftSummaryProps {
  plan: ShiftPlan | undefined;
  kickedOff: boolean;
  direction: ShiftDirection;
  minutes: number;
}

const box: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.sm,
  padding: cssVars.spacing.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.surface,
};
const line: CSSProperties = { display: 'grid', gridTemplateColumns: `${cssVars.iconSizes.sm} minmax(0, 1fr)`, gap: cssVars.spacing.sm, alignItems: 'start', fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textPrimary, margin: 0 };
const icon: CSSProperties = { display: 'flex', color: cssVars.colors.textSecondary };
const big: CSSProperties = { fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold };

export function TimeShiftSummary({ plan, kickedOff, direction, minutes }: TimeShiftSummaryProps) {
  const { t } = useTranslation('tournament');
  if (plan === undefined) {
    return null;
  }
  const end = clockText(plan.newEnd) ?? '–';
  const count = plan.changes.length;
  const { first, last } = rangeOf(plan);

  if (plan.error !== undefined) {
    const err = plan.error;
    return (
      <>
        <InlineNotice tone="error" data-testid="time-shift-error">
          <span>{t('timeShift.errorPast', { matches: matchList(t, err.matches.map((m) => m.matchNumber)), to: clockText(err.matches[0]?.to), now: clockText(err.now) })}</span>
        </InlineNotice>
        <div style={box}>
          <p style={line}><span style={icon} aria-hidden="true"><Icons.Clock size={iconSizeValues.sm} /></span>
            <span>{err.maxMinutes > 0 ? t('timeShift.errorPastNothing', { max: err.maxMinutes }) : t('timeShift.errorPastNone')}</span></p>
        </div>
      </>
    );
  }

  const firstChange = plan.changes[0];
  const early = !kickedOff && firstChange !== undefined;
  const nearWarning = plan.warnings.find((w) => w.kind === 'shortNotice');
  const otherWarnings = kickedOff ? [] : plan.warnings.filter((w) => w.kind !== 'shortNotice');
  const withOriginal = plan.matches
    .filter((m) => plan.changes.some((c) => c.matchId === m.id) && originalStartToShow(m) !== undefined)
    .map((m) => m.matchNumber);

  return (
    <>
      {!kickedOff && nearWarning !== undefined && (
        <InlineNotice tone="warn" data-testid="time-shift-warning">{warningText(t, nearWarning)}</InlineNotice>
      )}
      {otherWarnings.map((w, i) => (
        <InlineNotice key={i} tone="warn" data-testid="time-shift-warning">
          <span>{warningText(t, w)} {t('timeShift.warnCanConfirm')}</span>
        </InlineNotice>
      ))}
      <div style={box} data-testid="time-shift-summary">
        <p style={line}>
          <span style={icon} aria-hidden="true"><Icons.Clock size={iconSizeValues.sm} /></span>
          {count === 0 ? <span>{t('timeShift.summaryNone')}</span> : early ? (
            <span><b style={big}>{t('timeShift.earlyHead', { number: firstChange.matchNumber ?? '?', to: clockText(firstChange.to), from: clockText(firstChange.from) })}</b>
              {' · '}{t(direction === 'later' ? 'timeShift.earlyRestLater' : 'timeShift.earlyRestEarlier', { count, minutes, end })}</span>
          ) : (
            <span><b style={big}>{t('timeShift.summaryCount', { count })}</b><br />
              {count === 1 || first === last ? t('timeShift.summarySingle', { first: first ?? '?', end }) : t('timeShift.summaryRange', { first: first ?? '?', last: last ?? '?', end })}</span>
          )}
        </p>
        {kickedOff && count > 0 && (
          <p style={line} data-testid="time-shift-kept">
            <span style={icon} aria-hidden="true"><Icons.Info size={iconSizeValues.sm} /></span>
            <span>{plan.kept.length > 0
              ? <><b>{t('timeShift.keptLabel')}</b> {keptText(t, plan.kept)}. {t('timeShift.keptRule')}</>
              : t('timeShift.keptBefore')}</span>
          </p>
        )}
      </div>
      {!kickedOff && count > 0 && (
        <InlineNotice tone="info" data-testid="time-shift-info">
          {withOriginal.length > 0 ? t('timeShift.infoOriginal', { matches: matchList(t, withOriginal) }) : t('timeShift.infoPlanning')}
        </InlineNotice>
      )}
    </>
  );
}
