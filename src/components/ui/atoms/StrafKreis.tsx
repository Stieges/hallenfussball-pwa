/**
 * StrafKreis – eine laufende Zeitstrafe als Kreis mit Rückennummer und ablaufendem Ring (@ZM-182, @ZM-192; Mockup
 * zeitstrafe-monitor Variante A). Der Ring zeigt den noch zu verbüßenden Anteil (im Uhrzeigersinn ab 12 Uhr), der
 * abgelaufene Teil ist die Spur. Ohne Rückennummer bleibt die Scheibe leer. Kein Wort, keine Ziffern-Restzeit: die
 * Restzeit steht nur für Bildschirmleser im `ariaLabel`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';

export interface StrafKreisProps {
  nummer: number | null;
  /** Noch zu verbüßender Anteil 0 bis 1 */
  anteil: number;
  /** Durchmesser als Token (z. B. `displayLayout.scoreArea.monitorCup`) */
  durchmesser: string;
  /** Schmaler Rand in der Scheibenfarbe um den Kreis (trennt ihn vom Kasten), als Token */
  rand: string;
  /** Ringbreite und Zifferngröße als Anteil des Durchmessers */
  ringAnteil: number;
  zifferAnteil: number;
  farben: { ring: string; spur: string; scheibe: string; text: string };
  /** Die Uhr steht: der Ring ist grau wie der angehaltene Zeitbalken */
  steht: boolean;
  ariaLabel: string;
}

const PROZENT = 100;

export function StrafKreis({ nummer, anteil, durchmesser, rand, ringAnteil, zifferAnteil, farben, steht, ariaLabel }: StrafKreisProps): ReactElement {
  const voll = Math.max(0, Math.min(1, anteil));
  const ring = steht ? cssVars.colors.scoreboardNeutral : farben.ring;
  const kreis: CSSProperties = {
    width: durchmesser,
    height: durchmesser,
    flex: 'none',
    boxSizing: 'border-box',
    borderRadius: cssVars.borderRadius.full,
    padding: `calc(${durchmesser} * ${ringAnteil})`,
    background: `conic-gradient(${ring} 0 ${(voll * PROZENT).toFixed(2)}%, ${farben.spur} 0)`,
    boxShadow: `0 0 0 ${rand} ${farben.scheibe}`,
  };
  const scheibe: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: cssVars.borderRadius.full,
    background: farben.scheibe,
    color: farben.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `calc(${durchmesser} * ${zifferAnteil})`,
    fontWeight: cssVars.fontWeights.bold,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  };
  return (
    <span
      style={kreis}
      role="img"
      aria-label={ariaLabel}
      data-zeitstrafe={nummer ?? ''}
      data-anteil={voll.toFixed(3)}
      data-steht={steht ? 'true' : 'false'}
    >
      <span style={scheibe} aria-hidden="true">{nummer ?? ''}</span>
    </span>
  );
}
