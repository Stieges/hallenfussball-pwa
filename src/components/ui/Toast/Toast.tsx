/**
 * Toast Component
 *
 * Individual toast notification with icon, message, and dismiss button.
 * Supports success, error, warning, and info variants.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Was die Aktion nach dem Tipp meldet (@OB-087): nichts = Hinweis schließt wie bisher; `busyLabel` = Hinweis bleibt stehen,
 * die Taste ist gesperrt und zeigt die Arbeitsanzeige; `note` = Hinweis bleibt stehen und nennt in einem Satz, warum jetzt
 * nichts geschieht (die Taste bleibt bedienbar). `busyLabel` kann mit `danach` ein späteres Ergebnis ankündigen (ein Versprechen, das nie
 * ablehnt): sobald es erfüllt ist, gilt dessen Ergebnis wie ein neuer Tipp-Ausgang – so gibt der Aufrufer die Taste nach einer Frist wieder frei
 * (`note`) oder schließt den Hinweis (nichts), ohne dass der Hinweis etwas über die Frist wissen muss. Zu spät (Hinweis schon weg) wird es verworfen.
 */
export type ToastActionResult = { busyLabel: string; danach?: Promise<ToastActionResult> } | { note: string } | undefined;

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onDismiss: (id: string) => void;
  duration?: number;
  /** Der Hinweis beginnt auszublenden (die Ausblendzeit läuft): der Besitzer merkt sich das, um denselben festen Hinweis neu zu öffnen. */
  onExit?: (id: string) => void;
  /** Wie oft ein Hinweis mit derselben festen Kennung während des Ausblendens neu geöffnet wurde (Schlüssel für einen frischen Hinweis). */
  erneuert?: number;
  action?: {
    label: string;
    onClick: () => ToastActionResult;
  };
}

/** Gezeichnete Symbole statt Textzeichen (@OB-038); sie erben die Textfarbe der Meldung. */
const icons: Record<ToastType, ReactNode> = {
  success: <Icons.Check size={iconSizeValues.sm} />,
  error: <Icons.X size={iconSizeValues.sm} />,
  warning: <Icons.AlertTriangle size={iconSizeValues.sm} />,
  info: <Icons.Info size={iconSizeValues.sm} />,
};

const AUSBLENDEN_MS = 300;

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  onDismiss,
  onExit,
  duration = 4000,
  action,
}) => {
  const { t } = useTranslation('common');
  const [isExiting, setIsExiting] = useState(false);
  const entfernen = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lebt = useRef(true);

  useEffect(() => {
    lebt.current = true;
    return () => { lebt.current = false; clearTimeout(entfernen.current); };
  }, []);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    onExit?.(id);
    clearTimeout(entfernen.current);
    entfernen.current = setTimeout(() => onDismiss(id), AUSBLENDEN_MS);
  }, [id, onDismiss, onExit]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  // Fokus der Taste: eine gesperrte Taste verliert ihn; wird sie nach der Frist wieder frei, bekommt sie ihn zurück (nur wenn sie ihn vor dem Sperren hatte
  // und er inzwischen nirgends sonst liegt)
  const aktionsTaste = useRef<HTMLButtonElement>(null);
  const hatteFokus = useRef(false);
  useEffect(() => {
    if (busyLabel !== null || !hatteFokus.current) { return; }
    hatteFokus.current = false;
    const aktiv = document.activeElement;
    if (aktiv === null || aktiv === document.body) { aktionsTaste.current?.focus(); }
  }, [busyLabel]);
  const [note, setNote] = useState<string | null>(null);

  const anwenden = (result: ToastActionResult): void => {
    if (result && 'busyLabel' in result) {
      setNote(null);
      setBusyLabel(result.busyLabel);
      void result.danach?.then((spaeter) => { if (lebt.current) { anwenden(spaeter); } });
      return;
    }
    if (result && 'note' in result) {
      setBusyLabel(null);
      setNote(result.note);
      return;
    }
    handleDismiss();
  };

  const handleAction = () => {
    if (busyLabel !== null) { return; }
    hatteFokus.current = document.activeElement === aktionsTaste.current;
    anwenden(action?.onClick());
  };

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${action ? styles.mitAktion : ''} ${isExiting ? styles.exiting : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true" data-testid="toast-icon">
        {icons[type]}
      </span>
      <span className={styles.message}>{message}</span>
      {action && (
        <button
          ref={aktionsTaste}
          className={styles.actionButton}
          onClick={handleAction}
          disabled={busyLabel !== null}
          aria-busy={busyLabel !== null}
          data-testid="toast-action"
          type="button"
        >
          {busyLabel ?? action.label}
        </button>
      )}
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        aria-label={t('toast.dismissAriaLabel')}
        type="button"
      >
        <Icons.X size={iconSizeValues.xs} />
      </button>
      {note !== null && <span className={styles.note} data-testid="toast-action-note">{note}</span>}
    </div>
  );
};
