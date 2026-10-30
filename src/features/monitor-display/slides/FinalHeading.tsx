import { cssVars, displayList } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import type { FinalThemeColors } from './finalStyles';
import { finalHeadingBlock, finalSubtitle } from './finalStyles';

const ICONS = { standings: Icons.Trophy, scorers: Icons.List } as const;

interface FinalHeadingProps {
  icon: keyof typeof ICONS;
  title: string;
  /** Turniername unter der Überschrift */
  subtitle: string;
  colors: FinalThemeColors;
}

/** Kopf der Folien „Endstand“ und „Torschützen“ (R3-7, Mockups `mon-end-*`): Symbol und Wort, darunter der Turniername; knapper als die Listen-Folien, damit sechs große Zeilen über den Positionspunkten enden. */
export function FinalHeading({ icon, title, subtitle, colors }: FinalHeadingProps) {
  const Icon = ICONS[icon];
  return (
    <div style={finalHeadingBlock} data-testid="monitor-final-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: displayList.headingIconGap, fontSize: displayList.fontSizes.heading, fontWeight: cssVars.fontWeights.semibold, color: colors.text }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}><Icon size={displayList.headingIconSize} /></span>
        <span>{title}</span>
      </div>
      <div style={finalSubtitle(colors)}>{subtitle}</div>
    </div>
  );
}
