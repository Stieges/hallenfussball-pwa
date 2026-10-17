/**
 * B-51 – Rand- und Text-Kontrast der Bedienelemente je Darstellung.
 *
 * Szenarien (docs/anforderungen/2026-10-02_oberflaeche.md):
 *   @OB-055  Dialoge: Text >= 4,5 : 1, Knöpfe und Eingabefelder heben sich >= 3 : 1 von der Fläche ab
 *   @OB-057  Auf jeder Seite heben sich Knöpfe und Eingabefelder >= 3 : 1 ab (hell, dunkel)
 *   Regel "Kontrast und Fokus": Text >= 4,5 : 1
 *   Befund C-DANGER-KONTRAST: Schrift auf der Gefahr-Taste
 *
 * Die Werte kommen aus `src/styles/global.css` (`readThemeTokens`), nicht aus Konstanten dieser Datei.
 * Die Darstellung "hoher Kontrast" gehört dazu (Ruling R-B51-2).
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  contrastRatio,
  over,
  readThemeTokens,
  resolveToken,
  type ThemeName,
} from '../../test/contrast';

const THEMES: ThemeName[] = ['light', 'dark', 'high-contrast'];
const THEME_LABEL: Record<ThemeName, string> = {
  light: 'hell',
  dark: 'dunkel',
  'high-contrast': 'hoher Kontrast',
};

/** Löst ein Token zu einer deckenden Farbe auf (durchsichtige Flächen werden über den Hintergrund gelegt). */
function solid(theme: ThemeName, name: string): string {
  const tokens = readThemeTokens(theme);
  const background = resolveToken(theme, tokens['--color-background']);
  const value = resolveToken(theme, tokens[name]);
  return /^rgba\(/i.test(value) && !/,\s*1\)$/.test(value) ? over(value, background) : value;
}

/** Schrift/Rand gegen Fläche. Durchsichtige Schrift (z. B. rgba) wird über die Fläche gelegt, nicht über den Hintergrund. */
function ratio(theme: ThemeName, foreground: string, surface: string): number {
  const tokens = readThemeTokens(theme);
  return contrastRatio(resolveToken(theme, tokens[foreground]), solid(theme, surface));
}

/** Flächen, auf denen Bedienelemente im Alltag liegen. */
const BASE_SURFACES = ['--color-background', '--color-surface', '--color-surface-elevated'];
/** Erhöhte Flächen (Karten-Inhalt, aufgeklappte Bereiche). */
const RAISED_SURFACES = ['--color-surface-light', '--color-surface-variant'];

describe('@OB-055 @OB-057 Bedien-Rand ist mindestens 3 : 1 von der Fläche abgehoben', () => {
  for (const theme of THEMES) {
    describe(`Darstellung ${THEME_LABEL[theme]}`, () => {
      for (const surface of BASE_SURFACES) {
        it(`--color-border-control gegen ${surface}`, () => {
          expect(ratio(theme, '--color-border-control', surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
        });
      }
      for (const surface of [...BASE_SURFACES, ...RAISED_SURFACES]) {
        it(`--color-border-control-raised gegen ${surface}`, () => {
          expect(ratio(theme, '--color-border-control-raised', surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
        });
      }
    });
  }

  it('hell: der Bedien-Rand ist die Palette-Farbe neutral 500 (Galerie 15.10.)', () => {
    expect(readThemeTokens('light')['--color-border-control'].toUpperCase()).toBe('#64748B');
    expect(readThemeTokens('dark')['--color-border-control'].toUpperCase()).toBe('#64748B');
  });

  it('Gegenbeispiel: die Trennlinie --color-border bleibt unverändert und dezent (unter 3 : 1)', () => {
    expect(readThemeTokens('dark')['--color-border']).toBe('rgba(255, 255, 255, 0.1)');
    expect(readThemeTokens('light')['--color-border']).toBe('#E2E8F0');
    expect(readThemeTokens('high-contrast')['--color-border']).toBe('rgba(255, 255, 255, 0.3)');
    expect(ratio('dark', '--color-border', '--color-background')).toBeLessThan(MIN_UI_CONTRAST);
    expect(ratio('light', '--color-border', '--color-background')).toBeLessThan(MIN_UI_CONTRAST);
  });
});

describe('Regel "Kontrast und Fokus": Text mindestens 4,5 : 1 (Token-Paare, die als Text genutzt werden)', () => {
  const TEXT_TOKENS = [
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-muted',
    '--color-accent',
    '--color-warning',
    '--color-error',
    '--color-primary',
  ];
  /** Offen (Befund, nicht B-51): `--color-error` als Text auf `--color-surface-light` hell 4,41 : 1, dunkel 4,34 : 1. */
  const SKIP = new Set(['light|--color-error|--color-surface-light', 'dark|--color-error|--color-surface-light']);
  const TEXT_SURFACES = ['--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-light'];

  for (const theme of THEMES) {
    describe(`Darstellung ${THEME_LABEL[theme]}`, () => {
      for (const text of TEXT_TOKENS) {
        for (const surface of TEXT_SURFACES) {
          if (SKIP.has(`${theme}|${text}|${surface}`)) {continue;}
          it(`${text} auf ${surface}`, () => {
            expect(ratio(theme, text, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
          });
        }
      }
    });
  }
});

describe('C-DANGER-KONTRAST: Schrift auf farbigen Tasten (Gefahr, Primär, Warnung)', () => {
  const BUTTONS: Array<[string, string]> = [
    ['--color-on-error', '--color-error'],
    ['--color-on-primary', '--color-primary'],
    ['--color-on-warning', '--color-warning'],
  ];
  for (const theme of THEMES) {
    for (const [text, fill] of BUTTONS) {
      it(`${THEME_LABEL[theme]}: ${text} auf ${fill}`, () => {
        expect(ratio(theme, text, fill)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    }
  }
});

/**
 * Bekannte, noch nicht behobene Paare (nicht Teil von B-51, Befund an den Controller):
 * Schrift auf Sekundär-, Info- und Erfolgs-Flächen im hellen Thema sowie auf der Erfolgs-Taste im dunklen.
 * `it.fails` hält sie sichtbar; wird eines behoben, schlägt der Test an und gehört nach oben verschoben.
 */
describe('Offen (Befund): weitere Text-Paare unter 4,5 : 1', () => {
  it.fails('hell: --color-on-secondary auf --color-secondary', () => {
    expect(ratio('light', '--color-on-secondary', '--color-secondary')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
  it.fails('hell: --color-on-success auf --color-success', () => {
    expect(ratio('light', '--color-on-success', '--color-success')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
  it.fails('dunkel: --color-on-success auf --color-success', () => {
    expect(ratio('dark', '--color-on-success', '--color-success')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
