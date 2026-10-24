/**
 * Schriftstile für Hinweise der Seite „Team & Helfer“ (Mockup M4): Titel 14 px halbfett, Text 12 px – `InlineNotice` setzt die
 * ganze Fläche auf 12 px; der Titel steht eine Stufe darüber, wie im Mockup (`.notice b` / `.notice small`).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

export const noticeTitle: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, fontWeight: cssVars.fontWeights.semibold };
export const noticeText: CSSProperties = { display: 'block', fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
