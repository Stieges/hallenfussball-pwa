import { displayLayout, getContrastRatio } from '../../design-tokens/display';
import type { LiveColorScheme } from '../../types/monitor';

/** Teamfarbe (wenn eingeschaltet und vorhanden), sonst Farbe des Schemas für die Seite. */
export function resolveColor(
  position: 'home' | 'away',
  scheme: LiveColorScheme,
  team?: { colors?: { primary?: string } },
): string {
  if (scheme.useTeamColors && team?.colors?.primary) {
    return team.colors.primary;
  }
  return position === 'home' ? scheme.homeColor : scheme.awayColor;
}

/** Rahmen eines Kastens (Breite und Farbe als CSS-Werte). */
export interface BlockFrame {
  width: string;
  color: string;
}

/**
 * @ZM-140 / B-44a2: Beide Kästen tragen denselben dezenten Rahmen (Teil der Anzeigetafel-Sprache).
 * Hebt sich die Kastenfarbe mit weniger als 3 : 1 vom Hintergrund ab, ist der Rahmen kräftig und in voller Textfarbe.
 */
export function getBlockFrame(blockHex: string, backgroundHex: string, textColor: string): BlockFrame {
  const L = displayLayout.scoreArea;
  if (getContrastRatio(blockHex, backgroundHex) < 3) {
    return { width: L.frameWidthStrong, color: textColor };
  }
  return { width: L.frameWidthSubtle, color: `color-mix(in srgb, ${textColor} ${L.frameSubtleMix}, transparent)` };
}

/**
 * Beide Kästen mit gleicher Rahmenbreite (Entscheidung Daniel 2026-10-15): die kräftige Breite gilt für beide,
 * sobald einer der Kästen sie braucht. Die Rahmenfarbe richtet sich weiter nach dem jeweiligen Kasten.
 */
export function getBlockFrames(homeHex: string, awayHex: string, backgroundHex: string, textColor: string): { home: BlockFrame; away: BlockFrame } {
  const home = getBlockFrame(homeHex, backgroundHex, textColor);
  const away = getBlockFrame(awayHex, backgroundHex, textColor);
  const width = parseFloat(home.width) >= parseFloat(away.width) ? home.width : away.width;
  return { home: { ...home, width }, away: { ...away, width } };
}
