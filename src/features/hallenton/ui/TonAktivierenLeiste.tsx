/**
 * TonAktivierenLeiste – die feste Fußleiste „Ton aktivieren“ (H4-9, @HT-001, @HT-012, @HT-013, @HT-037): die einzige Haupttaste des Unterpunkts
 * (≥ 56 px), unten am Fensterrand, solange dieses Gerät Lautsprecher ist und der Browser noch einen Klick braucht. Der Klick ist die
 * Nutzergeste für den Ton (der Aufrufer ruft `tonAktivieren`). Breite wie der Inhaltsbereich des Admin-Centers (800 px, `dialogWidths.lg`: im Layout gibt es dafür keinen eigenen Wert). Neben der Seitenleiste beginnt sie erst hinter ihr (`links`).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';

export interface TonAktivierenLeisteProps {
  onAktivieren: () => void;
  /** Abstand vom linken Fensterrand (Breite der Seitenleiste am Rechner), sonst 0. */
  links?: number;
}

/** Höhe, die der Inhalt unten frei lässt, damit die Leiste nichts verdeckt (Taste + Hinweis + Abstände + Safe-Area am unteren Rand). */
export const LEISTE_PLATZ = `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.xxl} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom))`;

export function TonAktivierenLeiste({ onAktivieren, links = 0 }: TonAktivierenLeisteProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const stil: CSSProperties = {
    position: 'fixed', bottom: 0, right: 0, left: links, zIndex: cssVars.zIndex.sticky, boxSizing: 'border-box',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md} calc(${cssVars.spacing.sm} + env(safe-area-inset-bottom))`,
    background: cssVars.colors.surfaceSolid, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cssVars.spacing.xs,
  };
  return (
    <div style={stil} data-testid="hallenton-fussleiste">
      <div style={{ width: '100%', maxWidth: dialogWidths.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
        <Button variant="primary" fullWidth onClick={onAktivieren} style={{ minHeight: cssVars.touchTargets.primary }} data-primary data-testid="ton-aktivieren">{t('aktivieren.taste')}</Button>
        <span style={{ textAlign: 'center', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>{t('aktivieren.hinweis')}</span>
      </div>
    </div>
  );
}
