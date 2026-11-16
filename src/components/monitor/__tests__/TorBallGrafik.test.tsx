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

  const wurzel = join(__dirname, '..', '..', '..', '..');
  const lies = (...teile: string[]): string => readFileSync(join(wurzel, ...teile), 'utf8');
  const COPYRIGHT = 'Copyright 2013 Google, Inc. All Rights Reserved.';

  it('Herkunft, wörtlicher Copyright-Satz und Lizenz stehen im Baustein, in THIRD_PARTY_NOTICES.md und in der ausgelieferten Hinweisdatei', () => {
    const baustein = lies('src', 'components', 'monitor', 'TorBallGrafik.tsx');
    expect(baustein).toContain(COPYRIGHT);
    expect(baustein).toContain('Apache-2.0');
    expect(baustein).toContain('googlefonts/noto-emoji');
    for (const datei of [['THIRD_PARTY_NOTICES.md'], ['public', 'THIRD_PARTY_NOTICES.txt']]) {
      const text = lies(...datei);
      expect(text, datei.join('/')).toContain(COPYRIGHT);
      expect(text, datei.join('/')).toContain('2D/svg/LICENSE');
      expect(text, datei.join('/')).toContain('Apache');
      expect(text, datei.join('/')).toContain('Apache-2.0.txt');
    }
    expect(lies('public', 'THIRD_PARTY_NOTICES.txt')).toContain('TorBallGrafik.tsx');
  });

  it('der volle Apache-2.0-Lizenztext liegt unter public/lizenzen (wird mit ausgeliefert)', () => {
    const lizenz = lies('public', 'lizenzen', 'Apache-2.0.txt');
    expect(lizenz).toContain('Apache License');
    expect(lizenz).toContain('Version 2.0, January 2004');
    expect(lizenz).toContain('END OF TERMS AND CONDITIONS');
    expect(lizenz.split('\n').length).toBeGreaterThan(190);
  });
});
