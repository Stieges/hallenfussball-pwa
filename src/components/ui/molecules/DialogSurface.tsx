/**
 * DialogSurface – gemeinsamer Grundbaustein aller Dialoge und Blätter (B-43a).
 *
 * Liefert: Abdunkelung, deckende Fläche (surfaceElevated, nie Verlauf oder
 * Transparenz), Lesebreite, Fokusfalle, Esc/Zurück (abschaltbar für die
 * Einwilligung), Scroll-Sperre, Portal in document.body und die Form am Handy
 * (Blatt von unten bei placement="sheet"; zentriert, oben ausgerichtet unter
 * tabletDown bei placement="center").
 *
 * Handy-Blatt (B-43b3, @OB-021/@OB-055): zentrierte Dialoge erscheinen unter
 * breakpoints.sheet (600 px) als Blatt von unten (volle Breite, unten verankert, Safe-Area);
 * size="fullscreen" bleibt Vollbild. `data-layout` zeigt die wirksame Form
 * (center | sheet | fullscreen), `data-placement` die angeforderte.
 *
 * Kopf und Fuß (S1, @OB-062/@OB-063): Mit den Slots `header` und/oder `footer` bleiben Kopf (Titel,
 * Schließen) und Tasten-Fuß stehen; nur der Inhalt (`children`) dazwischen scrollt. Die Fläche ist dann
 * eine Spalte, der Inhalt `flex: 1 1 auto` mit eigenem Scroll und Mindesthöhe `touchTargets.primary`; unter dieser Höhe (400 % Zoom)
 * scrollt die ganze Fläche, damit alles erreichbar bleibt (WCAG 1.4.10).
 * Ein kurzer Inhalt wird nicht gestreckt (die Fläche ist so hoch wie ihr Inhalt, höchstens `maxHeight`).
 * Am Blatt trägt der Fuß den Safe-Area-Abstand. Ohne Slots bleibt alles wie zuvor (Fläche scrollt als Ganzes).
 *
 * Verbindliche Vorgaben: @OB-055 (deckende Fläche, Kontrast), @OB-056 (Einwilligung
 * – Schließen-Verhalten über `dismissible`).
 */
