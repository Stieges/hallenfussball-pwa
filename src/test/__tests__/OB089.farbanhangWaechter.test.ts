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
    grund: 'Karten-Auswahl: keine getönten Karten-Tokens vorhanden, Stelle ausgelassen und gemeldet.',
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

describe('@OB-089 Wächter: kein Farbwert mit angehängter Deckkraft', () => {
  it('@OB-089 Obergrenze 0: in src/ steht kein `${…}22`-Muster außerhalb der begründeten Ausnahmen', () => {
    const verstoesse: string[] = [];
    for (const file of quelldateien(SRC)) {
      const n = zaehleFarbanhang(readFileSync(file, 'utf8'));
      const rel = file.slice(SRC.length + 1);
      const erlaubt = AUSNAHMEN[rel]?.erlaubt ?? 0;
      if (n > erlaubt) { verstoesse.push(`${rel}: ${n} (erlaubt ${erlaubt})`); }
    }
    expect(verstoesse, 'Deckkraft nie an einen Farbwert hängen – getönte Tokens (errorLight, warningLight …) verwenden').toEqual([]);
  });

  it('@OB-089 die Ausnahmen existieren und sind nicht größer als nötig (sie dürfen nur sinken)', () => {
    for (const [rel, a] of Object.entries(AUSNAHMEN)) {
      const n = zaehleFarbanhang(readFileSync(join(SRC, rel), 'utf8'));
      expect(n, `${rel}: ${a.grund}`).toBe(a.erlaubt);
    }
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
