/**
 * @OB-038 Tor-Einblendung: der Ball ist die Noto-Emoji-Grafik als Illustration (feste Farben erlaubt), mit Herkunftsvermerk.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { TorBallGrafik } from '../TorBallGrafik';

describe('TorBallGrafik', () => {
  it('dekorativ, 128er Raster, ohne id und clipPath, mehrfach auf einer Seite möglich', () => {
    const { container } = render(<><TorBallGrafik /><TorBallGrafik /></>);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 128 128');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.querySelector('clipPath')).toBeNull();
    }
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('Herkunft und Lizenz stehen im Baustein und in THIRD_PARTY_NOTICES.md', () => {
    const baustein = readFileSync(join(__dirname, '..', 'TorBallGrafik.tsx'), 'utf8');
    expect(baustein).toContain('Apache-2.0');
    expect(baustein).toContain('googlefonts/noto-emoji');
    const hinweise = readFileSync(join(__dirname, '..', '..', '..', '..', 'THIRD_PARTY_NOTICES.md'), 'utf8');
    expect(hinweise).toContain('Apache License, Version 2.0');
    expect(hinweise).toContain('TorBallGrafik.tsx');
  });
});
