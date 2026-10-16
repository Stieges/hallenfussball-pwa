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
  'gemeldet', 'angezeigt',
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
  'Mannschaften', 'Spielstände', 'Spielplan',
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

/** Zeilennummer (1-basiert) zu einer Zeichenposition im Quelltext. */
function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) {line++;}
  }
  return line;
}

/** Attributwerte, die kein Anzeigetext sind (Test-IDs, CSS-Klassen, Daten-Attribute). */
const TECHNISCHE_ATTRIBUTE =
  /\b(data-[\w-]+|className)=("[^"]*"|'[^']*'|\{[^}\n]*\})/g;

export interface ScanOptionen {
  /** Ob die Datei JSX enthält (.tsx). Nur dann wird Text nach `}` als JSX-Text gewertet. */
  tsx?: boolean;
}

/**
 * Findet deutsche Anzeige-Kandidaten in einem Quelltext.
 * - JSX-Text: Text zwischen `>` bzw. `}` und `<`/`{`, über Zeilenumbrüche hinweg (`>`), bei `}`
 *   nur einzeilig und nur in .tsx (Text nach einem `{Ausdruck}`).
 * - String-Literale zeilenweise, inkl. Attributwerte wie aria-label.
 * - Technische Attributwerte (data-…, className) werden ausgeblendet, nicht ganze Zeilen.
 */
export function findGermanLiterals(source: string, optionen: ScanOptionen = {}): Finding[] {
  const tsx = optionen.tsx ?? true;
  const findings: Finding[] = [];
  const stripped = stripComments(source).replace(TECHNISCHE_ATTRIBUTE, (m) => ' '.repeat(m.length));
  const lines = stripped.split('\n');

  const pruefeJsx = (text: string, index: number): void => {
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text)) {return;}
    if (/[;),(=:]\s*$/.test(text)) {return;}
    const lineNo = lineOf(stripped, index);
    const lineText = lines[lineNo - 1] ?? '';
    if (/^\s*import\s|\brequire\(|\bimport\(/.test(lineText)) {return;}
    if (isGermanDisplayText(text)) {findings.push({ line: lineNo, kind: 'jsx', text: text.trim() });}
  };

  // `>` schließt ein Tag bzw. Attribut. `=>` (Pfeil) und Generics ergeben keinen Text davor.
  const gtRx = />([^<>{}]*)(?=<|\{)/g;
  let jm: RegExpExecArray | null;
  while ((jm = gtRx.exec(stripped)) !== null) {
    const before = stripped[jm.index - 1];
    if (before === '=' || before === '-') {continue;}
    pruefeJsx(jm[1], jm.index);
  }

  // `}` schließt einen {Ausdruck}; danach folgender Text (nur einzeilig, nur .tsx).
  if (tsx) {
    const klammerRx = /\}([^<>{}\n]*)(?=\s*(?:<|\{))/g;
    while ((jm = klammerRx.exec(stripped)) !== null) {
      pruefeJsx(jm[1], jm.index);
    }
  }

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (/^\s*import\s|^\s*export\s+(\*|\{[^}]*\})\s+from\s|\brequire\(|\bimport\(/.test(line)) {return;}
    if (/console\.|captureFeatureError/.test(line)) {return;}

    // String-Literale ('…', "…", `…` mit ${…} als Platzhalter).
    const litRx = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;
    let m: RegExpExecArray | null;
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
/** MS1: Die Kürzungsliste des Monitors (Record Zuschauer und Monitor, „Teamnamen am Monitor“) steht deutsch im Code. */
const VEREINSWORT_GRUND =
  'Datenabgleich, kein Anzeigetext: Das Vereinswort wird im (deutschen) Teamnamen aus den Turnierdaten gesucht ' +
  'und durch sein Kürzel ersetzt (MS1, @ZM-087, @ZM-149). Übersetzen würde den Abgleich brechen.';

const EXCEPTIONS: { file: string; text: string; reason: string }[] = [
  {
    file: 'features/monitor-display/monitorMatch.ts',
    text: 'Schiedsrichter {}',
    reason:
      'Datenabgleich, kein Anzeigetext: Der Schiedsrichter-Name wird gegen den (deutschen) Teamnamen ' +
      'aus den Turnierdaten gesucht. Übersetzen würde den Abgleich in der EN-Oberfläche brechen.',
  },  {
    file: 'features/monitor-display/teamNameAbbrev.ts',
    text: 'Verein für Bewegungsspiele',
    reason: VEREINSWORT_GRUND,
  },
  {
    file: 'features/monitor-display/teamNameAbbrev.ts',
    text: 'Turn- und Sportverein',
    reason: VEREINSWORT_GRUND,
  },
  {
    file: 'features/monitor-display/teamNameAbbrev.ts',
    text: 'Fußballsportverein',
    reason: VEREINSWORT_GRUND,
  },
  {
    file: 'features/monitor-display/teamNameAbbrev.ts',
    text: 'Fußballfreunde',
    reason: VEREINSWORT_GRUND,
  },
  {
    file: 'features/monitor-display/teamNameAbbrev.ts',
    text: 'Fußballclub',
    reason: VEREINSWORT_GRUND,
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
    // Fixrunde 1 (Opus-M2/M2b): Text in derselben Zeile wie data-testid und Text nach {Ausdruck}
    expect(findGermanLiterals('<span data-testid="x">Zur Startseite</span>')).toHaveLength(1);
    expect(findGermanLiterals('<p>{n} Mannschaften gemeldet</p>')).toHaveLength(1);
    expect(findGermanLiterals('<p>\n  {n} Mannschaften gemeldet\n</p>')).toHaveLength(1);
    expect(findGermanLiterals('<p>{n} Mannschaften gemeldet</p>', { tsx: false })).toHaveLength(0);
    expect(findGermanLiterals('<span aria-label="Zurück zur Übersicht">x</span>')).toHaveLength(1);
    // Mehrzeiliger JSX-Text (Text auf eigener Zeile, wie in der Mutationsprobe B-41 gefunden)
    expect(findGermanLiterals('<Button>\n  Zur Startseite\n</Button>')).toHaveLength(1);
  });

  it('keine deutschen Literale in den Scan-Ordnern (30 s Zeitlimit)', () => {
    const files = scanTargets();
    expect(files.length).toBeGreaterThan(40);

    const found: { file: string; line: number; kind: string; text: string }[] = [];
    for (const abs of files) {
      const rel = relative(SRC_ROOT, abs);
      for (const f of findGermanLiterals(readFileSync(abs, 'utf8'), { tsx: abs.endsWith('.tsx') })) {
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
