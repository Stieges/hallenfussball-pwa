/**
 * TimeAdjustDialog (B-08d): Spielzeit im laufenden Abschnitt korrigieren, mit Grenzen.
 *
 * Eingabe ist die Spielzeit im Abschnitt (mm:ss). Untergrenze: der späteste Eintrag des Abschnitts (ein Tor
 * oder anderer Eintrag, sonst 0:00); Obergrenze: die Länge des Abschnitts. Der Stepper kappt an den Grenzen,
 * die Hinweise nennen sie. Der Dialog meldet nur die neue Spielzeit; das Senden macht die Hülle über die
 * Engine (`adjustClock`). Szenarien: @SL-011, @SL-012, @SL-077.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths, touchTargets } from '../../../../design-tokens';
import { DialogSurface } from '../../../ui/molecules/DialogSurface';
import { TimeStepper } from '../../../ui/molecules/TimeStepper';
import moduleStyles from '../../LiveCockpit.module.css';

/** Schritt je Knopfdruck: zehn Sekunden. */
const STEP_SECONDS = 10;

export interface TimeAdjustDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Neue Spielzeit im Abschnitt in ganzen Sekunden; liegt immer innerhalb der Grenzen. */
  onConfirm: (sectionSeconds: number) => void;
  /** Aktuelle Spielzeit im Abschnitt in ganzen Sekunden. */
  currentSeconds: number;
  /** Untergrenze in Sekunden: spätester Eintrag des Abschnitts. */
  minSeconds: number;
  /** Obergrenze in Sekunden: Länge des Abschnitts. */
  maxSeconds: number;
  /** Die Untergrenze stammt von einem Tor (für den Hinweistext). */
  minIsGoal: boolean;
}

/** Sekunden als `m:ss` (Minuten ohne führende Null). */
function formatMmSs(sekunden: number): string {
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}

export function TimeAdjustDialog({
  isOpen, onClose, onConfirm, currentSeconds, minSeconds, maxSeconds, minIsGoal,
}: TimeAdjustDialogProps) {
  const { t } = useTranslation('cockpit');
  // Eingabe; `null` = noch nicht geändert, dann gilt die laufende Spielzeit (die Uhr tickt weiter).
  const [eingabe, setEingabe] = useState<number | null>(null);
  const seconds = eingabe ?? currentSeconds;

  // Beim Schließen (auch von außen) wird die Eingabe verworfen, beim nächsten Öffnen beginnt sie bei der Uhr.
  useEffect(() => {
    if (!isOpen) { setEingabe(null); }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const hasChanged = seconds !== currentSeconds;
  const minText = formatMmSs(minSeconds);
  const hinweisMin = minIsGoal
    ? t('timeAdjust.limitMinGoal', { zeit: minText })
    : t('timeAdjust.limitMinEntry', { zeit: minText });

  const schliesse = (): void => { setEingabe(null); onClose(); };

  return (
    <DialogSurface
      isOpen={isOpen}
      onClose={schliesse}
      maxWidth={dialogWidths.sm}
      labelledBy="time-adjust-dialog-title"
      panelClassName={moduleStyles.dialogOverlay}
    >
      <div style={styles.dialog}>
        <h2 id="time-adjust-dialog-title" style={styles.title}>{t('timeAdjust.title')}</h2>
        <p style={styles.label}>{t('timeAdjust.inSection')}</p>

        <div style={styles.stepper}>
          <TimeStepper
            value={seconds}
            min={minSeconds}
            max={maxSeconds}
            step={STEP_SECONDS}
            format={formatMmSs}
            labelDecrease={t('timeAdjust.decrease')}
            labelIncrease={t('timeAdjust.increase')}
            onChange={setEingabe}
            testId="time-adjust-stepper"
          />
        </div>

        <div style={styles.limits}>
          {minSeconds > 0 && <p style={styles.limit}>{hinweisMin}</p>}
          <p style={styles.limit}>{t('timeAdjust.limitMax', { zeit: formatMmSs(maxSeconds) })}</p>
        </div>

        {hasChanged && (
          <div style={styles.changeIndicator}>
            {formatMmSs(currentSeconds)} → {formatMmSs(seconds)}
          </div>
        )}

        <div style={styles.buttonContainer}>
          <button type="button" style={styles.cancelButton} onClick={schliesse} data-testid="time-adjust-cancel">
            {t('timeAdjust.cancel')}
          </button>
          <button
            type="button"
            style={hasChanged ? styles.confirmButton : { ...styles.confirmButton, opacity: 0.5 }}
            disabled={!hasChanged}
            onClick={() => { onConfirm(seconds); schliesse(); }}
            data-testid="time-adjust-apply"
          >
            {t('timeAdjust.apply')}
          </button>
        </div>
      </div>
    </DialogSurface>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dialog: {
    padding: cssVars.spacing.xl,
    textAlign: 'center',
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.md,
  },
  label: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
  },
  stepper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: cssVars.spacing.md,
  },
  limits: {
    marginBottom: cssVars.spacing.lg,
  },
  limit: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
  },
  changeIndicator: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
    backgroundColor: `${cssVars.colors.primary}20`,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.lg,
    display: 'inline-block',
  },
  buttonContainer: {
    display: 'flex',
    gap: cssVars.spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    border: `1px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: touchTargets.comfortable,
  },
  confirmButton: {
    flex: 1,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: touchTargets.comfortable,
  },
};

export default TimeAdjustDialog;
