/**
 * ActionSheet (@SL-193, @SL-239): eine Auswahl beschrifteter Aktionen als Blatt (Handy) bzw. kleines Fenster (Desktop).
 *
 * Fachfrei: Titel, Abzeichen, Zusammenfassung, Einträge und die Beschriftung des „X“ kommen vom Aufrufer.
 * - Kopf (bleibt stehen): Titel mit Abzeichen auf der Grundlinie daneben, „X“ oben rechts (vorgelesen mit `closeLabel`),
 *   darunter `summary` (Meta-Zeile, Spielzeile) bzw. `subtitle`. Unten gibt es keine Taste „Schließen“ mehr.
 * - Jeder Eintrag ist eine Taste von mindestens `touchTargets.primary` Höhe mit Symbol (`icon`), Wort und `data-testid`.
 *   `danger` trägt die rote Randfarbe, `primary` ist die gefüllte Haupttafel: sie steht immer zuletzt und im festen Fuß
 *   (am Handy ohne Scrollen erreichbar, @OB-022); höchstens ein Eintrag ist gefüllt (der erste mit `primary`).
 * - Ein gesperrter Eintrag bleibt sichtbar (`aria-disabled`, kein Klick) und nennt unter der Beschriftung seinen Grund – er fehlt nie still.
 * Fläche, Abdunkelung, Fokusfalle, Esc und Scroll-Sperre kommen aus `DialogSurface`.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cssVars, dialogWidths, mediaQueries } from '../../../design-tokens';
import { Icons } from '../Icons';
import { DialogSurface } from './DialogSurface';

export interface ActionSheetItem {
  id: string;
  label: string;
  /** Symbol vor dem Wort (dekorativ, das Wort trägt die Bedeutung) */
  icon?: ReactNode;
  /** Gefüllte Haupttaste: steht zuletzt, höchstens eine je Blatt */
  primary?: boolean;
  /** Rote Randfarbe (z. B. „Nicht angetreten“) */
  danger?: boolean;
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
  /** Abzeichen auf der Grundlinie neben dem Titel (das Wort trägt der Aufrufer, nie nur Farbe) */
  badge?: ReactNode;
  subtitle?: ReactNode;
  /** Meta-Zeile und Spielzeile unter dem Titel (statt `subtitle`) */
  summary?: ReactNode;
  items: readonly ActionSheetItem[];
  /** Zugänglicher Name des „X“ oben rechts */
  closeLabel: string;
  /** data-testid der Fläche; das „X“ trägt `${testId}-close` */
  testId?: string;
}

const headerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, paddingTop: cssVars.spacing.lg, paddingBottom: cssVars.spacing.sm };
const titleRowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: cssVars.spacing.sm };
const titleGroupStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: cssVars.spacing.sm, rowGap: cssVars.spacing.xs, minWidth: 0, paddingTop: cssVars.spacing.sm };
const headingStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere' };
const closeStyle: CSSProperties = {
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: cssVars.touchTargets.minimum,
  minHeight: cssVars.touchTargets.minimum,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
};
const subtitleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
const bodyStyle: CSSProperties = { paddingTop: cssVars.spacing.xs, paddingBottom: cssVars.spacing.sm };
// Seitenrand wie der feste Fuß der Fläche (xl; am Handy md), damit Liste und Haupttaste bündig stehen
const edgeCss = `.action-sheet-edge { padding-left: ${cssVars.spacing.xl}; padding-right: ${cssVars.spacing.xl}; } ${mediaQueries.tabletDown} { .action-sheet-edge { padding-left: ${cssVars.spacing.md}; padding-right: ${cssVars.spacing.md}; } }`;
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, margin: 0, padding: 0, listStyle: 'none' };
const labelStyle: CSSProperties = { flex: 1, minWidth: 0, overflowWrap: 'anywhere' };
const reasonStyle: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.normal };

function itemStyle(item: ActionSheetItem): CSSProperties {
  const disabled = item.disabled === true;
  const filled = item.primary === true;
  const color = filled ? cssVars.colors.onPrimary : disabled ? cssVars.colors.textSecondary : cssVars.colors.textPrimary;
  return {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    width: '100%',
    minHeight: cssVars.touchTargets.primary,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    textAlign: 'left',
    fontFamily: cssVars.fontFamilies.body,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: filled ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
    color,
    background: filled ? cssVars.colors.primary : cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${filled ? cssVars.colors.primary : item.danger === true ? cssVars.colors.error : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    opacity: filled && disabled ? cssVars.opacity.disabled : undefined,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function ItemButton({ item }: { item: ActionSheetItem }) {
  const disabled = item.disabled === true;
  return (
    <button
      type="button"
      style={itemStyle(item)}
      aria-disabled={disabled ? true : undefined}
      onClick={() => { if (!disabled) { item.onSelect(); } }}
      data-testid={item.testId}
      data-primary={item.primary === true ? true : undefined}
    >
      {item.icon !== undefined && <span aria-hidden="true" style={{ display: 'inline-flex', flex: 'none' }}>{item.icon}</span>}
      <span style={labelStyle}>
        {item.label}
        {disabled && item.reason !== undefined && <span style={reasonStyle}>{item.reason}</span>}
      </span>
    </button>
  );
}

export function ActionSheet({ isOpen, onClose, title, badge, subtitle, summary, items, closeLabel, testId = 'action-sheet' }: ActionSheetProps) {
  const titleId = useId();
  const main = items.find((item) => item.primary === true);
  const others = items.filter((item) => item !== main).map((item) => (item.primary === true ? { ...item, primary: false } : item));
  // Die Haupttaste steht im festen Fuß, solange es weitere Einträge gibt; ist sie der einzige Eintrag, steht sie im Inhalt (sonst bliebe über dem Fuß eine leere Fläche)
  const inFooter = main !== undefined && others.length > 0;
  const bodyItems = main !== undefined && !inFooter ? [main] : others;

  const header = (
    <div style={headerStyle} className="action-sheet-edge">
      <div style={titleRowStyle}>
        <div style={titleGroupStyle}>
          <h2 id={titleId} style={headingStyle}>{title}</h2>
          {badge}
        </div>
        <button type="button" style={closeStyle} onClick={onClose} aria-label={closeLabel} data-testid={`${testId}-close`}>
          <Icons.X size={cssVars.iconSizes.md} />
        </button>
      </div>
      {summary}
      {summary === undefined && subtitle !== undefined && <p style={subtitleStyle}>{subtitle}</p>}
    </div>
  );
  const footer = !inFooter ? undefined : (
    <ul style={listStyle}>
      <li><ItemButton item={main} /></li>
    </ul>
  );

  return (
    <DialogSurface isOpen={isOpen} onClose={onClose} placement="center" maxWidth={dialogWidths.sm} labelledBy={titleId} testId={testId} header={header} footer={footer}>
      <div style={bodyStyle} className="action-sheet-edge">
        <style>{edgeCss}</style>
        <ul style={listStyle}>
          {bodyItems.map((item) => (
            <li key={item.id}><ItemButton item={item} /></li>
          ))}
        </ul>
      </div>
    </DialogSurface>
  );
}
