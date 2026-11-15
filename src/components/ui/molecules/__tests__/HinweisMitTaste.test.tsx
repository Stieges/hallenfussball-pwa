/**
 * @OB-087 HinweisMitTaste: die Taste steht im SELBEN Kasten wie der Text (nach dem Text, in einer eigenen Aktionsspalte), der Hinweis ohne Taste ist derselbe Kasten
 * ohne Aktion; Rolle und Ton stimmen. Die Lage (rechts in der Zeile, umgebrochen rechtsbündig darunter, 44 px) prüft der Browser-Test
 * `tests/e2e/flows/hinweise-mit-taste-ob087.spec.ts` über Rechtecke.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArbeitsTaste } from '../ArbeitsTaste';
import { HinweisMitTaste } from '../HinweisMitTaste';

describe('@OB-087 HinweisMitTaste', () => {
  it('Text und Taste stehen im selben Kasten, die Taste nach dem Text in der Aktionsspalte; sie trägt den Ton des Hinweises', () => {
    render(
      <HinweisMitTaste
        symbol={<i />} titel="Kein Netz" zusatz="Grund" data-testid="h"
        taste={<ArbeitsTaste imHinweis onClick={() => undefined} data-testid="t">Verbinden</ArbeitsTaste>}
      />,
    );
    const kasten = screen.getByTestId('h');
    expect(kasten).toHaveAttribute('role', 'status');
    expect(kasten.children).toHaveLength(2);
    expect(kasten.children[0]).toHaveTextContent('Kein Netz');
    expect(kasten.children[0]).toHaveTextContent('Grund');
    expect(kasten.children[1]).toContainElement(screen.getByTestId('t'));
    expect(screen.getByTestId('t')).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByTestId('t').getAttribute('style')).toContain('var(--hinweis-bedien');
  });

  it('Gegenbeispiel: ohne Taste gibt es keine Aktionsspalte (derselbe Kasten ohne Aktion)', () => {
    render(<HinweisMitTaste symbol={<i />} titel="Uhr nicht abgeglichen" data-testid="h" />);
    expect(screen.getByTestId('h').children).toHaveLength(1);
  });

  it('der Ton „fehler“ ist eine Warnmeldung (role alert), „ruhig“ und „warn“ ein Status', () => {
    const { rerender } = render(<HinweisMitTaste symbol={<i />} titel="x" ton="fehler" data-testid="h" />);
    expect(screen.getByTestId('h')).toHaveAttribute('role', 'alert');
    rerender(<HinweisMitTaste symbol={<i />} titel="x" ton="ruhig" data-testid="h" />);
    expect(screen.getByTestId('h')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('h')).toHaveAttribute('data-ton', 'ruhig');
  });
});
