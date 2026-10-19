import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MatchIcons } from '../IconsMatch';

const NAMEN = ['Ball', 'Flag', 'Stopwatch', 'Card', 'Undo', 'Pause', 'Play', 'Whistle', 'More', 'List', 'Edit', 'Check', 'Shirt', 'Calendar'] as const;

describe('Symbole fürs Cockpit (Plan 3.1)', () => {
  it('liefert genau die 14 vereinbarten Symbole', () => {
    expect(Object.keys(MatchIcons).sort()).toEqual([...NAMEN].sort());
  });

  it.each(NAMEN)('%s ist ein dekoratives SVG', (name) => {
    const Icon = MatchIcons[name];
    const { container } = render(<Icon />);
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('Gegenbeispiel: die Größe lässt sich setzen', () => {
    const { container } = render(<MatchIcons.Ball size={32} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });
});
