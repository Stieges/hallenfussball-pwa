/**
 * Aufgabe 2.2 (Spielanzeige): Molekül `ScoreBox` – Ergebniskasten mit Weste, Ring, Ecken und Ziffernkontrast.
 * Werte aus dem Gherkin: @ZM-140, @ZM-156, @ZM-160, @ZM-161, @ZM-151 (Kastengröße in jedem Zustand gleich), @OB-067 (800),
 * RF3 (zweistelliger Stand), RF5 (weißer Kasten auf hellem Grund, Ring).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BOX_BLACK, BOX_WHITE, type BoxFill } from '../../../../core/models/scoreBoxColors';
import { borderWidths, cssVars, displayLayout, monitorThemes } from '../../../../design-tokens';
import { mixHex } from '../../../../design-tokens/displayColor';
import { ScoreBox, type ScoreBoxProps } from '../ScoreBox';
import { LOSER_DIM_SHARE, pairFrameStrength } from '../scoreBoxStyle';

const solid = (color: string): BoxFill => ({ kind: 'solid', color });
const vest = (center: string, stripes: string): BoxFill => ({ kind: 'vest', center, stripes });

const DUNKEL = monitorThemes.dark.background;
const HELL = '#FFFFFF';
const TEXT_HELL = '#FFFFFF';
const TEXT_DUNKEL = '#171717';
const GELB = '#FACC15';
const ROT = '#C62828';
const BLAU = '#1565C0';
const SIZES: ReadonlyArray<ScoreBoxProps['size']> = ['display', 'row', 'compact'];

function props(over: Partial<ScoreBoxProps> = {}): ScoreBoxProps {
  return { score: 2, fill: solid(ROT), size: 'compact', background: DUNKEL, textColor: TEXT_HELL, ariaLabel: 'FC Nord: 2', testId: 'box', ...over };
}

function draw(over: Partial<ScoreBoxProps> = {}): HTMLElement {
  render(<ScoreBox {...props(over)} />);
  return screen.getByTestId(over.testId ?? 'box');
}

/** `#RRGGBB` → `rgb(r, g, b)`, wie jsdom Farben ausgibt. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Maße, die der Zustand nie ändern darf (@ZM-151). */
function dimensions(el: HTMLElement): Record<string, string> {
  const s = el.style;
  return {
    width: s.width, height: s.height, minWidth: s.minWidth, minHeight: s.minHeight, maxWidth: s.maxWidth, maxHeight: s.maxHeight,
    padding: s.padding, margin: s.margin, boxSizing: s.boxSizing, fontSize: s.fontSize, flex: s.flex,
  };
}

