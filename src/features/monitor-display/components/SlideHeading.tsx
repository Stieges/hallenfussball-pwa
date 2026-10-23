import type { ReactNode } from 'react';
import { cssVars, displayList } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';

export type SlideHeadingIcon = 'standings' | 'schedule' | 'nextMatches' | 'finals';

interface SlideHeadingProps {
  /** Linien-Symbol statt Emoji (Designsprache „Anzeigetafel“, Symbole statt Emojis) */
  icon: SlideHeadingIcon;
  color: string;
  children: ReactNode;
}

const ICONS = {
  standings: Icons.BarChart,
  schedule: Icons.Calendar,
  nextMatches: Icons.List,
  finals: Icons.Trophy,
} as const;

/** Überschrift einer Listen-Folie (B-44b): Linien-Symbol, daneben das Wort, Größe relativ zur Bildhöhe. */
export function SlideHeading({ icon, color, children }: SlideHeadingProps) {
  const Icon = ICONS[icon];
  return (
    <div
      data-testid="slide-heading"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: displayList.headingIconGap,
        fontSize: displayList.fontSizes.heading,
        fontWeight: cssVars.fontWeights.semibold,
        marginBottom: displayList.headingGap,
        color,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <Icon size={displayList.headingIconSize} />
      </span>
      <span>{children}</span>
    </div>
  );
}
