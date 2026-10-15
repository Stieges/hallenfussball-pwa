/**
 * DialogSurface – gemeinsamer Grundbaustein aller Dialoge und Blätter (B-43a).
 *
 * Liefert: Abdunkelung, deckende Fläche (surfaceElevated, nie Verlauf oder
 * Transparenz), Lesebreite, Fokusfalle, Esc/Zurück (abschaltbar für die
 * Einwilligung), Scroll-Sperre, Portal in document.body und die Form am Handy
 * (Blatt von unten bei placement="sheet"; zentriert, oben ausgerichtet unter
 * tabletDown bei placement="center").
 *
 * Bewusste Entscheidung (Review B-43a, F8): zentrierte Dialoge bleiben am Handy
 * zentriert bzw. oben ausgerichtet und werden NICHT zum Blatt; nur placement="sheet"
 * ist ein Blatt von unten. Änderung, falls gewünscht, in B-43b (Daniel entscheidet).
 *
 * Verbindliche Vorgaben: @OB-055 (deckende Fläche, Kontrast), @OB-056 (Einwilligung
 * – Schließen-Verhalten über `dismissible`).
 */
import { CSSProperties, ReactNode, RefObject, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { cssVars, dialogWidths, mediaQueries } from '../../../design-tokens';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// B-43b2: Scroll-Sperre per Referenzzählung (wie inert in useFocusTrap). Verschachtelte
// Dialoge sperren den Hintergrund gemeinsam; erst der letzte gibt ihn frei und stellt den
// Wert wieder her, den er vor dem ersten Dialog hatte.
let scrollLockCount = 0;
let overflowBeforeLock = '';

function acquireScrollLock(): void {
  if (scrollLockCount === 0) {
    overflowBeforeLock = document.body.style.overflow;
  }
  scrollLockCount += 1;
  document.body.style.overflow = 'hidden';
}

function releaseScrollLock(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = overflowBeforeLock;
  }
}

export interface DialogSurfaceProps {
  /** Ist der Dialog offen? Geschlossen rendert der Baustein nichts. */
  isOpen: boolean;
  /** Schließen: Esc, Zurück-Taste, Abdunkelung (wenn erlaubt). */
  onClose?: () => void;
  /** false = Esc und Zurück-Taste schließen nicht (Einwilligung, @OB-056). Standard: true. */
  dismissible?: boolean;
  /** Klick auf die Abdunkelung schließt. Standard: true (nur wirksam, wenn dismissible). */
  closeOnBackdropClick?: boolean;
  /** Eigene Aktion beim Klick auf die Abdunkelung statt onClose (Esc und Zurück bleiben onClose). */
  onBackdropClick?: () => void;
  /** ARIA-Rolle: dialog (Standard) oder alertdialog (Rückfrage, die eine Entscheidung verlangt). */
  role?: 'dialog' | 'alertdialog';
  /** Form: zentriert (Standard) oder Blatt von unten. */
  placement?: 'center' | 'sheet';
  /** Lesebreite der Fläche. Standard 480px. */
  maxWidth?: string;
  /** Stapelhöhe; Standard: Navigation. */
  zIndex?: number;
  /** Farbe des Rahmens (z. B. Warnfarbe bei Rückfragen); Standard: normaler Rahmen. */
  accent?: string;
  /** id des Titels für aria-labelledby. */
  labelledBy?: string;
  /** Ersatz-Bezeichnung, wenn kein Titel existiert. */
  ariaLabel?: string;
  /** Start-Ziel des Fokus (@OB-014: bei gefährlichen Rückfragen zuerst „Abbrechen“). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** @OB-014: Enter löst in gefährlichen Rückfragen nichts aus. */
  suppressEnter?: boolean;
  /** Zusätzliche Klasse der Fläche (für Feinregeln der Aufrufer). */
  panelClassName?: string;
  /** data-testid der Fläche (Standard: dialog-surface). */
  testId?: string;
  children: ReactNode;
}

export const DialogSurface = ({
  isOpen,
  onClose,
  dismissible = true,
  closeOnBackdropClick = true,
  onBackdropClick,
  role = 'dialog',
  placement = 'center',
  maxWidth = dialogWidths.md,
  zIndex = cssVars.zIndex.navigation,
  accent,
  labelledBy,
  ariaLabel,
  initialFocusRef,
  suppressEnter,
  panelClassName,
  testId = 'dialog-surface',
  children,
}: DialogSurfaceProps) => {
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: dismissible ? onClose : undefined,
    closeOnBack: dismissible,
    initialFocusRef,
    suppressEnter,
  });
  const generatedId = useId();

  useEffect(() => {
    if (!isOpen) {return undefined;}
    acquireScrollLock();
    return releaseScrollLock;
  }, [isOpen]);

  if (!isOpen) {return null;}

  const isSheet = placement === 'sheet';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (dismissible && closeOnBackdropClick && e.target === e.currentTarget) {
      (onBackdropClick ?? onClose)?.();
    }
  };

  const scrimStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    flexDirection: 'column',
    alignItems: isSheet ? 'stretch' : 'center',
    justifyContent: isSheet ? 'flex-end' : 'center',
    zIndex,
    padding: isSheet ? 0 : cssVars.spacing.lg,
    overflowY: 'auto',
  };

  const panelStyle: CSSProperties = {
    background: cssVars.colors.surfaceElevated,
    color: cssVars.colors.textPrimary,
    border: accent ? `2px solid ${accent}` : `1px solid ${cssVars.colors.border}`,
    borderRadius: isSheet
      ? `${cssVars.borderRadius.lg} ${cssVars.borderRadius.lg} 0 0`
      : cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    width: '100%',
    maxWidth,
    maxHeight: isSheet ? '80vh' : '90vh',
    overflowY: 'auto',
    position: 'relative',
    paddingBottom: isSheet ? `env(safe-area-inset-bottom, ${cssVars.spacing.md})` : undefined,
    animation: isSheet
      ? 'dialogSurfaceSlideUp 0.3s ease-out'
      : 'dialogSurfaceSlideIn 0.2s ease-out',
  };

  const dialog = (
    <div style={scrimStyle} className="dialog-surface-scrim" data-placement={placement} onClick={handleBackdropClick}>
      <div
        ref={focusTrap.containerRef}
        style={panelStyle}
        className={['dialog-surface-panel', panelClassName].filter(Boolean).join(' ')}
        data-placement={placement}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy ?? (ariaLabel ? undefined : generatedId)}
        aria-label={ariaLabel}
      >
        {children}
      </div>

      <style>{`
        @keyframes dialogSurfaceSlideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dialogSurfaceSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        ${mediaQueries.tabletDown} {
          .dialog-surface-scrim[data-placement="center"] {
            padding: ${cssVars.spacing.sm} !important;
            padding-top: ${cssVars.spacing.xl} !important;
            align-items: flex-start !important;
          }
          .dialog-surface-panel[data-placement="center"] {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(dialog, document.body);
};
