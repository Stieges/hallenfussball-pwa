/**
 * @OB-038 „Aktualisieren“ ist ein Pfeil im Kreis (Entscheidung des Product Owners 16.11., statt der früheren Uhr).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icons } from '../Icons';

// Die frühere Zeichnung (Uhr), Stand origin/main d26a3cf4
const ALTE_UHR = 'M17 10a7 7 0 11-14 0 7 7 0 0114 0zM10 6v4l3 2';

const zeichnung = (el: React.ReactElement): { html: string; svg: SVGElement } => {
  const { container } = render(el);
  const svg = container.querySelector('svg')!;
  return { html: svg.innerHTML, svg };
};

describe('@OB-038 Symbol „Aktualisieren“ (Pfeil im Kreis)', () => {
  it('ist ein offener Kreisbogen mit Pfeilspitze, keine Uhr (kein Zeiger, kein geschlossener Kreis)', () => {
    const { html, svg } = zeichnung(<Icons.Refresh />);
    expect(html).not.toContain(ALTE_UHR);
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(html).toContain('M23 4v6h-6');
  });

  it('unterscheidet sich von der Uhr `Icons.Clock` und vom Tausch-Symbol', () => {
    const refresh = zeichnung(<Icons.Refresh />).html;
    expect(refresh).not.toBe(zeichnung(<Icons.Clock />).html);
    expect(refresh).not.toBe(zeichnung(<Icons.Swap />).html);
  });

  it('Größe und Farbe lassen sich setzen', () => {
    const { svg } = zeichnung(<Icons.Refresh size={32} color="red" />);
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('stroke')).toBe('red');
  });
});

