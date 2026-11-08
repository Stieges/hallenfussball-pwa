/**
 * Form des Trainingsleibchens (@ZM-161, Mockup leibchen-weste-3 Form E1): gerade Seiten, gerade schräge Armausschnitte, runder Halsausschnitt.
 *
 * Der Grund der Fläche ist die Leibchenfarbe; die Trikotfarbe liegt als drei eigene kleine Teile darauf: links und rechts außerhalb des
 * Leibchens (Schulter, Arm, Seite) und im Halsausschnitt. Alle Maße kommen aus `displayLayout.scoreArea.vest`; die Punkte hier sind
 * Prozent der Kastenbreite (x) bzw. -höhe (y). Reine Rechnung, kein React.
 */
import { displayLayout } from '../../../design-tokens';

export type VestSize = 'large' | 'small' | 'cockpit';
export type VestPoint = readonly [number, number];
/** Ein Teil als Vieleck; ein dritter Wert an einem Punkt rundet diese Ecke mit dem Radius (in Prozent) ab, Punkte ohne Radius bleiben scharf (Kastenkanten). */
type CornerPoint = readonly [number, number, number?];

const V = displayLayout.scoreArea.vest;
const FULL = 100;
const MIDDLE = FULL / 2;

function mirror(points: readonly VestPoint[]): VestPoint[] {
  return points.map(([x, y]) => [FULL - x, y] as const);
}

function bezier(p0: VestPoint, c1: VestPoint, c2: VestPoint, p1: VestPoint, steps: number): VestPoint[] {
  const out: VestPoint[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ] as const);
  }
  return out;
}

/** Ecken mit Radius werden durch einen kleinen Bogen ersetzt. */
function rounded(points: readonly CornerPoint[]): VestPoint[] {
  const out: VestPoint[] = [];
  const n = points.length;
  const towards = (from: CornerPoint, to: CornerPoint, radius: number): VestPoint => {
    const dx = from[0] - to[0];
    const dy = from[1] - to[1];
    const length = Math.hypot(dx, dy);
    const t = Math.min(radius / length, 0.45);
    return [to[0] + dx * t, to[1] + dy * t];
  };
  points.forEach((p, i) => {
    const radius = p[2];
    if (radius === undefined || radius === 0) {
      out.push([p[0], p[1]]);
      return;
    }
    const start = towards(points[(i - 1 + n) % n] ?? p, p, radius);
    const end = towards(points[(i + 1) % n] ?? p, p, radius);
    out.push(start);
    for (let k = 1; k <= V.cornerSteps; k += 1) {
      const t = k / (V.cornerSteps + 1);
      const u = 1 - t;
      out.push([u * u * start[0] + 2 * u * t * p[0] + t * t * end[0], u * u * start[1] + 2 * u * t * p[1] + t * t * end[1]]);
    }
    out.push(end);
  });
  return out;
}

/** Die drei Teile der Trikotfarbe (links, rechts, Hals) in Kastenprozent. */
export function vestPieces(size: VestSize): VestPoint[][] {
  const { edge, strap, armRise, neckHalf, neckDepth } = V[size];
  const left = rounded([[0, 0], [strap, 0], [edge, armRise, V.armCorner], [edge, FULL], [0, FULL]]);
  const span = FULL - 2 * neckHalf;
  const shoulder = neckDepth * V.neckShoulder;
  const right = FULL - neckHalf;
  const neck: VestPoint[] = [
    [neckHalf, 0],
    [right, 0],
    [right, shoulder],
    ...bezier([right, shoulder], [right, neckDepth * V.neckCurve], [MIDDLE + span * V.neckBelly, neckDepth], [MIDDLE, neckDepth], V.neckSteps),
    ...bezier([MIDDLE, neckDepth], [MIDDLE - span * V.neckBelly, neckDepth], [neckHalf, neckDepth * V.neckCurve], [neckHalf, shoulder], V.neckSteps),
  ];
  return [left, mirror(left), neck];
}

/** Stellt das Teil als Rechteck um seine Punkte mit Zuschnitt dar: Lage und Maße in Kastenprozent, `clipPath` in Prozent des Rechtecks. */
export interface VestPieceBox {
  left: string;
  top: string;
  width: string;
  height: string;
  clipPath: string;
}

const DIGITS = 2;
const pct = (value: number): string => `${value.toFixed(DIGITS)}%`;

export function vestPieceBox(points: readonly VestPoint[]): VestPieceBox {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const width = Math.max(...xs) - x0;
  const height = Math.max(...ys) - y0;
  const polygon = points.map((p) => `${pct(((p[0] - x0) / width) * FULL)} ${pct(((p[1] - y0) / height) * FULL)}`).join(', ');
  return { left: pct(x0), top: pct(y0), width: pct(width), height: pct(height), clipPath: `polygon(${polygon})` };
}
