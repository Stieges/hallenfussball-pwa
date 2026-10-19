/**
 * Kartenfarben (Entscheidung Daniel 19.10.; Befund C-KARTE-GELB-ALS-WARNFARBE, Record Oberfläche „Karten-Farben nur für Karten“):
 * Gelb und Rot der Karten kommen aus den eigenen Tokens `cardYellow`/`cardRed`, nie aus `warning`/`error`. Dünner Rand aus
 * `borderControl`, damit die Form auch auf Weiß erkennbar ist (Grafik-Kontrast ≥ 3 : 1).
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { contrastRatio, MIN_UI_CONTRAST, resolveToken, type ThemeName } from '../../../test/contrast';
import { kartenFlaecheStil } from '../areas/kartenStil';

const THEMEN: ThemeName[] = ['light', 'dark'];
const quelle = (pfad: string): string => readFileSync(new URL(pfad, import.meta.url), 'utf8');

describe('kartenFlaecheStil', () => {
  it('Gelb nutzt cardYellow, Rot cardRed, jeweils mit dünnem Rand aus borderControl', () => {
    const gelb = kartenFlaecheStil('YELLOW');
    const rot = kartenFlaecheStil('RED');
    expect(gelb.background).toBe('var(--color-card-yellow)');
    expect(rot.background).toBe('var(--color-card-red)');
    for (const s of [gelb, rot]) { expect(String(s.border)).toContain('var(--color-border-control)'); }
  });

  it('Gelb-Rot wird diagonal aus beiden geteilt', () => {
    const s = kartenFlaecheStil('YELLOW_RED');
    expect(String(s.background)).toContain('linear-gradient(135deg');
    expect(String(s.background)).toContain('var(--color-card-yellow)');
    expect(String(s.background)).toContain('var(--color-card-red)');
  });

  it('Gegenbeispiel: kein Kartenstil greift auf warning, error oder accent zurück', () => {
    for (const art of ['YELLOW', 'YELLOW_RED', 'RED'] as const) {
      const text = JSON.stringify(kartenFlaecheStil(art));
      expect(text).not.toMatch(/warning|error|accent/);
    }
    expect(quelle('../areas/kartenStil.ts')).not.toMatch(/colors\.(warning|error|accent)/);
  });

  it('Gegenbeispiel: Warnhinweise (unvollständiger Eintrag, Sidebar-Banner) bleiben bei warning', () => {
    expect(quelle('../components/ProtocolRow.tsx')).toContain('cssVars.colors.warning');
    expect(quelle('../components/Sidebar/index.tsx')).toContain('cssVars.colors.warning');
  });

  it('Kartendialog und Kartenart-Schritt färben Karten nur mit den Karten-Tokens', () => {
    const dialog = quelle('../components/Dialogs/CardDialog.tsx');
    expect(dialog).toMatch(/YELLOW: cssVars\.colors\.cardYellow/);
    expect(dialog).toMatch(/RED: cssVars\.colors\.cardRed/);
    expect(dialog).not.toMatch(/(YELLOW|YELLOW_RED|RED): cssVars\.colors\.(accent|warning|error)/);
    expect(quelle('../areas/EntrySheets.tsx')).toContain('kartenFlaecheStil');
  });

  it.each(THEMEN)('%s: Rand gegen Hintergrund und gegen Gelb/Rot ≥ 3 : 1 (Form auch auf Weiß erkennbar)', (theme) => {
    const rand = resolveToken(theme, 'var(--color-border-control)');
    const hintergrund = resolveToken(theme, 'var(--color-surface-elevated)');
    expect(contrastRatio(rand, hintergrund)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrastRatio(rand, resolveToken(theme, 'var(--color-card-yellow)'))).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it.each(THEMEN)('%s: die Kartenfarben sind in hell und dunkel gleich (#FACC15, #DC2626)', (theme) => {
    expect(resolveToken(theme, 'var(--color-card-yellow)').toUpperCase()).toBe('#FACC15');
    expect(resolveToken(theme, 'var(--color-card-red)').toUpperCase()).toBe('#DC2626');
  });
});
