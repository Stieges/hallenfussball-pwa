/**
 * Hinweis anstelle der Gruppen-Angabe im rechten Kopfbereich der Live-Folie (B-48a, @ME-006).
 * Stil „corner“ aus dem Monitor-Mockup v8; Schrift nie unter 3 % der Bildhöhe, Maße aus den Display-Tokens.
 */
import type { CSSProperties } from 'react';
import { displayFontSizes, displayLayout } from '../../design-tokens';

const layout = displayLayout.scoreArea;

export interface LiveHeaderNoticeProps {
  text: string;
  color: string;
  borderColor: string;
  background: string;
}

export function LiveHeaderNotice({ text, color, borderColor, background }: LiveHeaderNoticeProps) {
  const style: CSSProperties = {
    gridColumn: 3,
    justifySelf: 'end',
    alignSelf: 'end',
    maxWidth: '100%',
    padding: `${layout.noticePadY} ${layout.noticePadX}`,
    border: `${layout.noticeBorderWidth} solid ${borderColor}`,
    borderRadius: layout.noticeRadius,
    background,
    color,
    fontSize: displayFontSizes.notice,
    fontWeight: 600,
    lineHeight: layout.noticeLineHeight,
    textAlign: 'left',
  };
  return <div style={style} data-testid="monitor-wakelock-hint" role="status">{text}</div>;
}
