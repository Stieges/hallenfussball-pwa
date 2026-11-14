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
  'data-testid': string;
}

const kreisel: CSSProperties = {
  display: 'inline-block', width: cssVars.iconSizes.sm, height: cssVars.iconSizes.sm, borderRadius: cssVars.borderRadius.full, flex: 'none',
  border: `${cssVars.borderWidth.medium} solid currentColor`, borderRightColor: 'transparent', animation: 'spin 1s linear infinite',
};

export function ArbeitsTaste({ children, onClick, laeuft = false, variant = 'secondary', icon, 'data-testid': testId }: ArbeitsTasteProps): ReactElement {
  return (
    <Button
      variant={variant} busy={laeuft} onClick={onClick} icon={laeuft ? <span style={kreisel} /> : icon}
      style={laeuft ? { cursor: 'progress' } : undefined} data-testid={testId}
    >
      {children}
    </Button>
  );
}
