import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

/** Siegerzeile: goldener Rahmen (Medaillenfarbe), Fläche in der Warnfläche – ein Gold-Ton fehlt noch in den Tokens (Frage an Daniel). */
export const winnerBox: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: cssVars.spacing.md, padding: cssVars.spacing.md,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.medalGold}`, borderRadius: cssVars.borderRadius.lg,
  background: cssVars.colors.warningLight, color: cssVars.colors.textPrimary, minWidth: 0,
};
export const winnerIcon: CSSProperties = {
  width: cssVars.touchTargets.comfortable, height: cssVars.touchTargets.comfortable, flex: 'none', borderRadius: cssVars.borderRadius.full,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.medalGold}`, color: cssVars.colors.medalGold,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
export const factsLine: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: `${cssVars.spacing.xs} ${cssVars.spacing.md}`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm,
};
export const disclosureIcon: CSSProperties = { display: 'flex', color: cssVars.colors.textSecondary };
