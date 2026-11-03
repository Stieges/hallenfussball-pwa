/**
 * GraphicUploadField – Feld für eine hochladbare Grafik (@W3-030, @W3-040, @DR-040): Vorschau, „Ändern“, „Entfernen“,
 * Warnung, Fehlertext und eine Hinweiszeile („nur auf diesem Gerät“). Reine Darstellung: Dateien prüfen, aufbereiten und
 * speichern macht der Aufrufer, alle Texte kommen von ihm (i18n). Ohne Grafik steht die Taste „hochladen“ samt Formathinweis,
 * mit Grafik „Ändern“ und „Entfernen“. `children` (z. B. die Farbzeile mit dem Tupfer) stehen unter den Tasten, vor der
 * Warnung. Test-IDs: `<Präfix>-feld|-vorschau|-hochladen|-aendern|-entfernen|-datei|-warnung|-fehler|-geraet`.
 */
import { useId, useRef, type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cssVars, componentSizes } from '../../../design-tokens';
import { Button } from '../Button';
import { InlineNotice } from './InlineNotice';

export interface GraphicUploadFieldProps {
  /** Vorsatz der Test-IDs, z. B. `turnierlogo` oder `zweite-grafik`. */
  testIdPrefix: string;
  label: string;
  /** Zusatz hinter der Beschriftung, z. B. „(optional)“. */
  optionalHint: string;
  /** Hinterlegte Grafik als Data-URL; ohne sie zeigt das Feld die Taste „hochladen“. */
  src?: string;
  previewAlt: string;
  uploadLabel: string;
  changeLabel: string;
  removeLabel: string;
  /** Hinweis unter der Taste „hochladen“ (erlaubte Formate und Größe). */
  formatHint: string;
  /** Dateiarten der Auswahl. */
  accept?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
  warning?: string;
  error?: string;
  /** Hinweiszeile am Ende des Felds, z. B. „Nur auf diesem Gerät gespeichert.“ */
  deviceHint?: string;
  /** Die Aufbereitung läuft: Tasten nicht antippbar. */
  busy?: boolean;
  children?: ReactNode;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg';

const labelStyle: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary, marginBottom: cssVars.spacing.xs };
const optionalStyle: CSSProperties = { fontWeight: cssVars.fontWeights.normal, color: cssVars.colors.textMuted };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.md };
const buttonsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm, minWidth: 0 };
// Die Vorschau steht auf weißem Grund wie das Papier, damit ein durchsichtiges Logo so aussieht wie im Druck.
const previewStyle: CSSProperties = {
  width: componentSizes.graphicPreview, height: componentSizes.graphicPreview, objectFit: 'contain', flex: 'none',
  background: cssVars.colors.surfacePaper, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md, padding: cssVars.spacing.xs,
};
const hintStyle: CSSProperties = { margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };
// Schmaler als der Standard-Knopf (Mockup „Stammdaten MVP“): Vorschau, „Ändern“ und „Entfernen“ stehen bei 390 px in einer Zeile.
const buttonStyle: CSSProperties = { padding: `0 ${cssVars.spacing.md}` };
const noticeSlot: CSSProperties = { marginTop: cssVars.spacing.md };
// Hinweistext in Lesegröße wie im Mockup (der Baustein setzt sonst `sm`).
const noticeTextStyle: CSSProperties = { fontSize: cssVars.fontSizes.md };

export function GraphicUploadField({
  testIdPrefix, label, optionalHint, src, previewAlt, uploadLabel, changeLabel, removeLabel, formatHint,
  accept = DEFAULT_ACCEPT, onSelect, onRemove, warning, error, deviceHint, busy = false, children,
}: GraphicUploadFieldProps): ReactElement {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const choose = (): void => inputRef.current?.click();
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ''; // dieselbe Datei lässt sich danach erneut wählen
    if (file !== undefined) { onSelect(file); }
  };

  return (
    <div role="group" aria-labelledby={labelId} data-testid={`${testIdPrefix}-feld`} style={{ marginTop: cssVars.spacing.lg }}>
      <span id={labelId} style={labelStyle}>{label} <span style={optionalStyle}>{optionalHint}</span></span>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} data-testid={`${testIdPrefix}-datei`} style={{ display: 'none' }} />
      {src === undefined ? (
        <>
          <div style={rowStyle}>
            <Button variant="secondary" style={buttonStyle} onClick={choose} busy={busy} data-testid={`${testIdPrefix}-hochladen`}>{uploadLabel}</Button>
          </div>
          <p style={hintStyle}>{formatHint}</p>
        </>
      ) : (
        <div style={rowStyle}>
          <img src={src} alt={previewAlt} data-testid={`${testIdPrefix}-vorschau`} style={previewStyle} />
          <div style={buttonsStyle}>
            <Button variant="secondary" style={buttonStyle} onClick={choose} busy={busy} data-testid={`${testIdPrefix}-aendern`}>{changeLabel}</Button>
            <Button variant="secondary" style={buttonStyle} onClick={onRemove} busy={busy} data-testid={`${testIdPrefix}-entfernen`}>{removeLabel}</Button>
          </div>
        </div>
      )}
      {children}
      {warning !== undefined && <div style={noticeSlot}><InlineNotice tone="warn" data-testid={`${testIdPrefix}-warnung`}><span style={noticeTextStyle}>{warning}</span></InlineNotice></div>}
      {error !== undefined && <div style={noticeSlot}><InlineNotice tone="error" data-testid={`${testIdPrefix}-fehler`}><span style={noticeTextStyle}>{error}</span></InlineNotice></div>}
      {deviceHint !== undefined && <p style={hintStyle} data-testid={`${testIdPrefix}-geraet`}>{deviceHint}</p>}
    </div>
  );
}
