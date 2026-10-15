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

/** Ist `raw` der Rohschlüssel eines Gruppenplatzes (`group-a-2nd`)? Sieger und Verlierer einer Runde sind es nicht. */
export function isGroupOrigin(raw: string): boolean {
  return GROUP_PLACE.test(raw);
}

/**
 * Klartext der Herkunft; ein Wert, der kein Rohschlüssel ist, kommt unverändert zurück. `groupName` liefert den
 * Anzeigenamen einer Gruppe (eigene Namen des Turniers); ohne ihn gilt „Gruppe X“ in der Sprache des Dokuments.
 */
export function originLabel(raw: string, t: PdfTexts, groupName?: (id: string) => string): string {
  const group = GROUP_PLACE.exec(raw)?.groups;
  if (group) {
    const id = group.group.toUpperCase();
    return t.origin.groupPlace(Number(group.place), groupName ? groupName(id) : t.groupLabel(id, `Gruppe ${id}`));
  }
  const slot = (ROUND_SLOT.exec(raw) ?? LEGACY_SLOT.exec(raw))?.groups;
  if (slot) {
    const round = slot.round.toLowerCase() === 'sf' ? 'semi' : slot.round.toLowerCase();
    return t.origin.fromRound(slot.kind.toLowerCase() as OriginKind, round as OriginRound, Number(slot.n));
  }
  return raw;
}
