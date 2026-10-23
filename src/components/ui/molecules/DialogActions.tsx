/**
 * Tasten-Fuß für Dialoge (@OB-061): Nebentasten und Haupttaste stehen nebeneinander, wenn alle Beschriftungen einzeilig in
 * den Behälter passen, sonst untereinander in voller Breite, die Haupttaste unten. Beschriftungen werden nie gekürzt, nie
 * mit „…“ versehen und nie umbrochen. Der Wechsel folgt dem Platz im Behälter, nicht der Gerätebreite: Die Tasten sitzen in
 * einer umbrechenden Flex-Zeile (`nowrap` je Taste, `flex-grow` füllt die Zeile). Passt die nächste Taste nicht mehr in die
 * Zeile, rutscht sie in die nächste und füllt dort die ganze Breite; die Haupttaste steht zuletzt im Dokument, also unten.
 * Grenzen: (1) Ist eine einzelne Beschriftung allein breiter als der Behälter, läuft sie über; der Baustein kürzt sie nie.
 * Dann ist der Text zu kürzen (Übersetzung), die Überlauf-Messung (`ueberlauf.element`) fängt das. (2) Bei drei oder mehr Tasten
 * entsteht je nach Platz eine Mischform (z. B. zwei Nebentasten nebeneinander, die Haupttaste allein darunter); die Haupttaste
 * steht immer zuletzt, also unten bzw. rechts. Ob Mischform oder „alle oder keine“ gilt, ist als Regelfrage offen (@OB-061 nennt zwei Tasten).
 * Der Baustein setzt keinen Außenabstand: Im Dialog steht er im Fuß-Slot von `DialogSurface`/`Dialog` (S1, @OB-062), der den Abstand trägt.
 * Haupttaste mindestens `touchTargets.primary` (@OB-022), Nebentasten mindestens `touchTargets.minimum`.
 */
import type { CSSProperties, ReactNode, Ref } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../Button';

export interface DialogAction {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  'data-testid'?: string;
  /** Ref auf das Button-Element (z. B. Fokus nach dem Speichern). */
  buttonRef?: Ref<HTMLButtonElement>;
}

export interface DialogActionsProps {
  /** Haupttaste (steht unten bzw. rechts). */
  primary: DialogAction;
  /** Ton der Haupttaste; `danger` für zerstörende Aktionen. */
  primaryVariant?: 'primary' | 'danger';
  /** Nebentasten in der Reihenfolge von oben nach unten bzw. links nach rechts. */
  secondary?: DialogAction[];
  'data-testid'?: string;
}

const row: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: cssVars.spacing.sm,
};

// `flex: 1 1 auto` mit `nowrap`: die Mindestbreite einer Taste ist ihre einzeilige Beschriftung
const buttonBase: CSSProperties = { flex: '1 1 auto', whiteSpace: 'nowrap', maxWidth: '100%' };
const primaryStyle: CSSProperties = { ...buttonBase, minHeight: cssVars.touchTargets.primary };
const secondaryStyle: CSSProperties = { ...buttonBase, minHeight: cssVars.touchTargets.minimum };

export const DialogActions = ({ primary, primaryVariant = 'primary', secondary = [], 'data-testid': testId = 'dialog-actions' }: DialogActionsProps) => (
  <div style={row} data-testid={testId} data-dialog-actions>
    {secondary.map((a, i) => (
      <Button key={a['data-testid'] ?? i} ref={a.buttonRef} variant="secondary" size="lg" style={secondaryStyle} onClick={a.onClick} disabled={a.disabled} data-testid={a['data-testid']}>
        {a.label}
      </Button>
    ))}
    <Button ref={primary.buttonRef} variant={primaryVariant} size="lg" style={primaryStyle} onClick={primary.onClick} disabled={primary.disabled} data-testid={primary['data-testid']} data-primary>
      {primary.label}
    </Button>
  </div>
);
