/**
 * Dateinamen der PDFs (B-28 C3, C7, C8; @BM-027, Daniel 16.10. G59): `<Titel>_<Art>_<JJJJ-MM-TT>_<HHmm>.pdf`, etwa
 * `Hallencup_Nord_Spielplan_2026-11-14_1507.pdf`. Leerraum und Zeichen, die in Dateinamen nicht erlaubt sind, werden „_“
 * (mehrere hintereinander ein einziges), Umlaute bleiben. Der Stand kommt aus dem übergebenen Zeitpunkt (Ortszeit), nie
 * aus der Uhr: gleicher Eingang, gleicher Name. Der Aushang trägt statt des Stands die Papiergröße. Der Spielplan ohne
 * Ergebnisse trägt den Zusatz „ohne-Ergebnisse“ (@BM-052, Daniel 16.10.), oben im PDF heißen beide Fassungen „Spielplan“.
 */
const FALLBACK_NAME = 'Turnier';

const two = (n: number): string => String(n).padStart(2, '0');

/** Titel als Teil eines Dateinamens: Leerraum, Steuerzeichen und `\ / : * ? " < > |` werden „_“; ohne Rest „Turnier“. */
export function fileSafeTitle(title: string): string {
  const name = title
    .replace(/[\p{Cc}\s\\/:*?"<>|]+/gu, '_')
    .replace(/^[_.]+|[_.]+$/g, '');
  return name === '' ? FALLBACK_NAME : name;
}

/** `Hallencup_Nord_Spielplan_2026-11-14_1507.pdf`; Fassung `blank`: `Hallencup_Nord_Spielplan_ohne-Ergebnisse_2026-11-14_1507.pdf`. */
export function schedulePdfFilename(title: string, now: Date, edition?: 'plan' | 'blank' | 'final'): string {
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const kind = edition === 'blank' ? 'Spielplan_ohne-Ergebnisse' : 'Spielplan';
  return `${fileSafeTitle(title)}_${kind}_${day}_${two(now.getHours())}${two(now.getMinutes())}.pdf`;
}

/** `Hallencup_Nord_Aushang_A4.pdf` (B-28 C7). */
export function noticePdfFilename(title: string): string {
  return `${fileSafeTitle(title)}_Aushang_A4.pdf`;
}
