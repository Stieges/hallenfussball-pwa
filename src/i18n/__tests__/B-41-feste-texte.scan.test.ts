/**
 * B-41 — Quelltext-Scan: Keine festen deutschen Anzeigetexte mehr in
 * `src/features/public-view/**`, `src/screens/LiveViewScreen.tsx` und
 * `src/features/monitor-display/**`.
 *
 * Gefunden werden deutsche Literale in JSX-Text und String-Literalen
 * (Umlaute/ß, typische deutsche Wörter, Großbuchstaben-Satzanfang mit
 * mehreren Wörtern). Texte gehören in `src/i18n/locales/**`, Aufruf per `t()`.
 *
 * Ausnahmen stehen unten einzeln mit Begründung; jede Ausnahme muss tatsächlich
 * einen Fund treffen (sonst meldet der Test eine veraltete Ausnahme).
 *
 * Gegenbeispiel: Der Detektor selbst wird an Beispielzeilen geprüft, damit der
 * Scan nicht leer laufen kann.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCAN_DIRS = ['features/public-view', 'features/monitor-display'];
const SCAN_FILES = ['screens/LiveViewScreen.tsx'];

/** Typische deutsche Funktionswörter (Kleinschreibung, Wortgrenzen mit Umlaut-Zeichenklasse). */
const DE_FUNCTION_WORDS = [
  'der', 'die', 'das', 'und', 'oder', 'nicht', 'ist', 'sind', 'wird', 'werden', 'ein', 'eine',
  'einen', 'auf', 'mit', 'für', 'von', 'zum', 'zur', 'dem', 'den', 'kein', 'keine', 'mein', 'dein',
  'alle', 'noch', 'wähle', 'läuft', 'bis', 'wurde',
];
/** Typische deutsche Substantive/Verben in Anzeigetexten (Großschreibung wie im Satzanfang). */
const DE_NOUNS = [
  'Turnier', 'Spiel', 'Spiele', 'Gruppe', 'Gruppen', 'Feld', 'Tabelle', 'Tabellen', 'Ergebnis',
  'Ergebnisse', 'Sponsor', 'Datum', 'Ort', 'Phase', 'Zurück', 'Fehler', 'Lade', 'Warte', 'Schau',
  'Scan', 'Zeit', 'Verbindung', 'Organisator', 'Bildschirm', 'Vollbild', 'Startseite', 'Erneut',
  'Loslassen', 'Schiedsrichter', 'Stand', 'Beendet', 'Geplant', 'Finalrunde', 'Alle', 'Kein',
  'Keine', 'Nicht', 'Nächstes', 'Nächste', 'Bitte', 'Mein', 'Erstellt', 'Konfiguration', 'Erneut',
  'Darstellung', 'Ausgeblendet', 'Ausgewählt', 'Nur', 'Bambini', 'Hallenfußball', 'Hallenfussball',
];

const UMLAUT_OR_SZ = /[äöüÄÖÜß]/;
const WORD = (w: string) => new RegExp(`(?<![A-Za-zÀ-ÖØ-öø-ÿ0-9_])${w}(?![A-Za-zÀ-ÖØ-öø-ÿ0-9_])`, 'u');
const FUNCTION_WORD_RX = DE_FUNCTION_WORDS.map(WORD);
const NOUN_RX = DE_NOUNS.map(WORD);

/** Prüft einen Text (Literal oder JSX-Text) auf deutsche Anzeige-Sprache. */
export function isGermanDisplayText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed)) {return false;}
  if (UMLAUT_OR_SZ.test(trimmed)) {return true;}
  if (NOUN_RX.some((rx) => rx.test(trimmed))) {return true;}
  if (FUNCTION_WORD_RX.some((rx) => rx.test(trimmed))) {return true;}
  return false;
}

