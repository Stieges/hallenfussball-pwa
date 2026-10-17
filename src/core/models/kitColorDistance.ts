/**
 * Farbabstand zweier Trikotfarben (A-30a, @SL-139): CIEDE2000 (ΔE2000) im CIELAB-Raum, Weißpunkt D65,
 * Gewichte kL = kC = kH = 1. Rein und framework-frei.
 *
 * Eingabe sind normalisierte Hex-Farben `#RRGGBB` (siehe `normalizeKitColor` in `kit.ts`).
 * Formel nach Sharma, Wu, Dalal (2005), „The CIEDE2000 Color-Difference Formula“.
 */

interface Lab {
  l: number;
  a: number;
  b: number;
}

/** sRGB-Kanal (0–255) → linear (IEC 61966-2-1). */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Referenzweiß D65 (2°) für die Lab-Umrechnung. */
const WHITE_D65 = { x: 0.95047, y: 1, z: 1.08883 };

function labPivot(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

/** `#RRGGBB` → CIELAB (D65). */
export function hexToLab(hex: string): Lab {
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_D65.x;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE_D65.y;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE_D65.z;
  const fx = labPivot(x);
  const fy = labPivot(y);
  const fz = labPivot(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const DEG = Math.PI / 180;

/** Farbton-Winkel in Grad (0–360). */
function hueDegrees(b: number, a: number): number {
  if (a === 0 && b === 0) {
    return 0;
  }
  const h = Math.atan2(b, a) / DEG;
  return h >= 0 ? h : h + 360;
}

/** ΔE2000 zweier CIELAB-Farben. */
export function deltaE2000(first: Lab, second: Lab): number {
  const c1 = Math.hypot(first.a, first.b);
  const c2 = Math.hypot(second.a, second.b);
  const cMean7 = Math.pow((c1 + c2) / 2, 7);
  const g = 0.5 * (1 - Math.sqrt(cMean7 / (cMean7 + Math.pow(25, 7))));
  const a1 = (1 + g) * first.a;
  const a2 = (1 + g) * second.a;
  const c1p = Math.hypot(a1, first.b);
  const c2p = Math.hypot(a2, second.b);
  const h1p = hueDegrees(first.b, a1);
  const h2p = hueDegrees(second.b, a2);

  const dL = second.l - first.l;
  const dC = c2p - c1p;
  let dh = 0;
  if (c1p * c2p !== 0) {
    dh = h2p - h1p;
    if (dh > 180) {
      dh -= 360;
    } else if (dh < -180) {
      dh += 360;
    }
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dh / 2) * DEG);

  const lMean = (first.l + second.l) / 2;
  const cMean = (c1p + c2p) / 2;
  let hMean = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) {
      hMean = (h1p + h2p) / 2;
    } else {
      hMean = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    }
  }

  const t =
    1 -
    0.17 * Math.cos((hMean - 30) * DEG) +
    0.24 * Math.cos(2 * hMean * DEG) +
    0.32 * Math.cos((3 * hMean + 6) * DEG) -
    0.2 * Math.cos((4 * hMean - 63) * DEG);
  const dTheta = 30 * Math.exp(-Math.pow((hMean - 275) / 25, 2));
  const cMeanP7 = Math.pow(cMean, 7);
  const rc = 2 * Math.sqrt(cMeanP7 / (cMeanP7 + Math.pow(25, 7)));
  const lShift = Math.pow(lMean - 50, 2);
  const sl = 1 + (0.015 * lShift) / Math.sqrt(20 + lShift);
  const sc = 1 + 0.045 * cMean;
  const sh = 1 + 0.015 * cMean * t;
  const rt = -Math.sin(2 * dTheta * DEG) * rc;

  return Math.sqrt(
    Math.pow(dL / sl, 2) + Math.pow(dC / sc, 2) + Math.pow(dH / sh, 2) + rt * (dC / sc) * (dH / sh),
  );
}

/** ΔE2000 zweier normalisierter Hex-Farben `#RRGGBB`. */
export function hexDeltaE2000(first: string, second: string): number {
  return deltaE2000(hexToLab(first), hexToLab(second));
}
