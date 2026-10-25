/**
 * Abzeichen der Tafel-Kopfzeile (Einträge warten, Helfer-Anfrage, Ton, Wachhalten): `Abzeichen` mit Tippfläche 44 px, die über die
 * Zeile hinausragt (negativer Rand), und die Maße der Kopfzeile. Gemeinsam für die Handy-Tafel (`Scoreboard`) und die Laptop-Tafel (`ScoreboardDesktop`).
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { ueberstandVon } from './scoreboardAbzeichenMasse';

/** Nur für Bildschirmleser: der volle Wortlaut eines Abzeichens, dessen sichtbarer Text verkürzt ist. */
const nurVorlesen: CSSProperties = {
  position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap', margin: `calc(-1 * ${cssVars.sizing.hairline})`, padding: 0, border: 0,
};

export function Abzeichen({ label, kurz, icon, onAntippen, testId, hoehe }: { label: string; kurz?: string; icon: ReactNode; onAntippen?: () => void; testId?: string; hoehe: string }): ReactElement {
  const marke: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, padding: `0 ${cssVars.spacing.sm}`,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.scoreboardBorder}`, borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm, fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.scoreboardText, whiteSpace: 'nowrap',
  };
  if (onAntippen === undefined) {
    // Verkürzter Text: sichtbar nur `kurz`, der volle Wortlaut bleibt für Bildschirmleser (das Abzeichen trägt weiter sein Wort bzw. seine Zahl)
    return (
      <span style={{ ...marke, position: 'relative' }} data-testid={testId}>
        {icon}
        {kurz === undefined ? label : <><span aria-hidden="true">{kurz}</span><span style={nurVorlesen}>{label}</span></>}
      </span>
    );
  }
  // Tippfläche 44 px; der negative Rand hält die Zeile in ihrer Höhe (wie das Kreuz der Meldezeile)
  const flaeche: CSSProperties = {
    minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum,
    margin: `calc(-1 * ${ueberstandVon(hoehe)}) 0`,
    padding: 0, background: 'none', border: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
  };
  return (
    <button type="button" style={flaeche} aria-label={label} onClick={onAntippen} data-testid={testId}>
      <span style={marke}>{icon}{kurz ?? label}</span>
    </button>
  );
}
