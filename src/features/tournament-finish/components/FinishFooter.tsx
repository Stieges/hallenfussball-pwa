/**
 * Fuß des Abschluss-Dialogs: Handy = Vollbild mit festem Fuß, die Tasten untereinander (Nebentaste oben, Haupttaste unten,
 * Daniel 25.10.); breiter = Tasten rechts in einer Zeile. Haupttaste ≥ `touchTargets.primary`, Nebentaste ≥ `touchTargets.minimum`.
 * Die Haupttaste kann „beschäftigt“ sein (Fortschritt, `aria-busy`): kein zweites Tippen, Abbrechen gesperrt (@LZ-021).
 */
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { cssVars } from '../../../design-tokens';
import { small } from './finishStyles';

export interface FinishFooterProps {
  phone: boolean;
  /** Zeile über den Tasten (z. B. „Abschließen geht erst mit Verbindung“). */
  hint?: string;
  /** Nebentaste (meist „Abbrechen“); ohne Angabe keine. */
  secondary?: { label: string; onClick: () => void; disabled?: boolean; testId?: string } | null;
  primary: { label: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; testId: string };
}

const spinner: CSSProperties = {
  width: cssVars.iconSizes.sm, height: cssVars.iconSizes.sm, borderRadius: '50%', flex: 'none',
  border: `${cssVars.borderWidth.medium} solid currentColor`, borderRightColor: 'transparent', animation: 'finishSpin 1s linear infinite',
};

export function FinishFooter({ phone, hint, secondary, primary }: FinishFooterProps) {
  const side = secondary ?? null;
  const row: CSSProperties = phone
    ? { display: 'grid', gap: cssVars.spacing.sm }
    : { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: cssVars.spacing.md, flexWrap: 'wrap' };
  const wide: CSSProperties = phone ? { width: '100%' } : { flex: '0 1 auto', paddingLeft: cssVars.spacing.lg, paddingRight: cssVars.spacing.lg };
  return (
    // data-overlap-ok: der Fuß steht UNTER dem scrollenden Inhalt, nicht darüber; ein Eintrag am Rand wird vom Scroll-Bereich abgeschnitten.
    // Die Messung (visual:metrics) nimmt dessen volles Rechteck und meldet sonst eine Scheinüberlappung mit der Taste im Fuß.
    <div
      style={{ display: 'grid', gap: cssVars.spacing.sm }} data-testid="finish-footer"
      data-overlap-ok="Fuß unter dem scrollenden Inhalt des Dialogs, keine Überdeckung (Scroll-Bereich schneidet ab)"
    >
      {hint !== undefined && <p style={{ ...small, textAlign: phone ? 'center' : 'left' }} data-testid="finish-footer-hint">{hint}</p>}
      <div style={row}>
        {side !== null && (
          <Button variant="secondary" size="lg" style={{ ...wide, minHeight: cssVars.touchTargets.minimum }} onClick={side.onClick} disabled={side.disabled} data-testid={side.testId ?? 'finish-cancel'}>
            {side.label}
          </Button>
        )}
        <Button
          variant="primary" size="lg" style={{ ...wide, minHeight: cssVars.touchTargets.primary, ...(primary.busy === true ? { opacity: 1, cursor: 'progress' } : {}) }}
          onClick={primary.onClick} disabled={primary.disabled === true} busy={primary.busy === true} data-testid={primary.testId} data-primary
        >
          {primary.busy === true && <span style={spinner} aria-hidden="true" />}
          {primary.label}
        </Button>
      </div>
      <style>{'@keyframes finishSpin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
