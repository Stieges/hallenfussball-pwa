/**
 * VestPieces – die Trikotfarbe des Trainingsleibchens (@ZM-161, Form E1) als drei eigene kleine Teile (links, rechts, Hals).
 *
 * Muss in einem Elternelement mit `position: relative` und `overflow: hidden` stehen (es liefert Fläche in der Leibchenfarbe und
 * rundet die Ecken ab). Jedes Teil ist nur so groß wie es selbst: keine Zeichnung über den ganzen Kasten (sie würde als Überlagerung
 * der Ziffer gemessen). Dekorativ, kein eigener zugänglicher Name; der Kasten nennt das Leibchen in seinem `aria-label`.
 */
import type { CSSProperties, ReactElement } from 'react';
import { vestPieceBox, vestPieces, type VestSize } from './vestShape';

export interface VestPiecesProps {
  size: VestSize;
  /** Trikotfarbe, `#RRGGBB` oder jede CSS-Farbe */
  color: string;
}

const pieceStyle = (color: string, box: ReturnType<typeof vestPieceBox>): CSSProperties => ({
  position: 'absolute',
  display: 'block',
  backgroundColor: color,
  pointerEvents: 'none',
  ...box,
});

export function VestPieces({ size, color }: VestPiecesProps): ReactElement {
  return (
    <>
      {vestPieces(size).map((points, index) => (
        <i key={index} data-teil="" aria-hidden="true" style={pieceStyle(color, vestPieceBox(points))} />
      ))}
    </>
  );
}
