/**
 * TimeAdjustDialog (B-08d): Spielzeit im laufenden Abschnitt korrigieren, mit Grenzen.
 *
 * Eingabe ist die Spielzeit im Abschnitt (mm:ss). Untergrenze: der späteste Eintrag des Abschnitts (ein Tor
 * oder anderer Eintrag, sonst 0:00); Obergrenze: die Länge des Abschnitts. Der Stepper kappt an den Grenzen,
 * die Hinweise nennen sie. Der Dialog meldet nur die neue Spielzeit; das Senden macht die Hülle über die
 * Engine (`adjustClock`). Szenarien: @SL-011, @SL-012, @SL-077.
 *
 * @SL-198 (C-COCKPIT-ZEIT-KORRIGIEREN-GEGENLAEUFIG): der Dialog zeigt und ändert die Zeit in der Zählweise der Uhr. Läuft sie als Restzeit
 * (`countdown`), zeigt er die Restzeit des Abschnitts, „10 Sekunden mehr“ erhöht die Restzeit, und die Grenzen stehen als Restzeit da
 * (höchstens bis zum jüngsten Eintrag, mindestens 0:00). Gemeldet wird immer die gespielte Zeit (die Engine rechnet in Spielzeit).
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
  /** Zählweise der Uhr im Cockpit (`timerDirection`): `countdown` = Restzeit, sonst gespielte Zeit (@SL-198). */
  countdown?: boolean;
}

/** Sekunden als `m:ss` (Minuten ohne führende Null). */
function formatMmSs(sekunden: number): string {
  return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
}

export function TimeAdjustDialog({
  isOpen, onClose, onConfirm, currentSeconds, minSeconds, maxSeconds, minIsGoal, countdown = false,
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
  // Anzeige in der Zählweise der Uhr: Restzeit = Länge des Abschnitts − gespielte Zeit; die Grenzen kehren sich dabei um (@SL-198)
  const zeige = (gespielt: number): number => (countdown ? maxSeconds - gespielt : gespielt);
  const anzeigeMin = countdown ? 0 : minSeconds;
  const anzeigeMax = countdown ? maxSeconds - minSeconds : maxSeconds;
  const eintragText = formatMmSs(minSeconds);
  const hinweisEintrag = countdown
    ? t(minIsGoal ? 'timeAdjust.limitMaxRestGoal' : 'timeAdjust.limitMaxRestEntry', { zeit: formatMmSs(anzeigeMax) }) // nur Restzeit, keine gemischte Zeitbasis
    : t(minIsGoal ? 'timeAdjust.limitMinGoal' : 'timeAdjust.limitMinEntry', { zeit: eintragText });
  const hinweisGrenze = countdown ? t('timeAdjust.limitMinRest', { zeit: formatMmSs(0) }) : t('timeAdjust.limitMax', { zeit: formatMmSs(maxSeconds) });

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
        <p style={styles.label}>{t(countdown ? 'timeAdjust.restInSection' : 'timeAdjust.inSection')}</p>

        <div style={styles.stepper}>
          <TimeStepper
            value={zeige(seconds)}
            min={anzeigeMin}
            max={anzeigeMax}
            step={STEP_SECONDS}
            format={formatMmSs}
            labelDecrease={t('timeAdjust.decrease')}
            labelIncrease={t('timeAdjust.increase')}
            onChange={(wert) => { setEingabe(countdown ? maxSeconds - wert : wert); }}
            testId="time-adjust-stepper"
          />
        </div>

        <div style={styles.limits}>
          {minSeconds > 0 && <p style={styles.limit} data-testid="time-adjust-grenze-eintrag">{hinweisEintrag}</p>}
          <p style={styles.limit} data-testid="time-adjust-grenze">{hinweisGrenze}</p>
        </div>

        {hasChanged && (
          <div style={styles.changeIndicator}>
            {formatMmSs(zeige(currentSeconds))} → {formatMmSs(zeige(seconds))}
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
    fontWeight: cssVars.fontWeights.semibold,
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
    fontWeight: cssVars.fontWeights.medium,
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
    fontWeight: cssVars.fontWeights.semibold,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: touchTargets.comfortable,
  },
};

export default TimeAdjustDialog;
