/**
 * Karten-Farben nur für Karten (Oberfläche E): das PDF leitet seine RGB-Werte aus den Karten-Tokens ab (hell und dunkel gleich),
 * nichts ist hart codiert. Gegenbeispiel: keine Kartenfarbe stammt aus warning/error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { hexToRgb } from '../../colorUtils';
import { resolveToken } from '../../../test/contrast';
import { pdfKartenFarben } from '../kartenFarben';

const rgb = (hex: string): [number, number, number] => { const c = hexToRgb(hex); return [c.r, c.g, c.b]; };

describe('Karten-Farben nur für Karten (Oberfläche E) – PDF-Kartenfarben', () => {
  it.each(['light', 'dark'] as const)('%s: Gelb und Rot sind die RGB-Werte von cardYellow und cardRed', (theme) => {
    expect(pdfKartenFarben.yellow).toEqual(rgb(resolveToken(theme, 'var(--color-card-yellow)')));
    expect(pdfKartenFarben.red).toEqual(rgb(resolveToken(theme, 'var(--color-card-red)')));
  });

  it('Gegenbeispiel: Quelle aus den Karten-Tokens, nicht aus warning/error, ohne ohne Hex- oder RGB-Zahlenwerte', () => {
    const quelle = readFileSync(resolve(process.cwd(), 'src/lib/pdf/kartenFarben.ts'), 'utf8');
    expect(quelle).toMatch(/semanticColorsLight\.cardYellow/);
    expect(quelle).toMatch(/semanticColorsLight\.cardRed/);
    expect(quelle).not.toMatch(/\.(warning|error)\b/);
    expect(quelle).not.toMatch(/#[0-9a-fA-F]{3,6}\b|\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]/);
  });
});
