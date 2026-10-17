/**
 * B-51 Schritt 2 – Die Bedien-Atome zeichnen ihren Rand mit dem Bedien-Rand-Token.
 *
 * @OB-055 (Dialoge) und @OB-057 (jede Seite): Knöpfe und Eingabefelder heben sich mit mindestens 3 : 1 ab.
 * Gemessen wird am gerenderten Rand (`style.border`), dann je Darstellung gegen die Fläche gerechnet,
 * auf der das Atom liegt (Seite = `--color-background`, Dialog = `--color-surface-elevated`).
 * Gegenbeispiel: `Card` behält die Trennlinie `--color-border`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { Card } from '../Card';
import { Input } from '../Input';
import { Select } from '../Select';
import { Combobox } from '../Combobox';
import { NumberStepper } from '../NumberStepper';
import { ScoreStepper } from '../ScoreStepper';
import { ColorPicker } from '../ColorPicker';
import { ChoiceCard } from '../molecules';
import { MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, contrastRatio, over, readThemeTokens, resolveToken, type ThemeName } from '../../../test/contrast';

/** Der Rand-Token, den ein Element im Inline-Stil nennt (`border` oder `border-color`). */
function borderVar(el: HTMLElement): string | null {
  const text = `${el.getAttribute('style') ?? ''}`;
  const m = /border(?:-color)?:[^;]*var\((--color-[a-z-]+)\)/.exec(text);
  return m ? m[1] : null;
}

const noop = vi.fn();
const options = [{ value: 'a', label: 'A' }];

const ATOMS: Array<[string, () => HTMLElement]> = [
  ['Button (secondary)', () => { render(<Button variant="secondary">Zurück</Button>); return screen.getByRole('button'); }],
  ['Input', () => { render(<Input value="" onChange={noop} label="Name" />); return screen.getByRole('textbox'); }],
  ['Select', () => { render(<Select value="a" onChange={noop} options={options} label="Feld" />); return screen.getByRole('combobox'); }],
  ['Combobox', () => { render(<Combobox value="" onChange={noop} options={options} label="Team" />); return screen.getByRole('combobox'); }],
  ['NumberStepper (Eingabe)', () => { render(<NumberStepper value={3} onChange={noop} mode="input" label="Anzahl" />); return screen.getByRole('spinbutton'); }],
  ['ScoreStepper (+ Taste)', () => { render(<ScoreStepper value={1} onChange={noop} teamName="TSV" />); return screen.getAllByRole('button')[0]; }],
  ['ColorPicker (Auslöser)', () => { render(<ColorPicker value="#FF0000" onChange={noop} label="Farbe" />); return screen.getAllByRole('button')[0]; }],
  ['ChoiceCard', () => { render(<ChoiceCard title="Plan" description="Alle Spiele" icon={<span>i</span>} selected={false} onSelect={noop} />); return screen.getByRole('radio'); }],
];

describe('@OB-055 @OB-057 Atome: Rand ist --color-border-control', () => {
  for (const [name, mount] of ATOMS) {
    it(`${name} nutzt var(--color-border-control)`, () => {
      expect(borderVar(mount())).toBe('--color-border-control');
    });
  }

  it('Gegenbeispiel: Card behält die Trennlinie var(--color-border)', () => {
    const { container } = render(<Card>Inhalt</Card>);
    expect(borderVar(container.firstElementChild as HTMLElement)).toBe('--color-border');
  });
});

describe('C-DANGER-KONTRAST: Gefahr-Taste', () => {
  it('Schrift der Gefahr-Taste ist var(--color-on-error), Fläche var(--color-error)', () => {
    render(<Button variant="danger">Löschen</Button>);
    const stil = screen.getByRole('button').getAttribute('style') ?? '';
    expect(stil).toContain('color: var(--color-on-error)');
    expect(stil).toMatch(/background: var\(--color-error\)/);
  });
  for (const theme of ['light', 'dark', 'high-contrast'] as ThemeName[]) {
    it(`Gefahr-Taste ${theme}: Schrift auf Fläche mindestens 4,5 : 1`, () => {
      const tokens = readThemeTokens(theme);
      const schrift = resolveToken(theme, tokens['--color-on-error']);
      const flaeche = resolveToken(theme, tokens['--color-error']);
      expect(contrastRatio(schrift, flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  }
});

describe('@OB-055 @OB-057 Atome: gerechnet je Darstellung gegen die Fläche', () => {
  const themes: ThemeName[] = ['light', 'dark', 'high-contrast'];
  const surfaces = ['--color-background', '--color-surface-elevated'];
  for (const [name, mount] of ATOMS) {
    for (const theme of themes) {
      for (const surface of surfaces) {
        it(`${name}: ${theme} auf ${surface} mindestens 3 : 1`, () => {
          const token = borderVar(mount());
          expect(token).not.toBeNull();
          const tokens = readThemeTokens(theme);
          const bg = resolveToken(theme, tokens['--color-background']);
          const fill = resolveToken(theme, tokens[surface]);
          const flaeche = /^rgba\(/i.test(fill) ? over(fill, bg) : fill;
          const rand = resolveToken(theme, tokens[token!]);
          expect(contrastRatio(rand, flaeche)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
        });
      }
    }
  }
});
