/**
 * @OB-055 @OB-057 – Architektur-Wächter Bedien-Rand (B-51, Muster B-43a: Zahlen dürfen nur sinken).
 *
 * 1. Kein Bedienelement (Knopf, Eingabefeld, Auswahl, Chip …) zeichnet seinen Rand mit einer Trennlinie
 *    (`colors.border`, `borderDefault`, `borderMedium`, `borderSolid`, `borderSubtle`); es nimmt `colors.borderControl`.
 *    Ausnahmen stehen namentlich in AUSNAHMEN, das Live-Cockpit (R-B51-1) in COCKPIT mit Obergrenze je Datei.
 * 2. Feste Farbwerte (Hex, rgb/rgba) im Rand eines Bedienelements: Obergrenze, darf nur sinken.
 * 3. Die Bedien-Rand-Tokens sind Palette-Töne, keine neuen Farbwerte.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findControlDividerBorders, findControlDividerCss, findLiteralControlBorders } from '../../test/borderGuard';
import { readThemeTokens } from '../../test/contrast';
import { palette } from '../../design-tokens/colors/palette';

const SRC = resolve(process.cwd(), 'src');

function dateien(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      if (name !== '__tests__') {dateien(pfad, out);}
    } else if (/\.tsx?$/.test(name) && !name.includes('.test.')) {
      out.push(pfad);
    }
  }
  return out;
}

function cssModule(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {cssModule(pfad, out);}
    else if (name.endsWith('.module.css')) {out.push(pfad);}
  }
  return out;
}

const cssQuellen = cssModule(SRC).map((pfad) => ({ rel: pfad.slice(SRC.length + 1), text: readFileSync(pfad, 'utf8') }));

const quellen = dateien(SRC).map((pfad) => ({ rel: pfad.slice(SRC.length + 1), text: readFileSync(pfad, 'utf8') }));

/**
 * Live-Cockpit (R-B51-1): `LiveCockpit.tsx` ist gesperrt, das Cockpit wird neu gebaut. Die Inline-Ränder
 * übernimmt die Cockpit-Scheibe 2/3 mit `borderControl`. Obergrenze je Datei, darf nur sinken.
 */
const COCKPIT: Record<string, number> = {
  'components/live-cockpit/components/Dialogs/CardDialog.tsx': 4,
  'components/live-cockpit/components/Dialogs/EventEditDialog.tsx': 1,
  'components/live-cockpit/components/Dialogs/EventNumberField.tsx': 1,
  'components/live-cockpit/components/Dialogs/GoalScorerDialog.tsx': 4,
  'components/live-cockpit/components/Dialogs/SubstitutionDialog.tsx': 4,
  'components/live-cockpit/components/Dialogs/TimeAdjustDialog.tsx': 1,
  'components/live-cockpit/components/GameControls/index.tsx': 1,
  'components/live-cockpit/components/Tiebreaker/PenaltyShootoutDialog.tsx': 2,
};

/** Begründete Ausnahmen außerhalb des Cockpits: Treffer, die kein Bedien-Rand sind. */
const AUSNAHMEN: Record<string, { erlaubt: number; grund: string }> = {
  'features/schedule-editor/components/DraggableMatch.tsx': {
    erlaubt: 1,
    grund: 'Auswahlrahmen einer ziehbaren Karte (Karte, kein Knopf); gewählt = Akzentfarbe, sonst Kartenrand.',
  },
  'features/tournament-creation/Step1_SportAndType.tsx': {
    erlaubt: 1,
    grund: 'Hover-Rand der Wahlkarten (ruhender Rand ist transparent, die Karte hebt sich über ihre Füllfläche ab).',
  },
  'features/tournament-creation/components/SportSelector.tsx': {
    erlaubt: 1,
    grund: 'Hover-Rand der Sportarten-Karten (ruhender Rand ist transparent, die Karte hebt sich über ihre Füllfläche ab).',
  },
};

/** Stand nach B-51: feste Farbwerte in Bedien-Rändern. Darf nur sinken. */
const OBERGRENZE_FESTE_FARBEN = 3;

function istCockpit(rel: string): boolean {
  return rel.startsWith('components/live-cockpit/') || rel.startsWith('components/match-cockpit/');
}

