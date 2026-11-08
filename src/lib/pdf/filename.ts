/**
 * Dateinamen der PDFs (B-28 C3, C7, C8; @BM-027, Daniel 16.10. G59): `<Titel>_<Art>_<JJJJ-MM-TT>_<HHmm>.pdf`, etwa
 * `Hallencup_Nord_Spielplan_2026-11-14_1507.pdf`. Leerraum und Zeichen, die in Dateinamen nicht erlaubt sind, werden „_“
 * (mehrere hintereinander ein einziges), Umlaute bleiben. Der Stand kommt aus dem übergebenen Zeitpunkt (Ortszeit), nie
 * aus der Uhr: gleicher Eingang, gleicher Name. Der Aushang trägt statt des Stands die Papiergröße. Der Spielplan ohne
 * Ergebnisse trägt den Zusatz „ohne-Ergebnisse“ (@BM-052, Daniel 16.10.), oben im PDF heißen beide Fassungen „Spielplan“.
 * Die Art steht in der Sprache des Dokuments (T9, C-PDF-AUSHANG-METADATEN): englisch „Schedule“, „without-results“, „Poster“.
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

/** Art im Dateinamen, übersetzt: „Spielplan“, der Zusatz der Fassung ohne Ergebnisse („ohne-Ergebnisse“) und „Endstand“. */
export interface ScheduleFileKind { plan: string; withoutResults: string; final?: string }

/**
 * `Hallencup_Nord_Spielplan_2026-11-14_1507.pdf`; Fassung `blank`: `Hallencup_Nord_Spielplan_ohne-Ergebnisse_2026-11-14_1507.pdf`;
 * Fassung `final`: `Hallencup_Nord_Endstand_2026-11-14_1740.pdf` (Zeitpunkt = Abschluss, den der Aufrufer übergibt).
 */
export function schedulePdfFilename(title: string, now: Date, kinds: ScheduleFileKind, edition?: 'plan' | 'blank' | 'final'): string {
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const kind = edition === 'blank'
    ? `${fileSafeTitle(kinds.plan)}_${fileSafeTitle(kinds.withoutResults)}`
    : edition === 'final' && kinds.final !== undefined ? fileSafeTitle(kinds.final) : fileSafeTitle(kinds.plan);
  return `${fileSafeTitle(title)}_${kind}_${day}_${two(now.getHours())}${two(now.getMinutes())}.pdf`;
}

/** `Hallencup_Nord_Aushang_A4.pdf` (B-28 C7); `kind` ist die übersetzte Art („Aushang“, englisch „Poster“). */
export function noticePdfFilename(title: string, kind: string): string {
  return `${fileSafeTitle(title)}_${fileSafeTitle(kind)}_A4.pdf`;
}
