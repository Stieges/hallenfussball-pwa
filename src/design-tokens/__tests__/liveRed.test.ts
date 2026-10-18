/**
 * Aufgabe 1.1 (Spielanzeige): eigenes Live-Rot (@OB-039, @OB-065, RF5). Die Werte werden aus `global.css` gelesen,
 * nicht abgeschrieben (wie `scoreboard-tokens.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST, resolveToken, type ThemeName } from '../../test/contrast';
import { hexDeltaE2000 } from '../../core/models/kitColorDistance';
import { semanticColorsDark } from '../colors/semantic';
import { semanticColorsLight } from '../colors/semantic-light';

const THEMES: ThemeName[] = ['dark', 'light'];
const LIVE_ROT_MIN_ABSTAND = 10;

describe('Live-Rot (Tokens statusLive, statusLiveOn)', () => {
  it.each(THEMES)('@OB-039 @OB-065 Live-Rot ist nicht das Fehler-Rot (%s): ΔE2000 ≥ 10', (theme) => {
    const live = resolveToken(theme, 'var(--color-status-live)');
    const fehler = resolveToken(theme, 'var(--color-error)');
    expect(live.toLowerCase()).not.toBe(fehler.toLowerCase());
    expect(hexDeltaE2000(live, fehler)).toBeGreaterThanOrEqual(LIVE_ROT_MIN_ABSTAND);
  });

  it.each(THEMES)('@OB-065 Schrift statusLiveOn auf statusLive ≥ 4,5 : 1 (%s)', (theme) => {
    const flaeche = resolveToken(theme, 'var(--color-status-live)');
    const schrift = resolveToken(theme, 'var(--color-status-live-on)');
    expect(contrastRatio(schrift, flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each([['dark', '#FB7185'], ['light', '#BE123C']] as const)('@OB-039 Live-Rot (%s) ist der Vorschlagswert %s (Rose 400 bzw. 700)', (theme, hex) => {
    expect(resolveToken(theme, 'var(--color-status-live)').toLowerCase()).toBe(hex.toLowerCase());
  });

  it('@OB-065 Gegenbeispiel: weiße Schrift auf dem hellen Live-Rot des dunklen Themas wäre zu schwach', () => {
    expect(contrastRatio('#FFFFFF', resolveToken('dark', 'var(--color-status-live)'))).toBeLessThan(MIN_TEXT_CONTRAST);
  });

  it.each([['dark', semanticColorsDark], ['light', semanticColorsLight]] as const)(
    '@OB-039 Kontrollwert: die TS-Token (statusLive, statusLiveOn, statusLiveBg) stimmen mit global.css überein (%s)',
    (theme, ts) => {
      expect(resolveToken(theme, 'var(--color-status-live)').toLowerCase()).toBe(ts.statusLive.toLowerCase());
      expect(resolveToken(theme, 'var(--color-status-live-on)').toLowerCase()).toBe(ts.statusLiveOn.toLowerCase());
      expect(resolveToken(theme, 'var(--color-status-live-bg)').replace(/\s/g, '')).toBe(ts.statusLiveBg.replace(/\s/g, ''));
    },
  );
});
