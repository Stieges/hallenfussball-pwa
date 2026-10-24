/**
 * B-26: Eingaben „Zeiten verschieben“ (Mockup Bild 2): Richtung, ab Uhrzeit oder ab Spiel, Minuten mit −/+ und Schnellwahl.
 * Es gibt kein Feld-Auswahl: verschoben wird immer auf allen Feldern (@ZP-014 entfällt, Mockup E4).
 * „Ab Spiel“ bietet nur geplante Spiele an; laufende und beendete stehen nie zur Wahl (@ZP-016).
 */
import { useId, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import { SegmentedChoice } from '../../../components/ui/molecules/SegmentedChoice';
import type { Match } from '../../../types/tournament';
import type { ShiftForm } from './useTimeShift';
import { clockText } from './timeShiftText';

export interface MatchChoice {
  match: Match;
  home: string;
  away: string;
}

interface TimeShiftFormProps {
  form: ShiftForm;
  onChange: (form: ShiftForm) => void;
  choices: readonly MatchChoice[];
  fieldCount: number;
}

const QUICK = [5, 10, 15, 30] as const;
const MAX_MINUTES = 240;

const group: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0 };
const label: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary };
const hint: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const control: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum,
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  fontSize: cssVars.fontSizes.md, // ≥ 16 px (kein Zoom am Handy)
  fontFamily: cssVars.fontFamilies.body,
  color: cssVars.colors.textPrimary,
  background: cssVars.colors.inputBg,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
};
const stepRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm, flexWrap: 'wrap' };
const squareButton: CSSProperties = {
  ...control,
  width: cssVars.touchTargets.primary,
  minWidth: cssVars.touchTargets.primary,
  minHeight: cssVars.touchTargets.primary,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  background: cssVars.colors.surface,
};
const minutesInput: CSSProperties = { ...control, width: '6em', minHeight: cssVars.touchTargets.primary, textAlign: 'center', fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums' };
const quickRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: cssVars.spacing.sm };

function quickStyle(selected: boolean): CSSProperties {
  return {
    ...control,
    minHeight: cssVars.touchTargets.primary,
    cursor: 'pointer',
    fontWeight: selected ? cssVars.fontWeights.bold : cssVars.fontWeights.medium,
    background: selected ? cssVars.colors.primaryLight : cssVars.colors.surface,
    border: `${selected ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${selected ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
  };
}

const clamp = (n: number) => Math.max(1, Math.min(MAX_MINUTES, Math.round(n)));

export function TimeShiftForm({ form, onChange, choices, fieldCount }: TimeShiftFormProps) {
  const { t } = useTranslation('tournament');
  const fromId = useId();
  const minutesId = useId();
  const set = (patch: Partial<ShiftForm>) => onChange({ ...form, ...patch });
  const preset = form.presetMatchId !== undefined && form.mode === 'match' && form.matchId === form.presetMatchId
    ? choices.find((c) => c.match.id === form.presetMatchId)?.match.matchNumber
    : undefined;
  const fieldHint = fieldCount > 1 ? t('timeShift.fromHintAll') : t('timeShift.fromHintOne', { field: 1 });

  return (
    <>
      <SegmentedChoice
        legend={t('timeShift.direction')}
        options={[{ value: 'later', label: t('timeShift.later') }, { value: 'earlier', label: t('timeShift.earlier') }]}
        value={form.direction}
        onChange={(direction) => set({ direction })}
        testId="time-shift-direction"
      />
      <div style={group}>
        <SegmentedChoice
          legend={t('timeShift.from')}
          options={[{ value: 'time', label: t('timeShift.fromTime') }, { value: 'match', label: t('timeShift.fromMatch') }]}
          value={form.mode}
          onChange={(mode) => set({ mode })}
          testId="time-shift-mode"
        />
        {form.mode === 'time' ? (
          <input
            id={fromId}
            type="time"
            aria-label={t('timeShift.fromTimeLabel')}
            value={form.time}
            onChange={(e) => set({ time: e.target.value })}
            style={control}
            data-testid="time-shift-from-time"
          />
        ) : (
          <select
            id={fromId}
            aria-label={t('timeShift.fromMatchLabel')}
            value={form.matchId ?? ''}
            onChange={(e) => set({ matchId: e.target.value })}
            style={control}
            data-testid="time-shift-from-match"
          >
            {choices.map((c) => (
              <option key={c.match.id} value={c.match.id}>
                {t('timeShift.matchOption', { number: c.match.matchNumber ?? '?', time: clockText(c.match.scheduledTime) ?? '–', home: c.home, away: c.away })}
              </option>
            ))}
          </select>
        )}
        <p style={hint}>{preset !== undefined ? `${t('timeShift.fromHintPreset', { number: preset })} ${fieldHint}` : fieldHint}</p>
      </div>
      <div style={group}>
        <label htmlFor={minutesId} style={label}>{t('timeShift.by')}</label>
        <div style={stepRow}>
          <button type="button" style={squareButton} aria-label={t('timeShift.lessMinute')} onClick={() => set({ minutes: clamp(form.minutes - 1) })} data-testid="time-shift-minus">
            <Icons.Minus size={iconSizeValues.md} />
          </button>
          <input
            id={minutesId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MINUTES}
            value={form.minutes}
            onChange={(e) => set({ minutes: clamp(Number(e.target.value) || 1) })}
            style={minutesInput}
            data-testid="time-shift-minutes"
          />
          <button type="button" style={squareButton} aria-label={t('timeShift.moreMinute')} onClick={() => set({ minutes: clamp(form.minutes + 1) })} data-testid="time-shift-plus">
            <Icons.Plus size={iconSizeValues.md} />
          </button>
          <span style={hint}>{t('timeShift.minutesUnit')}</span>
        </div>
        <div style={quickRow} role="group" aria-label={t('timeShift.minutesField')}>
          {QUICK.map((m) => (
            <button
              key={m}
              type="button"
              style={quickStyle(form.minutes === m)}
              aria-pressed={form.minutes === m}
              aria-label={t('timeShift.quickMinutes', { minutes: m })}
              onClick={() => set({ minutes: m })}
              data-testid={`time-shift-quick-${m}`}
            >
              {form.minutes === m ? <Icons.Check size={iconSizeValues.sm} /> : null}{m}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
