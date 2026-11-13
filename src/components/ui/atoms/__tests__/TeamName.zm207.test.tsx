/**
 * @ZM-207 Ein Teamname mit Schrägstrich bricht nie mitten im Wort („SG Taching/Tengling“ nicht als „Ten-gling“): Umbruchstelle nach dem
 * Schrägstrich und an Leerzeichen; der Text bleibt unverändert; ein einzelnes zu langes Wort bricht weiter über `overflow-wrap`.
 * Die sichtbare Wirkung im Browser (360 bis 1440 Pixel) prüft `tests/e2e/teamname-wortbruch-zm207.spec.ts`.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HyphenSafe, SlashBreaks, TeamName } from '../TeamName';
import { splitAfterSlash } from '../teamNameBreaks';

describe('@ZM-207 Teamnamen: Umbruchstelle nach dem Schrägstrich', () => {
  it('„SG Taching/Tengling“: nach „Taching/“ steht eine Umbruchstelle (wbr), der Text bleibt wörtlich derselbe', () => {
    const { container } = render(<TeamName name="SG Taching/Tengling" />);
    expect(container.textContent).toBe('SG Taching/Tengling');
    const marken = container.querySelectorAll('wbr');
    expect(marken).toHaveLength(1);
    expect(marken[0].previousSibling?.textContent).toBe('SG Taching/');
    expect(marken[0].nextSibling?.textContent).toBe('Tengling');
    expect(container.querySelector('[data-teamname]')).not.toBeNull();
  });

  it('Teile des Namens: je bis einschließlich „/“; ohne Schrägstrich ein Teil; „//“, Anfang und Ende ohne leere Teile', () => {
    expect(splitAfterSlash('Taching/Tengling')).toEqual(['Taching/', 'Tengling']);
    expect(splitAfterSlash('Rot-Weiß')).toEqual(['Rot-Weiß']);
    expect(splitAfterSlash('A/B/C')).toEqual(['A/', 'B/', 'C']);
    expect(splitAfterSlash('a//b')).toEqual(['a/', '/', 'b']);
    expect(splitAfterSlash('/x')).toEqual(['/', 'x']);
    expect(splitAfterSlash('x/')).toEqual(['x/']);
  });

  it('Gegenbeispiel: ein Name ohne Schrägstrich bekommt keine Umbruchstelle und bleibt ein einziger Textknoten (Umbruch nur an Leerzeichen)', () => {
    const { container } = render(<SlashBreaks text="SG Taching Tengling" />);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
    expect(container.childNodes).toHaveLength(1);
    expect(container.textContent).toBe('SG Taching Tengling');
  });

  it('Gegenbeispiel: die Umbruchstelle steht nie im Wort – „Tengling“ bleibt als Ganzes in einem Textknoten', () => {
    const { container } = render(<SlashBreaks text="SG Taching/Tengling" />);
    const texte = Array.from(container.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent);
    expect(texte).toEqual(['SG Taching/', 'Tengling']);
  });

  it('Bindestrich-Wörter bleiben mit TeamName beisammen (nowrap), auch neben einem Schrägstrich; der Text bleibt', () => {
    const { container } = render(<HyphenSafe text="SG Rot-Weiß/Grün-Gelb" />);
    expect(container.textContent).toBe('SG Rot-Weiß/Grün-Gelb');
    expect(container.querySelectorAll('wbr')).toHaveLength(1);
    const spans = Array.from(container.querySelectorAll('span'));
    expect(spans.map((s) => s.textContent)).toEqual(['Rot-Weiß/', 'Grün-Gelb']);
    expect(spans.every((s) => s.style.whiteSpace === 'nowrap')).toBe(true);
  });

  it('SlashBreaks allein lässt Bindestriche unangetastet (der Browser darf dort umbrechen, Tabellen und Monitor)', () => {
    const { container } = render(<SlashBreaks text="Kleinstadt-Neudorf" />);
    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
  });
});
