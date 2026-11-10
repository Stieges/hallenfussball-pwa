/**
 * Fallback-Muster „Trikotfarbe unbekannt“ im Ergebniskasten (@ZM-203, @ZM-204): schräg in zwei Grautönen, Ziffer weiß mit mindestens 4,5 : 1,
 * vorgelesen „Trikotfarbe unbekannt“, Weste mit dem Muster in den Rändern. Werte aus dem Gherkin, gemessen am gerenderten Kasten.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BOX_WHITE, FALLBACK_PATTERN, unknownColorFill, type BoxFill } from '../../../../core/models/scoreBoxColors';
import { getContrastRatio } from '../../../../design-tokens/display';
import { palette } from '../../../../design-tokens/colors/palette';
import { ScoreBox, type ScoreBoxProps } from '../ScoreBox';
import { stripedImage } from '../scoreBoxStyle';
import { TeamHeadBar } from '../TeamHeadBar';

const GELB = palette.yellow[400];
const DUNKEL = '#0A1628';
const HELL = palette.neutral[0];

function draw(over: Partial<ScoreBoxProps> = {}): HTMLElement {
  render(<ScoreBox score={3} fill={unknownColorFill()} size="compact" background={DUNKEL} textColor={HELL} ariaLabel="SV Süd: 3" testId="box" {...over} />);
  return screen.getByTestId(over.testId ?? 'box');
}

describe('@ZM-203 Kasten ohne Trikotfarbe', () => {
  it.each(['row', 'compact', 'cockpit'] as const)('@ZM-203 Größe %s: schräg gestreift (zwei Grautöne), weiße Ziffer', (size) => {
    const el = draw({ size });
    expect(el).toHaveAttribute('data-fill', 'striped');
    expect(el.style.backgroundImage).toContain('repeating-linear-gradient(135deg');
    expect(el).toHaveAttribute('data-digit-color', BOX_WHITE);
  });

  it('@ZM-203 Monitor (display): schräg, Streifenbreite in Bildschirmhöhe-Einheiten (jsdom kennt cqh nicht – das Bild kommt aus der Funktion)', () => {
    const el = draw({ size: 'display' });
    expect(el).toHaveAttribute('data-fill', 'striped');
    expect(el).toHaveAttribute('data-digit-color', BOX_WHITE);
    const bild = stripedImage(FALLBACK_PATTERN.light, FALLBACK_PATTERN.dark, 'display');
    expect(bild).toContain('repeating-linear-gradient(135deg');
    expect(bild).toContain('cqh');
    expect(bild).toContain(FALLBACK_PATTERN.light);
    expect(bild).toContain(FALLBACK_PATTERN.dark);
  });

  it('@ZM-203 die Ziffer hat zu beiden Grautönen mindestens 4,5 : 1', () => {
    draw();
    expect(getContrastRatio(BOX_WHITE, FALLBACK_PATTERN.light)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(BOX_WHITE, FALLBACK_PATTERN.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('@ZM-203 vorgelesen: der Name nennt „Trikotfarbe unbekannt“ (das Muster ist das Zeichen, nicht die Farbe allein)', () => {
    expect(draw({ ariaLabel: 'SV Süd: 3' })).toHaveAttribute('aria-label', 'SV Süd: 3, tournament:matchCard.shirtUnknown');
    expect(draw({ ariaLabel: 'x', testId: 'zwei' }).getAttribute('data-shirt-unknown')).toBe('true');
  });

  it('@ZM-203 Gegenbeispiel: ein Kasten mit echter Farbe hat kein Muster, keinen Zusatz im Namen, weiße Ziffer nur wenn der Kontrast es verlangt', () => {
    const el = draw({ fill: { kind: 'solid', color: palette.kit.blue }, testId: 'blau' });
    expect(el.style.backgroundImage).toBe('');
    expect(el).toHaveAttribute('aria-label', 'SV Süd: 3');
    expect(el).not.toHaveAttribute('data-shirt-unknown');
  });

  it('@ZM-203 Gegenbeispiel: der Verlierer-Kasten im Muster bleibt lesbar (Ziffer weiß oder schwarz nach Kontrast)', () => {
    const el = draw({ outcome: 'loser', testId: 'loser' });
    expect(['#FFFFFF', '#000000']).toContain(el.getAttribute('data-digit-color'));
  });

  it('@ZM-203 die Kastengröße hängt nicht vom Muster ab (gleiche Maße wie ein einfarbiger Kasten)', () => {
    const muster = draw({ testId: 'a' });
    const einfarbig = draw({ fill: { kind: 'solid', color: GELB }, testId: 'b' });
    for (const eigenschaft of ['width', 'height', 'boxSizing', 'fontSize'] as const) {
      expect(muster.style[eigenschaft]).toBe(einfarbig.style[eigenschaft]);
    }
  });
});

describe('@ZM-204 Weste über einem Team ohne Trikotfarbe', () => {
  const weste: BoxFill = { kind: 'vest', center: GELB, stripes: FALLBACK_PATTERN.dark, stripesUnknown: true };

  it('@ZM-204 gelbes Leibchen, Ränder im Muster (Hintergrundbild auf allen drei Teilen), Leibchen-Zeichen, vorgelesen „Trikotfarbe unbekannt“', () => {
    const el = draw({ fill: weste, bib: true, ariaLabel: 'SV Süd in Leibchen: 3' });
    const teile = el.querySelectorAll<HTMLElement>('[data-teil]');
    expect(teile).toHaveLength(3);
    for (const teil of teile) {
      expect(teil.style.backgroundImage).toContain('repeating-linear-gradient(135deg');
    }
    expect(el).toHaveAttribute('data-color', GELB);
    expect(screen.getByTestId('box-bib')).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-label', 'SV Süd in Leibchen: 3, tournament:matchCard.shirtUnknown');
  });

  it('@ZM-204 Gegenbeispiel: Weste mit bekannter Trikotfarbe hat keine Muster-Teile und keinen Zusatz im Namen', () => {
    const el = draw({ fill: { kind: 'vest', center: GELB, stripes: palette.kit.red }, bib: true, testId: 'rot' });
    for (const teil of el.querySelectorAll<HTMLElement>('[data-teil]')) {
      expect(teil.style.backgroundImage).toBe('');
    }
    expect(el).toHaveAttribute('aria-label', 'SV Süd: 3');
  });
});

describe('@ZM-203 Team-Kopf im Cockpit gilt gleich', () => {
  it.each([false, true])('@ZM-203 TeamHeadBar (kompakt: %s) im Muster: Hintergrundbild, weiße Schrift', (kompakt) => {
    render(<TeamHeadBar name="SV Süd" label="Heim" fill={unknownColorFill()} kompakt={kompakt} testId="kopf" nameTestId="kopf-name" />);
    const kopf = screen.getByTestId('kopf');
    expect(kopf).toHaveAttribute('data-fill', 'striped');
    expect(kopf.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(kopf.style.color).toBe('rgb(255, 255, 255)');
  });
});
