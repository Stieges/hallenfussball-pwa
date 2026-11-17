/**
 * GraphicUploadField – Feld für eine hochladbare Grafik (@W3-030, @W3-040, @DR-040): Vorschau, „Ändern“, „Entfernen“,
 * Warnung, Fehlertext und eine Hinweiszeile („nur auf diesem Gerät“). Reine Darstellung: Dateien prüfen, aufbereiten und
 * speichern macht der Aufrufer, alle Texte kommen von ihm (i18n). Ohne Grafik steht die Taste „hochladen“ samt Formathinweis,
 * mit Grafik „Ändern“ und „Entfernen“. `children` (z. B. die Farbzeile mit dem Tupfer) stehen unter den Tasten, vor der
 * Warnung. Hineinziehen (@DR-056): eine Datei lässt sich auf das Feld ziehen; sie geht wie die Dateiwahl an `onSelect`,
 * mehrere Dateien oder etwas ohne Datei gehen an `onDropRejected` (der Aufrufer nennt den Grund, die Grafik bleibt).
 * Über dem Feld zeigt ein gestrichelter Rahmen mit `dropHint`, dass man dort ablegen kann. Test-IDs: `<Präfix>-feld|-vorschau|-hochladen|-aendern|-entfernen|-datei|-warnung|-fehler|-geraet|-ablegen`.
 */
import { useId, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactElement, type ReactNode } from 'react';
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
  /** Zeile im Ablege-Zustand, z. B. „Hier ablegen“. Ohne sie nimmt das Feld nichts per Ziehen an. */
  dropHint?: string;
  /** Es wurde nichts Brauchbares abgelegt: mehr als eine Datei oder keine Datei (die hinterlegte Grafik bleibt). */
  onDropRejected?: (reason: 'multiple' | 'none') => void;
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
// Ruhezustand: keine Zusatzstile, das Feld liegt wie zuvor. Ablege-Zustand: gestrichelter Rahmen und getönte Fläche um das Feld herum
// (Outline und Schatten brauchen keinen Platz, es springt nichts).
const dropAreaStyle = (over: boolean): CSSProperties => ({
  marginTop: cssVars.spacing.lg,
  ...(over ? {
    borderRadius: cssVars.borderRadius.md,
    outline: `${cssVars.borderWidth.medium} dashed ${cssVars.colors.primary}`,
    outlineOffset: cssVars.spacing.sm,
    background: cssVars.colors.primarySubtle,
    boxShadow: `0 0 0 ${cssVars.spacing.sm} ${cssVars.colors.primarySubtle}`,
  } : {}),
});
const dropHintStyle: CSSProperties = { margin: `${cssVars.spacing.sm} 0 0`, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.primary };
const noticeSlot: CSSProperties = { marginTop: cssVars.spacing.md };
// Hinweistext in Lesegröße wie im Mockup (der Baustein setzt sonst `sm`).
const noticeTextStyle: CSSProperties = { fontSize: cssVars.fontSizes.md };

export function GraphicUploadField({
  testIdPrefix, label, optionalHint, src, previewAlt, uploadLabel, changeLabel, removeLabel, formatHint,
  accept = DEFAULT_ACCEPT, onSelect, onRemove, warning, error, deviceHint, dropHint, onDropRejected, busy = false, children,
}: GraphicUploadFieldProps): ReactElement {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const choose = (): void => inputRef.current?.click();
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ''; // dieselbe Datei lässt sich danach erneut wählen
    if (file !== undefined) { onSelect(file); }
  };

  // Ziehen über Kindelemente löst dragenter/dragleave mehrfach aus: der Zähler hält den Ablege-Zustand ruhig.
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const droppable = dropHint !== undefined;
  const carriesFiles = (event: DragEvent<HTMLDivElement>): boolean => Array.from(event.dataTransfer.types).includes('Files');
  const handleDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!droppable || !carriesFiles(event)) { return; }
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!droppable || !carriesFiles(event)) { return; }
    event.preventDefault(); // ohne das öffnet der Browser die Datei selbst
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  };
  const handleDragLeave = (): void => {
    if (!droppable) { return; }
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) { setOver(false); }
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!droppable) { return; }
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    if (busy) { return; }
    const files = event.dataTransfer.files;
    if (files.length === 1) { onSelect(files[0]); } else { onDropRejected?.(files.length === 0 ? 'none' : 'multiple'); }
  };

  return (
    <div
      role="group" aria-labelledby={labelId} data-testid={`${testIdPrefix}-feld`} data-drop-over={over ? 'true' : undefined} style={dropAreaStyle(over)}
      onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
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
      {over && <p style={dropHintStyle} data-testid={`${testIdPrefix}-ablegen`}>{dropHint}</p>}
      {deviceHint !== undefined && <p style={hintStyle} data-testid={`${testIdPrefix}-geraet`}>{deviceHint}</p>}
    </div>
  );
}
