/**
 * B-26 Streifen nach dem Verschieben (Mockup Bild 5, E6/E7): „Zeiten um 10 Min. verschoben · Ende 13:08“, „Ausdrucke sind
 * veraltet“, gleichrangig „Neu drucken“ und „Rückgängig …“ (nur ab dem ersten Anpfiff, solange etwas wiederherzustellen ist),
 * × schließt. Ruhig getönt, kein Orange; der Streifen erscheint einmal je Verschiebung (@ZP-089 „einmal“).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { clockText } from './timeShiftText';
import type { ShiftStrip } from './useTimeShift';

interface TimeShiftStripProps {
  strip: ShiftStrip;
  canUndo: boolean;
  onReprint: () => void;
  onUndo: () => void;
  onClose: () => void;
}

const wrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: cssVars.spacing.sm,
  alignItems: 'start',
  padding: cssVars.spacing.md,
  marginBottom: cssVars.spacing.md,
  background: cssVars.colors.infoLight,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.infoBorder}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
};
const text: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, minWidth: 0, fontSize: cssVars.fontSizes.sm };
const title: CSSProperties = { fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold };
const actions: CSSProperties = { gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const action: CSSProperties = { flex: '1 1 auto', whiteSpace: 'nowrap', minHeight: cssVars.touchTargets.minimum };
const close: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
};

export function TimeShiftStrip({ strip, canUndo, onReprint, onUndo, onClose }: TimeShiftStripProps) {
  const { t } = useTranslation('tournament');
  const end = clockText(strip.end) ?? '–';
  return (
    <div style={wrap} role="status" data-testid="time-shift-strip">
      <div style={text}>
        <b style={title}>{t(strip.direction === 'later' ? 'timeShift.stripLater' : 'timeShift.stripEarlier', { minutes: strip.minutes, end })}</b>
        <span>{t('timeShift.stripPrints')}</span>
      </div>
      <button type="button" style={close} aria-label={t('timeShift.stripClose')} onClick={onClose} data-testid="time-shift-strip-close">
        <Icons.X size={iconSizeValues.sm} />
      </button>
      <div style={actions}>
        <Button variant="secondary" size="md" style={action} icon={<Icons.Printer size={iconSizeValues.sm} />} onClick={onReprint} data-testid="time-shift-reprint">
          {t('timeShift.stripReprint')}
        </Button>
        {canUndo && (
          <Button variant="secondary" size="md" style={action} icon={<Icons.Restore size={iconSizeValues.sm} />} onClick={onUndo} data-testid="zeiten-rueckgaengig">
            {t('timeShift.stripUndo')}
          </Button>
        )}
      </div>
    </div>
  );
}