describe('ScoreBox Grundform und DOM-Vertrag', () => {
  it('@ZM-160 Ziffer in einem Kasten in der getragenen Farbe: Wurzel mit data-Attributen, Ziffer im Kind', () => {
    const el = draw({ score: 3, fill: solid(ROT) });
    expect(el).toHaveAttribute('data-fill', 'solid');
    expect(el).toHaveAttribute('data-color', ROT);
    expect(el).not.toHaveAttribute('data-stripes');
    expect(el).toHaveAttribute('data-digit-color', BOX_WHITE);
    expect(el.style.backgroundColor).toBe(rgb(ROT));
    expect(screen.getByTestId('box-digits')).toHaveTextContent('3');
  });

  it('der Kasten ist ein Bild mit zugänglichem Namen', () => {
    const el = draw({ ariaLabel: 'Stand FC Nord: 2' });
    expect(el).toHaveAttribute('role', 'img');
    expect(el).toHaveAttribute('aria-label', 'Stand FC Nord: 2');
  });

  it('Kindermodus: score null zeigt keine Ziffer, der Kasten bleibt', () => {
    const el = draw({ score: null });
    expect(screen.queryByTestId('box-digits')).toBeNull();
    expect(el.style.backgroundColor).toBe(rgb(ROT));
  });

  it('@OB-067:teil Ziffern im Kasten 800 (extrabold), gleich breite Ziffern', () => {
    draw();
    const digits = screen.getByTestId('box-digits');
    expect(digits.style.fontWeight).toBe(cssVars.fontWeights.extrabold);
    expect(digits.style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('@OB-067:teil das Token extrabold ist 800', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toMatch(/--font-weight-extrabold:\s*800;/);
  });
});

describe('ScoreBox Weste (@ZM-161)', () => {
  it('@ZM-161 Weste: Ziffer auf Gelb, Streifen links und rechts in Rot (je 14 %), Leibchen-Zeichen oben links', () => {
    const el = draw({ fill: vest(GELB, ROT), bib: true, background: HELL, textColor: TEXT_DUNKEL });
    const share = Math.round(displayLayout.scoreArea.vestStripeShare * 100 * 1000) / 1000;
    expect(share).toBe(14);
    expect(el).toHaveAttribute('data-fill', 'vest');
    expect(el).toHaveAttribute('data-color', GELB);
    expect(el).toHaveAttribute('data-stripes', ROT);
    const bild = el.style.backgroundImage;
    expect(bild).toContain('linear-gradient');
    expect(bild).toContain(`${share}%`);
    expect(bild).toContain(`${100 - share}%`);
    expect(bild).not.toMatch(/\d\.\d{4,}%/); // keine Gleitkomma-Reste im CSS
    expect(bild.indexOf(rgb(ROT))).toBeGreaterThanOrEqual(0);
    expect(bild.indexOf(rgb(GELB))).toBeGreaterThanOrEqual(0);
    // Gelb in der Mitte → schwarze Ziffer (Kontrast auf der Mitte, nicht auf dem Streifen)
    expect(el).toHaveAttribute('data-digit-color', BOX_BLACK);
    const bib = screen.getByTestId('box-bib');
    expect(bib.style.position).toBe('absolute');
    expect(bib.style.left).toMatch(/^calc\(-|^-/);
    expect(bib.style.top).toMatch(/^calc\(-|^-/);
  });

  it('@ZM-161 Gegenbeispiel: ohne bib kein Leibchen-Zeichen, Fläche ohne Streifen', () => {
    const el = draw({ fill: solid(BOX_WHITE), bib: false, background: HELL, textColor: TEXT_DUNKEL });
    expect(screen.queryByTestId('box-bib')).toBeNull();
    expect(el).not.toHaveAttribute('data-stripes');
    expect(el.style.backgroundImage).toBe('');
  });

  it('@ZM-154 Leibchen-Zeichen auch ohne Weste (Teamfarben aus): Zeichen ja, Streifen nein', () => {
    const el = draw({ fill: solid(BLAU), bib: true });
    expect(screen.getByTestId('box-bib')).toBeInTheDocument();
    expect(el).toHaveAttribute('data-fill', 'solid');
  });
});

describe('ScoreBox Ring und Pokal (@ZM-156)', () => {
  it('@ZM-156 Sieger: Ring als outline, Kastenmaße mit und ohne Ring gleich', () => {
    render(<ScoreBox {...props({ testId: 'ohne' })} />);
    render(<ScoreBox {...props({ testId: 'mit', outcome: 'winner', ringColor: '#00E676' })} />);
    const mit = screen.getByTestId('mit');
    expect(mit.style.outlineStyle).toBe('solid');
    expect(mit.style.outlineColor).toBe(rgb('#00E676'));
    expect(mit.style.outlineWidth).not.toBe('');
    expect(dimensions(mit)).toEqual(dimensions(screen.getByTestId('ohne')));
    expect(mit.style.borderWidth).toBe(screen.getByTestId('ohne').style.borderWidth);
  });

  it('@ZM-156 Gegenbeispiel: nur der Sieger trägt den Ring, Verlierer und ohne Ergebnis nicht', () => {
    render(<ScoreBox {...props({ testId: 'v', outcome: 'loser', ringColor: '#00E676' })} />);
    render(<ScoreBox {...props({ testId: 'n', ringColor: '#00E676' })} />);
    expect(screen.getByTestId('v').style.outlineStyle).toBe('');
    expect(screen.getByTestId('n').style.outlineStyle).toBe('');
    expect(screen.getByTestId('v')).toHaveAttribute('data-outcome', 'loser');
  });

  it('@ZM-156 Ring und Pokal nie in Gold: ohne ringColor die Hauptfarbe der App, der Pokal trägt die Ringfarbe', () => {
    const el = draw({ outcome: 'winner', cup: true });
    expect(el.style.outlineColor).toBe(cssVars.colors.primary);
    expect(screen.getByTestId('box-cup').style.backgroundColor).toBe(cssVars.colors.primary);
    const css = [el.getAttribute('style'), screen.getByTestId('box-cup').getAttribute('style')].join(' ').toLowerCase();
    expect(css).not.toMatch(/gold|#ffd700|#ffc107|#facc15|#fde047/);
  });

  it('@ZM-156 der Pokal sitzt mit ringColor und Hintergrund als Symbolfarbe an der Ecke oben rechts', () => {
    draw({ outcome: 'winner', cup: true, ringColor: '#00E676', background: DUNKEL });
    const cup = screen.getByTestId('box-cup');
    expect(cup.style.backgroundColor).toBe(rgb('#00E676'));
    expect(cup.style.color).toBe(rgb(DUNKEL));
    expect(cup.style.right).toMatch(/^calc\(-|^-/);
    expect(cup.style.top).toMatch(/^calc\(-|^-/);
  });

  it('@ZM-156 Gegenbeispiel: ohne cup kein Pokal, auch wenn der Kasten den Ring trägt (Gruppenspiel)', () => {
    draw({ outcome: 'winner', cup: false });
    expect(screen.queryByTestId('box-cup')).toBeNull();
  });
});

describe('ScoreBox Verlierer (@ZM-156)', () => {
  it('@ZM-156 Verlierer behält den Farbton: Fläche = mixHex(Farbe, Hintergrund, LOSER_DIM_SHARE), Ziffern schwarz auf hellem Grund', () => {
    const el = draw({ fill: solid(BLAU), outcome: 'loser', background: HELL, textColor: TEXT_DUNKEL });
    expect(el.style.backgroundColor).toBe(rgb(mixHex(BLAU, HELL, LOSER_DIM_SHARE)));
    expect(el).toHaveAttribute('data-color', BLAU);
    expect(el).toHaveAttribute('data-outcome', 'loser');
    expect(el).toHaveAttribute('data-digit-color', BOX_BLACK);
  });

  it('@ZM-156 Gegenbeispiel: Sieger bleibt ungedämpft mit weißen Ziffern', () => {
    const el = draw({ fill: solid(BLAU), outcome: 'winner', background: HELL, textColor: TEXT_DUNKEL });
    expect(el.style.backgroundColor).toBe(rgb(BLAU));
    expect(el).toHaveAttribute('data-digit-color', BOX_WHITE);
  });

  it('@ZM-156 gedämpfte Weste: Mitte und Streifen werden gedämpft', () => {
    const el = draw({ fill: vest(GELB, ROT), outcome: 'loser', background: HELL, textColor: TEXT_DUNKEL });
    expect(el.style.backgroundImage).toContain(rgb(mixHex(GELB, HELL, LOSER_DIM_SHARE)));
    expect(el.style.backgroundImage).toContain(rgb(mixHex(ROT, HELL, LOSER_DIM_SHARE)));
  });
});

describe('ScoreBox Rahmen (@ZM-140, RF5)', () => {
  it('@ZM-140 Schwarz auf dunklem Monitor: kräftiger Rahmen in heller Textfarbe (Zeile 2 „Schwarz mit hellem Rahmen“)', () => {
    const el = draw({ size: 'display', fill: solid(BOX_BLACK), background: DUNKEL, textColor: '#FFFFFF' });
    expect(el).toHaveAttribute('data-frame', 'strong');
    expect(el.style.borderStyle).toBe('solid');
    expect(el.style.borderWidth).toBe(displayLayout.scoreArea.frameWidthStrong);
    expect(el.style.borderColor).toBe(rgb('#FFFFFF'));
  });

  it('@ZM-140 Gegenbeispiel: Schwarz auf hellem Grund braucht keinen kräftigen Rahmen', () => {
    const el = draw({ size: 'display', fill: solid(BOX_BLACK), background: HELL, textColor: TEXT_DUNKEL });
    expect(el).toHaveAttribute('data-frame', 'subtle');
    expect(el.style.borderWidth).toBe(displayLayout.scoreArea.frameWidthSubtle);
  });

  it('RF5 weißer Kasten auf hellem Grund: kräftiger Rahmen in dunkler Textfarbe', () => {
    const el = draw({ fill: solid(BOX_WHITE), background: HELL, textColor: TEXT_DUNKEL });
    expect(el).toHaveAttribute('data-frame', 'strong');
    expect(el.style.borderColor).toBe(rgb(TEXT_DUNKEL));
  });

  it('@ZM-161 Weste: Rahmen, wenn die Streifen < 3 : 1 haben, auch wenn die Mitte reicht', () => {
    const el = draw({ fill: vest(GELB, BOX_BLACK), background: DUNKEL, textColor: TEXT_HELL });
    expect(el).toHaveAttribute('data-frame', 'strong');
  });

  it('@ZM-161 Gegenbeispiel: Weste mit Mitte und Streifen ≥ 3 : 1 hat den dezenten Rahmen', () => {
    const el = draw({ fill: vest(GELB, ROT), background: DUNKEL, textColor: TEXT_HELL });
    expect(el).toHaveAttribute('data-frame', 'subtle');
  });

  it('kleine Kästen nehmen die Rahmenbreiten borderWidths (2 px dezent, 3 px kräftig), der Monitor die Breiten des Layouts', () => {
    expect(draw({ size: 'compact', fill: solid(GELB) }).style.borderWidth).toBe(borderWidths.medium);
    expect(draw({ size: 'row', fill: solid(BOX_BLACK), testId: 'zeile' }).style.borderWidth).toBe(borderWidths.strong);
  });

  it('der Rahmen liegt innerhalb der Kastenmaße (border-box)', () => {
    expect(draw({ fill: solid(BOX_BLACK) }).style.boxSizing).toBe('border-box');
  });
});

describe('ScoreBox Maße und Ecken (@ZM-151, @ZM-160, RF3)', () => {
  const ZUSTAENDE: ReadonlyArray<readonly [string, Partial<ScoreBoxProps>]> = [
    ['nur Ziffer', { score: 0 }],
    ['Sieger mit Ring, Pokal und Leibchen', { score: 4, outcome: 'winner', ringColor: '#00E676', cup: true, bib: true }],
    ['Verlierer', { score: 3, outcome: 'loser' }],
    ['zweistelliger Stand', { score: 10 }],
    ['ohne Ziffer', { score: null }],
    ['Weste mit kräftigem Rahmen', { score: 1, fill: vest(GELB, BOX_BLACK), bib: true }],
    ['schwarz mit kräftigem Rahmen', { score: 7, fill: solid(BOX_BLACK) }],
  ];

  it.each(SIZES)('@ZM-151 Größe %s: der Kasten hat in allen Zuständen dieselben Maße', (size) => {
    const maße = ZUSTAENDE.map(([name, over]) => {
      const { unmount } = render(<ScoreBox {...props({ size, ...over })} />);
      const d = dimensions(screen.getByTestId('box'));
      unmount();
      return [name, d] as const;
    });
    const erste = maße[0][1];
    for (const [name, d] of maße) {
      expect([name, d]).toEqual([name, erste]);
    }
    expect(erste.boxSizing).toBe('border-box');
  });

  it('RF3 zweistelliger Stand 10 im compact-Kasten: Kastenmaße wie bei 1 und mindestens 44 × 44 (Touch)', () => {
    render(<ScoreBox {...props({ testId: 'eins', score: 1 })} />);
    render(<ScoreBox {...props({ testId: 'zehn', score: 10 })} />);
    expect(dimensions(screen.getByTestId('zehn'))).toEqual(dimensions(screen.getByTestId('eins')));
    const el = screen.getByTestId('zehn');
    expect(el.style.width).toBe(cssVars.touchTargets.primary);
    expect(el.style.height).toBe(cssVars.touchTargets.minimum);
    expect(screen.getByTestId('zehn-digits')).toHaveTextContent('10');
  });

  it.each(SIZES)('@ZM-160 Größe %s: Pokal und Leibchen-Zeichen liegen absolut außerhalb der Ziffernfläche, nie als Kind der Ziffer', (size) => {
    const el = draw({ size, outcome: 'winner', cup: true, bib: true });
    const digits = screen.getByTestId('box-digits');
    for (const id of ['box-cup', 'box-bib']) {
      const mark = screen.getByTestId(id);
      expect(mark.style.position).toBe('absolute');
      expect(digits.contains(mark)).toBe(false);
      expect(el.contains(mark)).toBe(true);
      expect(mark.style.top).toMatch(/^calc\(-/);
    }
    expect(screen.getByTestId('box-bib').style.left).toMatch(/^calc\(-/);
    expect(screen.getByTestId('box-cup').style.right).toMatch(/^calc\(-/);
    expect(digits.children).toHaveLength(0);
  });

  it('@ZM-160 Monitor: Pokal und Zeichen haben die Größe monitorCup, kleine Kästen die Symbolgrößen', () => {
    draw({ size: 'display', outcome: 'winner', cup: true, bib: true });
    expect(screen.getByTestId('box-cup').style.width).toBe(displayLayout.scoreArea.monitorCup);
    expect(screen.getByTestId('box-bib').style.width).toBe(displayLayout.scoreArea.monitorCup);
  });

  it('der Monitor-Kasten füllt seine Zelle, die kleinen Kästen haben feste Maße', () => {
    const el = draw({ size: 'display' });
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('100%');
    const klein = draw({ size: 'compact', testId: 'klein' });
    expect(klein.style.width).not.toBe('100%');
  });
});

describe('ScoreBox gleiche Rahmenbreite beider Kästen (Entscheidung Daniel 15.10., @ZM-140)', () => {
  const frame = (side: 'home' | 'away', fill: BoxFill, outcome: 'winner' | 'loser' | undefined, other: BoxFill, otherOutcome: 'winner' | 'loser' | undefined) => {
    const strength = side === 'home'
      ? pairFrameStrength({ fill, outcome }, { fill: other, outcome: otherOutcome }, DUNKEL)
      : pairFrameStrength({ fill: other, outcome: otherOutcome }, { fill, outcome }, DUNKEL);
    return draw({ fill, outcome, frameStrength: strength, size: 'display', background: DUNKEL, textColor: TEXT_HELL, testId: side });
  };

  it('@ZM-140 ein Kasten braucht den kräftigen Rahmen (gedämpftes Blau), der andere nicht (Gelb): beide kräftig, Farbe je Kasten', () => {
    const gelb = frame('home', solid(GELB), 'winner', solid(BLAU), 'loser');
    const blau = frame('away', solid(BLAU), 'loser', solid(GELB), 'winner');
    expect(gelb.style.borderWidth).toBe(displayLayout.scoreArea.frameWidthStrong);
    expect(blau.style.borderWidth).toBe(gelb.style.borderWidth);
    expect(blau.style.borderColor).toBe(rgb(TEXT_HELL));
    expect(gelb.style.borderColor).not.toBe(rgb(TEXT_HELL));
  });

  it('@ZM-140 Gegenbeispiel: brauchen beide keinen kräftigen Rahmen, bleibt es bei der dezenten Breite', () => {
    const a = frame('home', solid(GELB), undefined, solid(ROT), undefined);
    const b = frame('away', solid(ROT), undefined, solid(GELB), undefined);
    expect(a.style.borderWidth).toBe(displayLayout.scoreArea.frameWidthSubtle);
    expect(b.style.borderWidth).toBe(a.style.borderWidth);
  });

  it('pairFrameStrength: einer kräftig → kräftig, beide dezent → dezent; Paarung ist symmetrisch', () => {
    const blauVerlierer = { fill: solid(BLAU), outcome: 'loser' as const };
    const gelb = { fill: solid(GELB) };
    expect(pairFrameStrength(blauVerlierer, gelb, DUNKEL)).toBe('strong');
    expect(pairFrameStrength(gelb, blauVerlierer, DUNKEL)).toBe('strong');
    expect(pairFrameStrength(gelb, { fill: solid(ROT) }, DUNKEL)).toBe('subtle');
  });

  it('ohne frameStrength bestimmt jeder Kasten seine Breite selbst (Einzelkasten)', () => {
    expect(draw({ fill: solid(GELB), size: 'display', testId: 'solo' }).style.borderWidth).toBe(displayLayout.scoreArea.frameWidthSubtle);
  });
});