import { CSSProperties, ReactNode, RefObject, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { breakpointValues, cssVars, dialogWidths, mediaQueries } from '../../../design-tokens';
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

/** Ist das Fenster schmaler als das Blatt-Token? (Größenänderung wird verfolgt.) */
function useBelowSheetWidth(): boolean {
  const query = () => typeof window !== 'undefined' && window.innerWidth < breakpointValues.sheet;
  const [below, setBelow] = useState<boolean>(query);
  useEffect(() => {
    const onResize = () => setBelow(query());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return below;
}

// Kopf und Fuß schrumpfen nie; der Inhalt nimmt den Rest und scrollt allein (min-height: 0 lässt ihn unter die Höhe seines Inhalts schrumpfen).
const slotFixed: CSSProperties = { flex: 'none' };
// Mindesthöhe des Inhalts: ein Bedienelement der Haupttasten-Größe. Reicht der Platz nicht einmal dafür (z. B. 400 % Zoom, 320×256),
// scrollt die ganze Fläche (WCAG 1.4.10): dann sind Kopf, Inhalt und Fuß erreichbar, statt dass der Inhalt auf 0 schrumpft.
const bodyStyle: CSSProperties = { flex: '1 1 auto', minHeight: cssVars.touchTargets.primary, overflowY: 'auto' };
const footerStyle = (isSheet: boolean): CSSProperties => ({
  flex: 'none',
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  paddingTop: cssVars.spacing.md,
  paddingLeft: cssVars.spacing.xl,
  paddingRight: cssVars.spacing.xl,
  // Blatt: Abstand zur Unterkante plus Safe-Area (Notch, Home-Indikator), @OB-021
  paddingBottom: isSheet ? `calc(${cssVars.spacing.md} + env(safe-area-inset-bottom, 0px))` : cssVars.spacing.md,
});

/**
 * Steht irgendein modaler Dialog offen (jede Rolle: `dialog` und `alertdialog`, etwa die Abpfiff-Rückfrage)? Die Tastenkürzel des Cockpits
 * schweigen dann (@SL-142, Plan Cockpit v2 A4-1). Die Markierung setzt nur dieser Baustein, deshalb liegt die Abfrage hier.
 */
// eslint-disable-next-line react-refresh/only-export-components -- reine Abfrage, hängt an der Markierung dieses Bausteins
export function istModalerDialogOffen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
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
  /**
   * Größe: normal (Standard) oder Vollbild. Vollbild füllt auf jedem Gerät die ganze Fläche
   * (kein Rand, keine Rundung); Kopf, Inhalt und Fußleiste ordnet der Aufrufer als direkte
   * Kinder, der Inhalt (`main`) scrollt, die Fußleiste klebt unten. Für Eingabe-Bildschirme
   * wie das Strafstoßschießen (B-43b2-F).
   */
  size?: 'default' | 'fullscreen';
  /** Lesebreite der Fläche. Standard 480px (bei Vollbild ohne Wirkung). */
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
  /** Zurück-Taste schließt (Standard: wie dismissible). false für Seiten, auf denen Zurück navigiert. */
  closeOnBack?: boolean;
  /** @OB-014: Enter löst in gefährlichen Rückfragen nichts aus. */
  suppressEnter?: boolean;
  /** Kopf (Titel, Schließen): bleibt oben stehen, scrollt nicht mit (S1, @OB-062). */
  header?: ReactNode;
  /** Tasten-Fuß: bleibt unten stehen, scrollt nicht mit; trägt am Blatt den Safe-Area-Abstand (S1, @OB-062). */
  footer?: ReactNode;
  /** Zusätzliche Klasse der Fläche (für Feinregeln der Aufrufer). */
  panelClassName?: string;
  /** data-testid der Fläche (Standard: dialog-surface). */
  testId?: string;
  /** data-testid der Abdunkelung (für Tests, die darauf klicken). */
  scrimTestId?: string;
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
  size = 'default',
  maxWidth = dialogWidths.md,
  zIndex = cssVars.zIndex.navigation,
  accent,
  labelledBy,
  ariaLabel,
  initialFocusRef,
  suppressEnter,
  closeOnBack,
  panelClassName,
  header,
  footer,
  testId = 'dialog-surface',
  scrimTestId,
  children,
}: DialogSurfaceProps) => {
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: dismissible ? onClose : undefined,
    closeOnBack: closeOnBack ?? dismissible,
    initialFocusRef,
    suppressEnter,
  });
  const generatedId = useId();
  const belowSheetWidth = useBelowSheetWidth();

  useEffect(() => {
    if (!isOpen) {return undefined;}
    acquireScrollLock();
    return releaseScrollLock;
  }, [isOpen]);

  if (!isOpen) {return null;}

  const isFull = size === 'fullscreen';
  // Zentrierte Dialoge werden am Handy zum Blatt; Vollbild bleibt Vollbild.
  const isSheet = !isFull && (placement === 'sheet' || belowSheetWidth);
  const layout = isFull ? 'fullscreen' : isSheet ? 'sheet' : 'center';
  // Slots wirken nur in der normalen Größe; Vollbild ordnet der Aufrufer selbst (B-43b2-F)
  const hasHeader = Boolean(header);
  const hasFooter = Boolean(footer);
  const hasSlots = !isFull && (hasHeader || hasFooter);
  const sheetHeight = placement === 'sheet' ? '80' : '90';

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
    // Blatt: Fläche rutscht per margin-top: auto nach unten; ein Überlauf läuft nach unten und scrollt
    // (bei flex-end wäre die Oberkante unerreichbar).
    justifyContent: isSheet ? 'flex-start' : 'center',
    zIndex,
    padding: isSheet || isFull ? 0 : cssVars.spacing.lg,
    overflowY: isFull ? 'hidden' : 'auto',
  };

  const panelStyle: CSSProperties = {
    background: cssVars.colors.surfaceElevated,
    color: cssVars.colors.textPrimary,
    border: accent ? `2px solid ${accent}` : `1px solid ${cssVars.colors.border}`,
    borderRadius: isFull
      ? 0
      : isSheet
        ? `${cssVars.borderRadius.lg} ${cssVars.borderRadius.lg} 0 0`
        : cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    width: '100%',
    maxWidth: isFull || (isSheet && placement === 'center') ? '100%' : maxWidth,
    ...(isFull ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}),
    // Blatt: Höhe über CSS (dvh mit vh-Rückfall, siehe Style-Block), sonst 90vh
    maxHeight: isFull ? '100%' : isSheet ? undefined : '90vh',
    marginTop: isSheet ? 'auto' : undefined,
    ...(hasSlots ? { display: 'flex', flexDirection: 'column' as const } : {}),
    // Mit Slots schrumpft der Inhalt vor der Fläche; die Fläche scrollt nur, wenn selbst die Mindesthöhe des Inhalts nicht mehr passt
    overflowY: isFull ? 'hidden' : 'auto',
    position: 'relative',
    // Safe-Area: trägt der Fuß (hasFooter), sonst die Fläche (ohne Slots und mit Kopf allein)
    paddingBottom: isSheet && !hasFooter ? `env(safe-area-inset-bottom, ${cssVars.spacing.md})` : undefined,
    animation: isSheet
      ? 'dialogSurfaceSlideUp 0.3s ease-out'
      : 'dialogSurfaceSlideIn 0.2s ease-out',
  };

  const dialog = (
    <div style={scrimStyle} className="dialog-surface-scrim" data-placement={placement} data-layout={layout} data-size={size} data-testid={scrimTestId} onClick={handleBackdropClick}>
      <div
        ref={focusTrap.containerRef}
        style={panelStyle}
        className={['dialog-surface-panel', panelClassName].filter(Boolean).join(' ')}
        data-placement={placement}
        data-layout={layout}
        data-size={size}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy ?? (ariaLabel ? undefined : generatedId)}
        aria-label={ariaLabel}
      >
        {hasSlots ? (
          <>
            {hasHeader && <div style={slotFixed} data-testid="dialog-surface-header">{header}</div>}
            <div style={bodyStyle} data-testid="dialog-surface-body">{children}</div>
            {hasFooter && <div style={footerStyle(isSheet)} className="dialog-surface-footer" data-testid="dialog-surface-footer">{footer}</div>}
          </>
        ) : (
          <>
            {header}
            {children}
            {footer}
          </>
        )}
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
        .dialog-surface-panel[data-layout="sheet"] {
          max-height: ${sheetHeight}vh;
          max-height: ${sheetHeight}dvh;
        }
        ${mediaQueries.tabletDown} {
          .dialog-surface-scrim[data-layout="center"] {
            padding: ${cssVars.spacing.sm} !important;
            padding-top: ${cssVars.spacing.xl} !important;
            align-items: flex-start !important;
          }
          .dialog-surface-panel[data-layout="center"] {
            max-width: 100% !important;
          }
          .dialog-surface-footer {
            padding-left: ${cssVars.spacing.md} !important;
            padding-right: ${cssVars.spacing.md} !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(dialog, document.body);
};
