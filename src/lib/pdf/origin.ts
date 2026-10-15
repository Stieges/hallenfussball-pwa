/**
 * Herkunft offener Plätze im Klartext (B-28 C4, Befund Zuschauer-Zuordnung Punkt 2; @DR-001 Ausnahmeliste, @BM-032).
 * Rein. Rohschlüssel des Generators wie `group-a-2nd` oder `semi1-winner` werden nie gedruckt: sie werden in der
 * Sprache des Dokuments zu „Zweiter Gruppe A“ bzw. „Sieger Halbfinale 1“. Alles andere (Teamnamen, bereits
 * übersetzte Herkunft) bleibt unverändert.
 */
import type { PdfTexts } from './translations';

const GROUP_PLACE = /^group-(?<group>[a-z])-(?<place>\d+)(?:st|nd|rd|th)$/i;
const ROUND_SLOT = /^(?<round>r16|qf|semi)-?(?<n>\d+)-(?<kind>winner|loser)$/i;
/** Älteres Format `winner-qf-1`, `loser-sf-2`. */
const LEGACY_SLOT = /^(?<kind>winner|loser)-(?<round>qf|sf)-(?<n>\d+)$/i;

export type OriginRound = 'r16' | 'qf' | 'semi';
export type OriginKind = 'winner' | 'loser';

/** Klartext der Herkunft; ein Wert, der kein Rohschlüssel ist, kommt unverändert zurück. */
export function originLabel(raw: string, t: PdfTexts): string {
  const group = GROUP_PLACE.exec(raw)?.groups;
  if (group) {
    return t.origin.groupPlace(Number(group.place), group.group.toUpperCase());
  }
  const slot = (ROUND_SLOT.exec(raw) ?? LEGACY_SLOT.exec(raw))?.groups;
  if (slot) {
    const round = slot.round.toLowerCase() === 'sf' ? 'semi' : slot.round.toLowerCase();
    return t.origin.fromRound(slot.kind.toLowerCase() as OriginKind, round as OriginRound, Number(slot.n));
  }
  return raw;
}
