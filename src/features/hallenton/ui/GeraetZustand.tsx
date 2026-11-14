/**
 * GeraetZustand – der große Stand dieses Geräts als Hallen-Lautsprecher (H4-10, G7; @HT-011, @HT-013, @HT-014, @HT-033 Zeile 8, @HT-037): ein Statuswort
 * (28/48 px) mit Symbol, darunter der Satz (Feld und Gerät oder Grund). Er ersetzt den kleinen Banner aus H4-9. Der Zustand steht nie nur in der Farbe:
 * Wort, Symbol und Randart tragen ihn (VISUAL-DESIGN § 7); „läuft schon in einem anderen Fenster“ ist ruhig (Info-Ton, keine Warnfarbe).
 * Nur Darstellung mit Props; die Wortlaute baut `geraetBanner.ts`. Die Taste „Ton aktivieren“ steht in der Fußleiste, nicht hier.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import type { GeraetBanner, GeraetBannerArt } from './geraetBanner';
import styles from './GeraetZustand.module.css';

export interface GeraetZustandProps {
  banner: GeraetBanner;
}

interface Aussehen { rand: string; flaeche: string; symbol: string; randart: CSSProperties['borderStyle'] }

const AUSSEHEN: Record<GeraetBanner['ton'], Aussehen> = {
  ok: { rand: cssVars.colors.primary, flaeche: cssVars.colors.primaryLight, symbol: cssVars.colors.primary, randart: 'solid' },
  warn: { rand: cssVars.colors.warningSolid, flaeche: cssVars.colors.warningLight, symbol: cssVars.colors.warningSolid, randart: 'solid' },
  info: { rand: cssVars.colors.info, flaeche: cssVars.colors.infoLight, symbol: cssVars.colors.info, randart: 'solid' },
  neutral: { rand: cssVars.colors.borderControl, flaeche: cssVars.colors.background, symbol: cssVars.colors.textSecondary, randart: 'dashed' },
};

const SYMBOL_GROESSE = iconSizeValues.xl;
const SYMBOL: Partial<Record<GeraetBannerArt, ReactNode>> & Record<'ok' | 'warn' | 'info' | 'neutral', ReactNode> = {
  ok: <Icons.CheckCircle size={SYMBOL_GROESSE} />,
  warn: <Icons.AlertTriangle size={SYMBOL_GROESSE} />,
  info: <Icons.Info size={SYMBOL_GROESSE} />,
  neutral: <Icons.Info size={SYMBOL_GROESSE} />,
  keineVerbindung: <Icons.WifiOff size={SYMBOL_GROESSE} />,
  schlafenGelegt: <Icons.Moon size={SYMBOL_GROESSE} />,
  lautstaerkeNull: <Icons.SpeakerOff size={SYMBOL_GROESSE} />,
};

const unterStil: CSSProperties = { gridColumn: '1 / -1', fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere' };

export function GeraetZustand({ banner }: GeraetZustandProps): ReactElement {
  const a = AUSSEHEN[banner.ton];
  const stil: CSSProperties = {
    display: 'grid', gridTemplateColumns: `auto minmax(0, 1fr)`, gap: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, alignItems: 'center', padding: cssVars.spacing.md,
    border: `${cssVars.borderWidth.medium} ${a.randart} ${a.rand}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: a.flaeche, color: cssVars.colors.textPrimary,
  };
  return (
    <div role="status" style={stil} data-testid={`geraet-banner-${banner.art}`} data-zustand={banner.art} data-ton={banner.ton}>
      <span style={{ display: 'inline-flex', color: a.symbol }} aria-hidden="true">{SYMBOL[banner.art] ?? SYMBOL[banner.ton]}</span>
      <p className={styles.wort}>{banner.titel}</p>
      <p style={{ ...unterStil, margin: 0 }}>{banner.text}</p>
    </div>
  );
}
