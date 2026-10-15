/**
 * Zähl-Helfer des Architektur-Wächters für Dialoge (B-43b1, @OB-055).
 * Reine Textfunktionen, damit die Erkennung mit Gegenbeispiel-Fixtures
 * getestet werden kann (DialogSurface.guard.test.ts).
 */

/** `role` mit Wert dialog/alertdialog: "…", '…', {'…'}, {"…"}, {`…`}, mit beliebigem Leerraum. */
const ROLE_DIALOG = /role\s*=\s*(?:\{\s*)?["'`](?:dialog|alertdialog)["'`]/;

/** Zeilen Abstand, in dem ein `role` ein `aria-modal` „erklärt“. */
const ROLE_NEARBY = 5;

/** Marker je Zeile: role-Dialog, createPortal, aria-modal ohne role in der Nähe. */
export function countDialogMarkers(source: string): number {
  const lines = source.split('\n');
  const roleLines = lines.flatMap((line, i) => (ROLE_DIALOG.test(line) ? [i] : []));
  let count = 0;
  lines.forEach((line, i) => {
    if (ROLE_DIALOG.test(line) || line.includes('createPortal(')) {
      count += 1;
    } else if (line.includes('aria-modal') && !roleLines.some((j) => Math.abs(i - j) <= ROLE_NEARBY)) {
      count += 1;
    }
  });
  return count;
}

const FIXED = /position\s*:\s*['"]fixed['"]/;
const OVERLAY_COLOR = /colors\.overlay\w*|--color-overlay\w*|rgba\(\s*0\s*,\s*0\s*,\s*0/;
/** Zeilen Abstand, in dem Overlay-Farbe und `position: fixed` zusammengehören. */
const SCRIM_WINDOW = 12;

/** Abdunkelungen: `position: 'fixed'` mit Overlay-Farbe im Umkreis (ein Treffer je fixed-Zeile). */
export function countScrims(source: string): number {
  const lines = source.split('\n');
  let count = 0;
  lines.forEach((line, i) => {
    if (!FIXED.test(line)) {return;}
    const nearby = lines.slice(Math.max(0, i - SCRIM_WINDOW), i + SCRIM_WINDOW + 1);
    if (nearby.some((l) => OVERLAY_COLOR.test(l))) {count += 1;}
  });
  return count;
}
