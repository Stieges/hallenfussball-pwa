/**
 * ArbeitsTaste – Taste an einem Hinweis, die ein Problem löst („Erneut versuchen“, „Ton aktivieren“, „Jetzt aktualisieren“ …, @OB-087).
 * Mindestens 44 Bildpunkte hoch (`Button`). Solange der Versuch läuft (`laeuft`), ist sie gesperrt (`aria-busy`, der Fokus bleibt) und zeigt
 * einen Kreisel vor der Beschriftung – nie Farbe allein. Nur Darstellung: die Sperre gegen Doppelauslösen liegt im Aufrufer (`useSperreAktion`).
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../Button';

export interface ArbeitsTasteProps {
  children: ReactNode;
  onClick: () => void;
  laeuft?: boolean;
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
  /**
   * Steht in einem `HinweisMitTaste` (@OB-087): 44 px hoch, mindestens `xxl` × 3 breit (der Aufrufer kann `--hinweis-taste-min` enger setzen; bleibt im Zustand „läuft“ gleich breit), Fläche in Seitenfarbe,
   * 2-px-Rand im Ton des Hinweises (`--hinweis-bedien`), Schrift in der normalen Textfarbe. Läuft der Versuch, ist der Rand gestrichelt (nicht Farbe allein).
   */
  imHinweis?: boolean;
  'data-testid': string;
}

const kreisel: CSSProperties = {
  display: 'inline-block', width: cssVars.iconSizes.sm, height: cssVars.iconSizes.sm, borderRadius: cssVars.borderRadius.full, flex: 'none',
  border: `${cssVars.borderWidth.medium} solid currentColor`, borderRightColor: 'transparent', animation: 'spin 1s linear infinite',
};

const imHinweisStil: CSSProperties = {
  // Breite und Polster lassen sich für einen engen Ort setzen (`--hinweis-taste-min`, `--hinweis-taste-polster`, z. B. der Kasten im Cockpit auf dem kleinen Handy);
  // ohne Vorgabe: mindestens xxl × 3, Polster md
  minWidth: `var(--hinweis-taste-min, calc(${cssVars.spacing.xxl} * 3))`, padding: `0 var(--hinweis-taste-polster, ${cssVars.spacing.md})`, background: cssVars.colors.background,
  color: cssVars.colors.textPrimary, border: `${cssVars.borderWidth.medium} solid var(--hinweis-bedien, ${cssVars.colors.borderControl})`,
};

export function ArbeitsTaste({ children, onClick, laeuft = false, variant = 'secondary', icon, imHinweis = false, 'data-testid': testId }: ArbeitsTasteProps): ReactElement {
  const stil: CSSProperties = {
    ...(imHinweis ? imHinweisStil : {}),
    ...(imHinweis && laeuft ? { borderStyle: 'dashed' } : {}),
    ...(laeuft ? { cursor: 'progress' } : {}),
  };
  return (
    <Button
      variant={variant} busy={laeuft} onClick={onClick} icon={laeuft ? <span style={kreisel} /> : icon}
      style={Object.keys(stil).length === 0 ? undefined : stil} data-testid={testId}
    >
      {children}
    </Button>
  );
}
