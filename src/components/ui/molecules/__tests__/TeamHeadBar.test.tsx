/**
 * TeamHeadBar (Plan Cockpit v2 B3, N3 aus dem Review zu PR A): die Schrift „Heim“/„Gast“ bleibt von den Weste-Streifen weg (≥ 4,5 : 1 auf der Mitte),
 * am Laptop ist der Kopf mindestens so hoch wie die Stufe es sagt, der Name bleibt neben der Seite.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamHeadBar } from '../TeamHeadBar';
import { fillStreifenProzent } from '../scoreBoxStyle';

const EINFARBIG = { kind: 'solid', color: '#6B21A8' } as const;
const WESTE = { kind: 'vest', center: '#2E7D32', stripes: '#FFFFFF' } as const;
const zeige = (fill: typeof EINFARBIG | typeof WESTE, breit = true) => render(<TeamHeadBar name="DJK Otting" label="Gast" fill={fill} breit={breit} testId="kopf" nameTestId="name" />);

describe('TeamHeadBar', () => {
  it('N3 mit Weste: der Innenabstand links und rechts beginnt hinter dem Streifen, „Gast“ liegt auf der Mitte', () => {
    zeige(WESTE);
    const prozent = fillStreifenProzent(WESTE);
    expect(prozent).toBeGreaterThan(0);
    expect(screen.getByTestId('kopf').style.padding).toContain(`${String(prozent)}%`);
  });

  it('Gegenprobe: einfarbige Fläche hat keinen Streifen, der Innenabstand bleibt klein', () => {
    zeige(EINFARBIG);
    expect(fillStreifenProzent(EINFARBIG)).toBe(0);
    expect(screen.getByTestId('kopf').style.padding).toContain('0%');
  });

  it('am Laptop (breit) hat der Kopf die Mindesthöhe der Stufe und die Schrift der Stufe', () => {
    zeige(EINFARBIG);
    expect(screen.getByTestId('kopf').style.minHeight).toContain('--cockpit-kopf');
    expect(screen.getByTestId('name').style.fontSize).toContain('--cockpit-kopf-schrift');
  });

  it('am Handy (nicht breit) keine Mindesthöhe der Stufe', () => {
    zeige(EINFARBIG, false);
    expect(screen.getByTestId('kopf').style.minHeight).toBe('');
  });
});
