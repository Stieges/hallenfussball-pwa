/**
 * Dateiname des Spielplan-PDFs mit Stand (B-28 C3): `spielplan-<turnier-slug>-<JJJJ-MM-TT>-<HHmm>.pdf`. Der Stand
 * kommt aus dem übergebenen Zeitpunkt (Ortszeit), nie aus der Uhr: gleicher Eingang, gleicher Name.
 */
const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
const FALLBACK_SLUG = 'turnier';

const two = (n: number): string => String(n).padStart(2, '0');

/** Kleinschreibung, nur a–z und 0–9, Rest wird ein Bindestrich; ohne verwertbares Zeichen „turnier“. */
export function titleSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[äöüß]/g, char => UMLAUTS[char] ?? char)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const slug = ascii.replace(/[^a-z\d]+/g, '-').replace(/^-+|-+$/g, '');
  return slug === '' ? FALLBACK_SLUG : slug;
}

/** `spielplan-hallencup-nord-2026-11-14-1507.pdf` */
export function schedulePdfFilename(title: string, now: Date): string {
  const day = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  return `spielplan-${titleSlug(title)}-${day}-${two(now.getHours())}${two(now.getMinutes())}.pdf`;
}
