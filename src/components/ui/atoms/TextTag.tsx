/**
 * TextTag – kleine Textmarke ohne Bedienung (z. B. „Co-Admin“ auf der Turnierkarte, CA-5 / @HE-085).
 *
 * Reine Anzeige: kein Klickziel, Text in `textPrimary` auf getönter Fläche (Kontrast in beiden Themen wie Fließtext,
 * VISUAL-DESIGN § 5), Rand aus dem Token. Bricht nie (kurze Marke, `nowrap`); die Bedeutung trägt das Wort, nicht die Farbe.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export interface TextTagProps {
  children: ReactNode;
  /** Vorgelesener Text, wenn das sichtbare Wort allein zu knapp ist (z. B. „Deine Rolle: Co-Admin“). */
  ariaLabel?: string;
  testId?: string;
}

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.secondaryBorder}`,
  borderRadius: cssVars.borderRadius.sm,
  background: cssVars.colors.secondaryLight,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.semibold,
  lineHeight: cssVars.lineHeights.bodySm,
  whiteSpace: 'nowrap',
};

export function TextTag({ children, ariaLabel, testId }: TextTagProps): ReactElement {
  return (
    <span style={tagStyle} aria-label={ariaLabel} data-testid={testId}>
      {children}
    </span>
  );
}
