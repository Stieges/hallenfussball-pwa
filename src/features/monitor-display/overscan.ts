/**
 * Bildrand der Monitor-Folien in Prozent (@ME-067, @ME-020).
 *
 * React-frei. Der gespeicherte Rand (`TournamentMonitor.overscanPercent`) gilt, bis die Adresse mit `?rand=<Prozent>`
 * ihn nur für diese Sitzung überschreibt (Messung, Generalprobe). Werte außerhalb 0–10 oder Nicht-Zahlen werden
 * ignoriert; der gespeicherte Wert gilt dann weiter.
 */
import { displayMonitor } from '../../design-tokens';
import type { CSSProperties } from 'react';

const { defaultPercent, minPercent, maxPercent, urlParam } = displayMonitor.overscan;

/** Ist `value` ein gültiger Bildrand in Prozent (Zahl, 0 bis 10)? */
export function istGueltigerRand(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minPercent && value <= maxPercent;
}

/** Liest `?rand=` aus dem Hash (HashRouter) oder, als Rückfall, aus der Adresse davor. `null` = kein gültiger Wert. */
export function randAusAdresse(hash: string, search: string): number | null {
  const imHash = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  for (const query of [imHash, search]) {
    const roh = new URLSearchParams(query).get(urlParam);
    if (roh === null || roh.trim() === '') { continue; }
    const wert = Number(roh);
    if (istGueltigerRand(wert)) { return wert; }
  }
  return null;
}

/** Wirksamer Rand: gültiger Adressparameter vor gespeichertem Wert vor Vorbelegung. */
export function wirksamerRand(gespeichert: number | undefined, adressRand: number | null): number {
  if (adressRand !== null) { return adressRand; }
  return istGueltigerRand(gespeichert) ? gespeichert : defaultPercent;
}

/**
 * Innenabstand der Folie: oben/unten in Prozent der Folienhöhe, links/rechts in Prozent der Folienbreite.
 * `cqh`/`cqw` beziehen sich auf den Größen-Container um die Folie (Monitor-Seite); ohne Container gelten
 * Viewport-Einheiten, auf der Monitor-Seite (Vollfläche) dieselbe Fläche.
 */
export function randPadding(prozent: number): Pick<CSSProperties, 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight'> {
  const hoch = `${prozent}cqh`;
  const breit = `${prozent}cqw`;
  return { paddingTop: hoch, paddingBottom: hoch, paddingLeft: breit, paddingRight: breit };
}

/** Rand in Bildpunkten für den Pixel-Shift (Einbrennschutz): höchstens 2, ohne Rand keine Verschiebung (@ME-019). */
export function maxPixelVerschiebung(prozent: number, folieHoeheBildpunkte: number): number {
  return Math.min(2, Math.floor((prozent / 100) * folieHoeheBildpunkte / 4));
}

/**
 * Sicherer Bereich der Seite: die Fläche innerhalb des Bildrands. Einblendungen der Seite (Hinweise in einer Ecke) liegen
 * darin und nicht am Bildrand. `contain: layout` macht den Bereich zum Bezugsrahmen auch für `position: fixed`-Kinder,
 * sodass ihre Ecke die Ecke des sicheren Bereichs ist.
 */
export function sichererBereichStyle(prozent: number): CSSProperties {
  return {
    position: 'absolute',
    top: `${prozent}cqh`,
    bottom: `${prozent}cqh`,
    left: `${prozent}cqw`,
    right: `${prozent}cqw`,
    contain: 'layout',
    pointerEvents: 'none',
  };
}
