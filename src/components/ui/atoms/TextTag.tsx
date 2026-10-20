/**
 * TextTag – kleine Textmarke ohne Bedienung (z. B. „Co-Admin“ auf der Turnierkarte, CA-5 / @HE-085).
 *
 * Reine Anzeige: kein Klickziel, kein `aria-label` (auf einem `span` ohne Rolle unzulässig, ARIA 1.2 – vorgelesen wird das Wort), Text in `textPrimary` auf getönter Fläche (Kontrast in beiden Themen wie Fließtext,
 * VISUAL-DESIGN § 5), Rand aus dem Token. Bricht nie (kurze Marke, `nowrap`); die Bedeutung trägt das Wort, nicht die Farbe.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

export interface TextTagProps {
  children: ReactNode;
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

export function TextTag({ children, testId }: TextTagProps): ReactElement {
  return (
    <span style={tagStyle} data-testid={testId}>
      {children}
    </span>
  );
}
