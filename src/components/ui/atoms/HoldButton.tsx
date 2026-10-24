/**
 * HoldButton – Knopf, der erst nach `HOLD_MS` Gedrückthalten auslöst (Abpfiff, @SL-157).
 *
 * Ein kurzer Tipp oder Klick bewirkt nichts (@SL-158). Loslassen, Verlassen des Knopfs, Wegschieben,
 * Abbruch, Fokusverlust, Aushängen und `disabled` beenden das Halten ohne Auslösung. Rechte Maustaste und
 * ein zweiter Finger starten nichts. Leertaste und Eingabetaste auf dem fokussierten Knopf wirken wie
 * Gedrückthalten (Entscheidung A3, @SL-167): erst etwa eine Sekunde löst aus, ein kurzer Druck nie.
 * Die Füllung zeigt das Halten sichtbar, als Balken am unteren Rand auf einer Spur (Mockup, S5); sie bleibt auch
 * bei reduzierter Bewegung (Rückmeldung, keine Deko).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

/** @SL-157 „etwa eine Sekunde“ */
export const HOLD_MS = 1000;

export interface HoldButtonProps {
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  onHold: () => void;
  testId: string;
  /** Text, per aria-describedby verknüpft (nicht aria-description), z. B. „Gedrückt halten, etwa eine Sekunde“ */
  beschreibung: string;
  disabled?: boolean;
  /** Roving Tabindex der umgebenden Werkzeugleiste (S5): `-1` nimmt den Knopf aus der Tab-Reihenfolge. */
  tabIndex?: number;
  /** Enge Leiste (Handy): Symbol über dem Text, kleinere Schrift und Abstände, damit nichts abgeschnitten wird. */
  kompakt?: boolean;
  /** Füllt die Zelle der umgebenden Reihe (Laptop und Tablet quer: keine Lücke neben dem Knopf). */
  fuellend?: boolean;
}

const istHaltetaste = (key: string): boolean => key === 'Enter' || key === ' ';

const knopfStil: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: cssVars.spacing.sm,
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.primary,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  boxSizing: 'border-box',
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.error}`,
  borderRadius: cssVars.borderRadius.md,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
  fontFamily: 'inherit',
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
};

const kompaktStil: CSSProperties = { flexDirection: 'column', gap: 0, padding: `${cssVars.spacing.xs} 0`, fontSize: cssVars.fontSizes.sm };

const spurStil: CSSProperties = {
  position: 'absolute',
  left: cssVars.spacing.sm,
  right: cssVars.spacing.sm,
  bottom: cssVars.spacing.xs,
  height: cssVars.spacing.xs,
  borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.errorSubtle,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const fuellungStil = (fuellt: boolean): CSSProperties => ({
  display: 'block',
  width: '100%',
  height: '100%',
  borderRadius: cssVars.borderRadius.full,
  background: cssVars.colors.holdFill,
  transformOrigin: 'left center',
  transform: fuellt ? 'scaleX(1)' : 'scaleX(0)',
  transition: fuellt ? 'transform var(--hold-duration) linear' : 'none',
});

const inhaltStil: CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm };
const zweiStil: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' };
const subStil: CSSProperties = { fontSize: cssVars.fontSizes.xs, fontWeight: cssVars.fontWeights.medium, color: cssVars.colors.textSecondary };

export function HoldButton({ label, sublabel, icon, onHold, testId, beschreibung, disabled = false, tabIndex, kompakt = false, fuellend = false }: HoldButtonProps) {
  const [fuellt, setFuellt] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigerRef = useRef<number | null>(null);
  const tasteRef = useRef<string | null>(null);
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;
  const beschreibungId = useId();

  const abbrechen = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    zeigerRef.current = null;
    tasteRef.current = null;
    setFuellt(false);
  }, []);

  const starten = useCallback(() => {
    setFuellt(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      zeigerRef.current = null;
      tasteRef.current = null;
      setFuellt(false);
      onHoldRef.current();
    }, HOLD_MS);
  }, []);

  useEffect(() => {
    if (disabled) { abbrechen(); }
  }, [disabled, abbrechen]);
  useEffect(() => abbrechen, [abbrechen]);

  const laeuft = () => timerRef.current !== null;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0 || laeuft()) { return; }
    zeigerRef.current = e.pointerId;
    // Touch erfasst den Zeiger implizit; ohne Freigabe käme beim Wegschieben kein pointerleave.
    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* kein erfasster Zeiger: nichts freizugeben */ }
    }
    starten();
  };
  const onPointerEnde = (e: PointerEvent<HTMLButtonElement>) => {
    if (zeigerRef.current === e.pointerId) { abbrechen(); }
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (zeigerRef.current !== e.pointerId) { return; }
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { abbrechen(); }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!istHaltetaste(e.key)) { return; }
    e.preventDefault();
    if (disabled || e.repeat || laeuft()) { return; }
    tasteRef.current = e.key;
    starten();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!istHaltetaste(e.key)) { return; }
    e.preventDefault();
    if (tasteRef.current === e.key) { abbrechen(); }
  };

  const name = sublabel ? `${label} ${sublabel}` : label;
  return (
    <button
      type="button"
      data-testid={testId}
      data-halteknopf=""
      data-fuellt={fuellt ? 'true' : undefined}
      aria-label={name}
      aria-describedby={beschreibungId}
      disabled={disabled}
      tabIndex={tabIndex}
      style={{ ...knopfStil, ...(kompakt ? kompaktStil : {}), ...(fuellend ? { flex: 1 } : {}), '--hold-duration': `${HOLD_MS}ms` } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerEnde}
      onPointerCancel={onPointerEnde}
      onPointerLeave={onPointerEnde}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={abbrechen}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span data-testid={`${testId}-spur`} style={spurStil} aria-hidden="true">
        <span data-testid={`${testId}-fuellung`} style={fuellungStil(fuellt)} />
      </span>
      <span style={kompakt ? { ...inhaltStil, flexDirection: 'column', gap: 0 } : inhaltStil}>
        {icon}
        <span style={sublabel ? zweiStil : undefined}>
          {label}
          {sublabel && <small style={subStil}>{sublabel}</small>}
        </span>
      </span>
      <span id={beschreibungId} hidden>{beschreibung}</span>
    </button>
  );
}