/** Entfernt Kommentare grob (zeilenweise; `://` in URLs bleibt erhalten). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, '$1'))
    .join('\n');
}

export interface Finding {
  line: number;
  kind: 'jsx' | 'literal';
  text: string;
}

/** Findet deutsche Anzeige-Kandidaten in einem Quelltext. */
export function findGermanLiterals(source: string): Finding[] {
  const findings: Finding[] = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((rawLine, idx) => {
    const line = rawLine;
    const lineNo = idx + 1;
    if (/^\s*import\s|^\s*export\s+(\*|\{[^}]*\})\s+from\s|\brequire\(|\bimport\(/.test(line)) {return;}
    if (/console\.|captureFeatureError|data-testid|\bclassName=|\bdata-/.test(line)) {return;}

    // JSX-Text: `>Text<` bzw. `>Text{` – ein `>` nach Attribut/Tag, kein `=>` und kein Generic.
    const jsxRx = /(?<![=<-])>\s*([^<>{}\n]*[A-Za-zÀ-ÖØ-öø-ÿ][^<>{}\n]*?)\s*(?=<|\{|$)/g;
    let m: RegExpExecArray | null;
    while ((m = jsxRx.exec(line)) !== null) {
      const text = m[1];
      if (isGermanDisplayText(text)) {findings.push({ line: lineNo, kind: 'jsx', text });}
    }

    // String-Literale ('…', "…", `…` mit ${…} als Platzhalter).
    const litRx = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;
    while ((m = litRx.exec(line)) !== null) {
      const raw = m[1] ?? m[2] ?? m[3] ?? '';
      const text = raw.replace(/\$\{[^}]*\}/g, '{}');
      if (isGermanDisplayText(text)) {findings.push({ line: lineNo, kind: 'literal', text });}
    }
  });
  return findings;
}

function collectFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') {continue;}
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function scanTargets(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) {collectFiles(join(SRC_ROOT, d), files);}
  for (const f of SCAN_FILES) {files.push(join(SRC_ROOT, f));}
  return files.sort();
}

/**
 * Ausnahmen (bewusst fest, begründet). Jede Zeile trifft einen Fund; sonst Fehler.
 */
const EXCEPTIONS: { file: string; text: string; reason: string }[] = [
  {
    file: 'features/monitor-display/monitorMatch.ts',
    text: 'Schiedsrichter {}',
    reason:
      'Datenabgleich, kein Anzeigetext: Der Schiedsrichter-Name wird gegen den (deutschen) Teamnamen ' +
      'aus den Turnierdaten gesucht. Übersetzen würde den Abgleich in der EN-Oberfläche brechen.',
  },
];

describe('B-41 Quelltext-Scan: keine festen deutschen Texte auf Zuschauer-Seite und Monitor', () => {
  it('Detektor erkennt deutsche Anzeigetexte und ignoriert t()-Aufrufe (Gegenbeispiele)', () => {
    expect(findGermanLiterals('<p>Turnier wird geladen...</p>')).toHaveLength(1);
    expect(findGermanLiterals("const x = 'Zur Startseite';")).toHaveLength(1);
    expect(findGermanLiterals("<h2>{t('notFound.title')}</h2>")).toHaveLength(0);
    expect(findGermanLiterals("const k = 'groupStage'; const s = 'live';")).toHaveLength(0);
    expect(findGermanLiterals("fetch('https://example.org/api')")).toHaveLength(0);
    expect(findGermanLiterals('// Kommentar: Turnier wird geladen')).toHaveLength(0);
  });

  it('keine deutschen Literale in den Scan-Ordnern (30 s Zeitlimit)', () => {
    const files = scanTargets();
    expect(files.length).toBeGreaterThan(40);

    const found: { file: string; line: number; kind: string; text: string }[] = [];
    for (const abs of files) {
      const rel = relative(SRC_ROOT, abs);
      for (const f of findGermanLiterals(readFileSync(abs, 'utf8'))) {
        found.push({ file: rel, line: f.line, kind: f.kind, text: f.text.trim() });
      }
    }

    const matchedExceptions = new Set<number>();
    const unexcused = found.filter((f) => {
      const idx = EXCEPTIONS.findIndex((e) => e.file === f.file && e.text === f.text);
      if (idx >= 0) {
        matchedExceptions.add(idx);
        return false;
      }
      return true;
    });

    expect(unexcused).toEqual([]);
    expect(EXCEPTIONS.filter((_, i) => !matchedExceptions.has(i))).toEqual([]);
  }, 30_000);
});
