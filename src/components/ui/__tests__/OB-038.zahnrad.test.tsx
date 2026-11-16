/**
 * @OB-038 „Einstellungen“ ist ein echtes Zahnrad mit 8 breiten Zähnen (Entscheidung des Product Owners 16.11., statt des Strahlenkranzes, der wie eine Sonne wirkte).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icons } from '../Icons';

// Die frühere Zeichnung (Strahlenkranz), Stand origin/main d26a3cf4
const ALTER_STRAHLENKRANZ_STRAHLEN = 'M10 1v2m0 14v2M19 10h-2M3 10H1m15.364-6.364l-1.414 1.414M5.05 14.95l-1.414 1.414m12.728 0l-1.414-1.414M5.05 5.05L3.636 3.636';

const zeichnung = (el: React.ReactElement): { html: string; svg: SVGElement } => {
  const { container } = render(el);
  const svg = container.querySelector('svg')!;
  return { html: svg.innerHTML, svg };
};

describe('@OB-038 Symbol „Einstellungen“ (Zahnrad)', () => {
  it('ein Ring mit 8 Zähnen (32 Ecken) und ein Loch in der Mitte, keine dünnen Strahlen', () => {
    const { html, svg } = zeichnung(<Icons.Settings />);
    expect(html).not.toContain(ALTER_STRAHLENKRANZ_STRAHLEN);
    const d = svg.querySelector('path')!.getAttribute('d')!;
    expect(d.match(/[ML]/g)).toHaveLength(32);
    expect(d.endsWith('z')).toBe(true);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelector('circle')).toHaveAttribute('r', '2.8');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('Zähne liegen gleichmäßig: acht gleiche Zacken im Abstand von 45 Grad (Punkte spiegeln sich)', () => {
    const d = zeichnung(<Icons.Settings />).svg.querySelector('path')!.getAttribute('d')!;
    const punkte = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]) - 12, Number(m[2]) - 12]);
    const radien = new Set(punkte.map(([x, y]) => Math.hypot(x, y).toFixed(1)));
    expect([...radien].sort()).toEqual(['6.8', '9.2']);
  });
});

