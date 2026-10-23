/**
 * Hinweis mit fettem Titel und kleinerem Text auf der Helfer-Seite (A-17b). Dünne Hülle um `InlineNotice`
 * (Symbol und Ton kommen von dort; Farbe allein trägt keine Bedeutung).
 */
import type { CSSProperties, ReactNode } from 'react';
import { InlineNotice, type InlineNoticeTone } from '../../../components/ui/molecules/InlineNotice';
import { cssVars } from '../../../design-tokens';

export interface JoinNoticeProps {
  tone: InlineNoticeTone;
  title: string;
  text?: string;
  icon?: ReactNode;
  /** Tasten unter dem Text, volle Breite. */
  footer?: ReactNode;
  'data-testid': string;
}

const titleStyle: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };
const textStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm };

export const JoinNotice = ({ tone, title, text, icon, footer, 'data-testid': testId }: JoinNoticeProps) => (
  <InlineNotice tone={tone} icon={icon} footer={footer} data-testid={testId}>
    <span style={titleStyle}>{title}</span>
    {text ? <span style={textStyle}>{text}</span> : null}
  </InlineNotice>
);
