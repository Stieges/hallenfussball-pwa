/**
 * ScoreEntrySheet (@SL-238, @SL-195): Blatt „Endergebnis“ als Liste, fachfrei. Kopf (bleibt stehen): Titel, Untertitel, „X“ oben rechts.
 * Inhalt: Liste „Team | Tore“, Heim oben, Gast unten (@OB-064); je Zeile der Name links (bricht um), das Tor-Feld in fester Spalte rechts,
 * daneben klein „−“ und „+“ (je mindestens `touchTargets.minimum` groß, @OB-022). Slots `notice` (oben, z. B. Hinweis „inzwischen geändert“)
 * und `hint` (unter der Liste). Fuß (bleibt stehen, `DialogActions`): „Abbrechen“ und die Haupttaste „Ergebnis speichern“ (@OB-061).
 * Am Handy erscheint die Fläche als Blatt von unten (volle Breite, 90 % der Höhe), sonst zentriert (`DialogSurface` placement `center`).
 * Ein Tipp neben das Blatt (Schleier) schließt nicht: Eingaben gehen nicht verloren; „Abbrechen“, „X“ und Esc verwerfen sie.
 * Der Fokus startet im ersten Feld (`initialFocusRef`). Fläche, Fokusfalle und Scroll-Sperre kommen aus `DialogSurface`.
 */
import { useId, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Icons } from '../Icons';
import { DialogActions } from './DialogActions';
import { DialogSurface } from './DialogSurface';

export interface ScoreEntryRow {
  /** Schlüssel der Zeile (`home` | `away`) */
  id: string;
  /** Name der Mannschaft (bricht um, nie abgeschnitten) */
  name: ReactNode;
  /** Das Tor-Feld (`ScoreDraftInput`) */
  field: ReactNode;
  minusLabel: string;
  plusLabel: string;
  onMinus: () => void;
  onPlus: () => void;
  minusTestId: string;
  plusTestId: string;
}

export interface ScoreEntrySheetProps {
  title: string;
  subtitle?: ReactNode;
  /** Zugänglicher Name des „X“ */
  closeLabel: string;
  teamHeading: string;
  goalsHeading: string;
  rows: readonly [ScoreEntryRow, ScoreEntryRow];
  notice?: ReactNode;
  hint?: ReactNode;
  cancelLabel: string;
  saveLabel: string;
  saveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** data-testid der Fläche; Abbrechen, Speichern und „X“ tragen `${testId}-cancel|save|close` */
  testId?: string;
}

const headerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, padding: `${cssVars.spacing.lg} ${cssVars.spacing.md} ${cssVars.spacing.sm}` };
const titleRowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: cssVars.spacing.sm };
const headingStyle: CSSProperties = { margin: 0, paddingTop: cssVars.spacing.sm, fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere' };
const closeStyle: CSSProperties = {
  flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: cssVars.touchTargets.minimum, minHeight: cssVars.touchTargets.minimum,
  padding: 0, background: 'transparent', border: 'none', color: cssVars.colors.textPrimary, cursor: 'pointer',
};
const subtitleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
const bodyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: `${cssVars.spacing.xs} ${cssVars.spacing.md} ${cssVars.spacing.sm}` };
// Name | Tor-Feld | − | + : die Spalte des Felds ist für beide Zeilen gleich breit (Raster), der Name nimmt den Rest
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${cssVars.touchTargets.primary} auto auto`, alignItems: 'center', columnGap: cssVars.spacing.sm, rowGap: cssVars.spacing.sm };
const headingCellStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary };
const nameStyle: CSSProperties = { fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary, overflowWrap: 'break-word', minWidth: 0 };
const stepStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: cssVars.touchTargets.minimum, minHeight: cssVars.touchTargets.minimum,
  padding: 0, background: 'transparent', border: 'none', borderRadius: cssVars.borderRadius.sm, color: cssVars.colors.textPrimary, cursor: 'pointer',
};

export function ScoreEntrySheet({
  title, subtitle, closeLabel, teamHeading, goalsHeading, rows, notice, hint, cancelLabel, saveLabel, saveDisabled, onCancel, onSave, initialFocusRef, testId = 'score-entry-sheet',
}: ScoreEntrySheetProps) {
  const titleId = useId();
  const header = (
    <div style={headerStyle}>
      <div style={titleRowStyle}>
        <h2 id={titleId} style={headingStyle}>{title}</h2>
        <button type="button" style={closeStyle} onClick={onCancel} aria-label={closeLabel} data-testid={`${testId}-close`}>
          <Icons.X size={cssVars.iconSizes.md} />
        </button>
      </div>
      {subtitle !== undefined && <p style={subtitleStyle}>{subtitle}</p>}
    </div>
  );
  const footer = (
    <DialogActions
      secondary={[{ label: cancelLabel, onClick: onCancel, 'data-testid': `${testId}-cancel` }]}
      primary={{ label: saveLabel, onClick: onSave, disabled: saveDisabled, 'data-testid': `${testId}-save` }}
    />
  );
  return (
    <DialogSurface
      isOpen
      onClose={onCancel}
      closeOnBackdropClick={false}
      placement="center"
      maxWidth={dialogWidths.md}
      labelledBy={titleId}
      initialFocusRef={initialFocusRef}
      testId={testId}
      header={header}
      footer={footer}
    >
      <div style={bodyStyle}>
        {notice}
        <div style={gridStyle} role="group" aria-labelledby={titleId}>
          <span style={headingCellStyle}>{teamHeading}</span>
          <span style={{ ...headingCellStyle, textAlign: 'center' }}>{goalsHeading}</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          {rows.map((row) => (
            <div key={row.id} style={{ display: 'contents' }}>
              <span style={nameStyle}>{row.name}</span>
              {row.field}
              <button type="button" style={stepStyle} onClick={row.onMinus} aria-label={row.minusLabel} data-testid={row.minusTestId}><Icons.Minus size={cssVars.iconSizes.md} /></button>
              <button type="button" style={stepStyle} onClick={row.onPlus} aria-label={row.plusLabel} data-testid={row.plusTestId}><Icons.Plus size={cssVars.iconSizes.md} /></button>
            </div>
          ))}
        </div>
        {hint}
      </div>
    </DialogSurface>
  );
}
