/**
 * ActionSheet (@SL-193): eine Auswahl beschrifteter Aktionen als Blatt (Handy) bzw. kleines Fenster (Desktop).
 *
 * Fachfrei: Titel, Untertitel, Einträge und die Beschriftung von „Schließen“ kommen vom Aufrufer. Jeder Eintrag ist eine
 * Taste von mindestens `touchTargets.primary` Höhe mit `data-testid`. Ein gesperrter Eintrag bleibt sichtbar
 * (`aria-disabled`, kein Klick) und nennt unter der Beschriftung seinen Grund – er fehlt nie still.
 * Fläche, Abdunkelung, Fokusfalle, Esc und Scroll-Sperre kommen aus `DialogSurface`.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Button } from '../Button';
import { DialogSurface } from './DialogSurface';

export interface ActionSheetItem {
  id: string;
  label: string;
  /** Gesperrt: sichtbar, aber ohne Wirkung; `reason` erklärt warum */
  disabled?: boolean;
  reason?: string;
  testId: string;
  onSelect: () => void;
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  items: readonly ActionSheetItem[];
  closeLabel: string;
  /** data-testid der Fläche */
  testId?: string;
}

const contentStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.lg };
const headingStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const subtitleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, margin: 0, padding: 0, listStyle: 'none' };
const reasonStyle: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.normal, color: cssVars.colors.textSecondary };

function itemStyle(disabled: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    minHeight: cssVars.touchTargets.primary,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    textAlign: 'left',
    fontFamily: cssVars.fontFamilies.body,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: disabled ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
    background: cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function ActionSheet({ isOpen, onClose, title, subtitle, items, closeLabel, testId = 'action-sheet' }: ActionSheetProps) {
  const titleId = useId();
  return (
    <DialogSurface isOpen={isOpen} onClose={onClose} placement="center" maxWidth={dialogWidths.sm} labelledBy={titleId} testId={testId}>
      <div style={contentStyle}>
        <div>
          <h2 id={titleId} style={headingStyle}>{title}</h2>
          {subtitle !== undefined && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
        <ul style={listStyle}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                style={itemStyle(item.disabled === true)}
                aria-disabled={item.disabled === true ? true : undefined}
                onClick={() => { if (item.disabled !== true) { item.onSelect(); } }}
                data-testid={item.testId}
              >
                {item.label}
                {item.disabled === true && item.reason !== undefined && <span style={reasonStyle}>{item.reason}</span>}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="lg" fullWidth style={{ minHeight: cssVars.touchTargets.minimum }} onClick={onClose} data-testid={`${testId}-close`}>
          {closeLabel}
        </Button>
      </div>
    </DialogSurface>
  );
}
