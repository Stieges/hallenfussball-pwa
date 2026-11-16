/**
 * @OB-089 Wächter: keine angehängte Deckkraft an einen Farbwert (Befund C-FEHLERBOX-HINTERGRUND-UNGUELTIG).
 *
 * `${cssVars.colors.error}22` ergibt `var(--color-error)22` – das ist keine Farbe, der Kasten bleibt ohne Hintergrund.
 * Gezählt wird jede Vorlage `${…}` mit zwei angehängten Hex-Ziffern, dazu `colors.x + '22'`, in Quelltext (nicht in Tests).
 * Obergrenze 0; die getönten Stufen heißen `errorLight`, `warningLight`, `primaryMedium` … (siehe design-tokens/cssVars.ts).
 *
 * Ausnahmen (begründet, je Datei höchstens `erlaubt`):
 *  - SponsorManagement: die Rangfarben Gold/Silber/Bronze sind feste Hex-Werte (`#FFD700` …), `#FFD70022` ist dort gültiges CSS; es gibt
 *    dafür keine Tönungs-Tokens. Offene Stelle für ein späteres Token-Paket.
 *  - CardDialog: die Karten-Auswahl (Gelb, Gelb-Rot, Rot) hat keine getönten Karten-Tokens; Stelle ausgelassen und gemeldet, kein Fehlerkasten.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MUSTER_VORLAGE = /\$\{[^}]*\}[0-9a-fA-F]{2}(?![0-9a-zA-Z])/g;
const MUSTER_PLUS = /(?:colors|cssVars)[\w.[\]]*\s*\+\s*['"`][0-9a-fA-F]{2}['"`]/g;

function zaehleFarbanhang(quelltext: string): number {
  const ohneKommentare = quelltext.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return (ohneKommentare.match(MUSTER_VORLAGE)?.length ?? 0) + (ohneKommentare.match(MUSTER_PLUS)?.length ?? 0);
}

const AUSNAHMEN: Record<string, { erlaubt: number; grund: string }> = {
  'features/tournament-management/SponsorManagement.tsx': {
    erlaubt: 2,
    grund: 'Rangfarben Gold/Silber/Bronze sind feste Hex-Werte; die Anhänge sind dort gültiges CSS, Tönungs-Tokens fehlen.',
  },
  'components/live-cockpit/components/Dialogs/CardDialog.tsx': {
    erlaubt: 3,
    grund: 'Karten-Auswahl: keine getönten Karten-Tokens vorhanden, Stelle ausgelassen und gemeldet; toter Code (C-CARDDIALOG-TOT), Aufräumen eingeplant.',
  },
};

const SRC = resolve(process.cwd(), 'src');

function quelldateien(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'test' || name === 'node_modules') { continue; }
      out.push(...quelldateien(full));
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\.|\.spec\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

type Ausnahmen = Record<string, { erlaubt: number; grund: string }>;

/** Verstöße: nur „mehr als erlaubt“ ist rot. Weniger Treffer oder eine fehlende Datei (Ausnahme behoben, Datei gelöscht) bleibt grün. */
function verstoesse(dateien: Record<string, string>, ausnahmen: Ausnahmen): string[] {
  return Object.entries(dateien).flatMap(([rel, text]) => {
    const n = zaehleFarbanhang(text);
    const erlaubt = ausnahmen[rel]?.erlaubt ?? 0;
    return n > erlaubt ? [`${rel}: ${n} (erlaubt ${erlaubt})`] : [];
  });
}

describe('@OB-089 Wächter: kein Farbwert mit angehängter Deckkraft', () => {
  it('@OB-089 Obergrenze 0: in src/ steht kein `${…}22`-Muster außerhalb der begründeten Ausnahmen', () => {
    const dateien: Record<string, string> = {};
    for (const file of quelldateien(SRC)) { dateien[file.slice(SRC.length + 1)] = readFileSync(file, 'utf8'); }
    expect(verstoesse(dateien, AUSNAHMEN), 'Deckkraft nie an einen Farbwert hängen – getönte Tokens (errorLight, warningLight …) verwenden').toEqual([]);
  });

  it('@OB-089 Ausnahmen dürfen nur sinken: weniger Treffer → grün, fehlende Datei → grün, mehr Treffer → rot', () => {
    const ausnahmen: Ausnahmen = { 'a.tsx': { erlaubt: 2, grund: 'Test' }, 'b.tsx': { erlaubt: 1, grund: 'Test' } };
    const treffer = 'x: `${cssVars.colors.error}22`';
    expect(verstoesse({ 'a.tsx': `${treffer};${treffer}`, 'b.tsx': treffer }, ausnahmen)).toEqual([]); // genau erlaubt
    expect(verstoesse({ 'a.tsx': treffer, 'b.tsx': '' }, ausnahmen)).toEqual([]); // weniger
    expect(verstoesse({ 'a.tsx': treffer }, ausnahmen)).toEqual([]); // b.tsx fehlt (gelöscht)
    expect(verstoesse({ 'a.tsx': `${treffer};${treffer};${treffer}` }, ausnahmen)).toEqual(['a.tsx: 3 (erlaubt 2)']); // mehr
    expect(verstoesse({ 'c.tsx': treffer }, ausnahmen)).toEqual(['c.tsx: 1 (erlaubt 0)']); // neue Datei ohne Ausnahme
  });

  it('@OB-089 Gegenprobe: das Muster erkennt die bekannten Fehlformen und lässt gültige Vorlagen durch', () => {
    expect(zaehleFarbanhang('background: `${cssVars.colors.error}22`')).toBe(1);
    expect(zaehleFarbanhang('border: `1px solid ${cssVars.colors.primary}40`')).toBe(1);
    expect(zaehleFarbanhang("background: cssVars.colors.error + '15'")).toBe(1);
    expect(zaehleFarbanhang('background: cssVars.colors.errorLight')).toBe(0);
    expect(zaehleFarbanhang('padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`')).toBe(0);
    expect(zaehleFarbanhang('width: `${n}px`, height: `${count}x`')).toBe(0);
  });
});
