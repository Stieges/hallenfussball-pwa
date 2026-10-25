/**
 * R3-4 (Review #395 m-1/C2): Teamnamen mit Bindestrich brechen nie mitten im Wort um (Messregel `titel.wortbruch`, VISUAL-DESIGN § 2) –
 * ohne den Namen zu verändern: Kopieren, Suchen und Bildschirmleser sehen den Originalnamen.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HyphenSafe, TeamName } from '../components/HyphenSafe';

describe('Namen mit Bindestrich', () => {
  it('der Text bleibt wörtlich derselbe (Kopieren und Suchen), Wörter mit Bindestrich stehen in einem nowrap-Element', () => {
    const name = 'Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921';
    const { container } = render(<TeamName name={name} />);
    expect(container.textContent).toBe(name);
    expect(container.textContent).not.toContain('‑');
    const spans = Array.from(container.querySelectorAll('span span'));
    expect(spans.map((span) => span.textContent)).toEqual(['Grün-Gelb', 'Kleinstadt-Neudorf']);
    expect(spans.every((span) => (span as HTMLElement).style.whiteSpace === 'nowrap')).toBe(true);
  });

  it('der Name trägt die Markierung für die Messung', () => {
    const { container } = render(<TeamName name="FC Nord" />);
    expect(container.querySelector('[data-teamname]')).not.toBeNull();
  });

  it('Gegenbeispiel: Wörter ohne Bindestrich und ein Bindestrich zwischen Leerzeichen bekommen kein nowrap (Umbruch an Leerzeichen bleibt)', () => {
    const { container } = render(<HyphenSafe text="FC - Süd und TSV West" />);
    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.textContent).toBe('FC - Süd und TSV West');
  });
});