describe('@OB-055 @OB-057 Wächter: Bedienelemente nutzen borderControl', () => {
  it('außerhalb des Cockpits trägt kein Bedienelement eine Trennlinie als Rand (außer begründeten Ausnahmen)', () => {
    const verstoesse: string[] = [];
    for (const q of quellen) {
      if (istCockpit(q.rel)) {continue;}
      const treffer = findControlDividerBorders(q.text);
      const erlaubt = AUSNAHMEN[q.rel]?.erlaubt ?? 0;
      if (treffer.length > erlaubt) {
        verstoesse.push(`${q.rel}: ${treffer.length} > ${erlaubt} (${treffer.map((t) => t.line).join(', ')})`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it('CSS-Module: keine Bedien-Klasse mit Trennlinie als Rand', () => {
    const verstoesse = cssQuellen.flatMap((q) => findControlDividerCss(q.text).map((h) => `${q.rel}:${h.line} ${h.head}`));
    expect(verstoesse).toEqual([]);
  });

  it('Cockpit (R-B51-1): Obergrenze je Datei, darf nur sinken', () => {
    const verstoesse: string[] = [];
    for (const q of quellen) {
      if (!istCockpit(q.rel)) {continue;}
      const anzahl = findControlDividerBorders(q.text).length;
      const erlaubt = COCKPIT[q.rel] ?? 0;
      if (anzahl > erlaubt) {verstoesse.push(`${q.rel}: ${anzahl} > ${erlaubt}`);}
    }
    expect(verstoesse).toEqual([]);
  });

  it('jede Ausnahme und jeder Cockpit-Eintrag existiert und braucht einen Treffer (keine toten Einträge)', () => {
    const rels = new Set(quellen.map((q) => q.rel));
    for (const rel of [...Object.keys(COCKPIT), ...Object.keys(AUSNAHMEN)]) {
      expect(rels.has(rel), `${rel} fehlt`).toBe(true);
      const q = quellen.find((x) => x.rel === rel);
      expect(findControlDividerBorders(q?.text ?? '').length, `${rel}: Eintrag ohne Treffer, bitte entfernen`).toBeGreaterThan(0);
    }
  });

  it('feste Farbwerte im Rand eines Bedienelements: Obergrenze, darf nur sinken', () => {
    const anzahl = quellen.reduce((summe, q) => summe + findLiteralControlBorders(q.text).length, 0);
    expect(anzahl).toBeLessThanOrEqual(OBERGRENZE_FESTE_FARBEN);
  });

  it('die Bedien-Rand-Tokens sind Palette-Töne (neutral 500 / neutral 300), kein neuer Farbwert', () => {
    expect(readThemeTokens('dark')['--color-border-control'].toUpperCase()).toBe(palette.neutral[500].toUpperCase());
    expect(readThemeTokens('light')['--color-border-control'].toUpperCase()).toBe(palette.neutral[500].toUpperCase());
    expect(readThemeTokens('dark')['--color-border-control-raised'].toUpperCase()).toBe(palette.neutral[300].toUpperCase());
  });
});

describe('Wächter: Erkennung mit Gegenbeispielen', () => {
  it('erkennt ein Eingabefeld mit Trennlinie', () => {
    const text = ['const inputStyle: CSSProperties = {', '  border: `1px solid ${cssVars.colors.border}`,', '};'].join('\n');
    expect(findControlDividerBorders(text)).toHaveLength(1);
  });
  it('erkennt einen Knopf im Inline-Stil', () => {
    const text = ['<button', '  type="button"', '  style={{', '    border: `1px solid ${cssVars.colors.border}`,', '  }}', '>'].join('\n');
    expect(findControlDividerBorders(text)).toHaveLength(1);
  });
  it('Gegenbeispiel: eine Karte mit Trennlinie ist erlaubt', () => {
    const text = ['const cardStyle: CSSProperties = {', '  border: `1px solid ${cssVars.colors.border}`,', '};'].join('\n');
    expect(findControlDividerBorders(text)).toHaveLength(0);
  });
  it('Gegenbeispiel: borderControl am Eingabefeld ist erlaubt', () => {
    const text = ['const inputStyle: CSSProperties = {', '  border: `1px solid ${cssVars.colors.borderControl}`,', '};'].join('\n');
    expect(findControlDividerBorders(text)).toHaveLength(0);
  });
  it('CSS-Modul: erkennt .groupSelect mit var(--color-border), Karte bleibt erlaubt', () => {
    expect(findControlDividerCss('.groupSelect {\n  border: 1px solid var(--color-border);\n}')).toHaveLength(1);
    expect(findControlDividerCss('.card {\n  border: 1px solid var(--color-border);\n}')).toHaveLength(0);
    expect(findControlDividerCss('.groupSelect {\n  border: 1px solid var(--color-border-control);\n}')).toHaveLength(0);
  });
  it('erkennt einen festen Farbwert im Rand eines Knopfs', () => {
    const text = ['const buttonStyle: CSSProperties = {', "  border: '1px solid #64748B',", '};'].join('\n');
    expect(findLiteralControlBorders(text)).toHaveLength(1);
  });
});
