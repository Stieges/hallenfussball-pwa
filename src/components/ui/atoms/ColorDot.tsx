/**
 * ColorDot – reiner Anzeige-Tupfer einer Farbe (@W3-040: Farbe für Spielplan und Aushang in den Stammdaten).
 *
 * Kein Knopf und nicht fokussierbar: die Farbe wird angezeigt, nicht gewählt (Farbauswahl ist MVP+, @DR-043). Die
 * Textalternative (`label`, z. B. „Farbe für Spielplan und Aushang: Blau“) trägt die Bedeutung; der Farbname soll
 * zusätzlich sichtbar daneben stehen („Farbe nie allein“, VISUAL-DESIGN § 7). Der Rand aus dem Token hält den Tupfer
 * auch bei sehr heller Farbe sichtbar. `data-accent` trägt die Farbe für Tests.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { FALLBACK_PATTERN } from '../../../core/models/scoreBoxColors';
import { stripedImage } from '../molecules/scoreBoxStyle';

export interface ColorDotProps {
  /** Farbe als `#RRGGBB`; fehlt sie, zeigt der Tupfer das Fallback-Muster „Trikotfarbe unbekannt“ (@W3-042, @ZM-203). */
  color?: string;
  /** Textalternative, nennt Zweck und Farbname. */
  label: string;
  testId?: string;
}

export function ColorDot({ color, label, testId }: ColorDotProps): ReactElement {
  const style: CSSProperties = {
    display: 'inline-block',
    flex: 'none',
    width: cssVars.iconSizes.lg,
    height: cssVars.iconSizes.lg,
    borderRadius: cssVars.borderRadius.full,
    ...(color === undefined
      ? { backgroundImage: stripedImage(FALLBACK_PATTERN.light, FALLBACK_PATTERN.dark, 'flat') }
      : { background: color }),
    border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.borderControl}`,
  };
  return <span role="img" aria-label={label} data-testid={testId} {...(color !== undefined ? { 'data-accent': color } : { 'data-shirt-unknown': 'true' })} style={style} />;
}
