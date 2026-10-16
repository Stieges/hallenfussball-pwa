/**
 * Eine Spielseite für die Ansicht (A-36b, Teilplan A-36 § 2.4 „Seite“).
 *
 * - Offen: Herkunft („Zweiter Gruppe B“) bzw. „noch offen“, wenn der Platz verraten würde (@ZM-102, @BM-032);
 *   „Sieger Halbfinale 1“ verrät keinen Platz und bleibt immer (W2).
 * - Besetzt: Teamname, auch bei ausgeschalteten Tabellen (@ZM-102); klein darunter die Herkunft (@BM-014) nur,
 *   wenn sie für DIESES Team wahr ist: automatisch besetzt, „Weiterkommen festlegen“ oder Ersatzteam (@W5-010) –
 *   nie nach „Neu besetzen“ (F1). Ohne Merkmal gilt „neu besetzt“ (keine Zusatzzeile, sicher).
 * - Spielplan ohne Ergebnisse (Vorlage): in der Finalrunde immer die Herkunft des PLATZES (`originA/B`), nie ein
 *   Teamname (@DR-005); für die Leitung steht die Paarung auch bei ausgeschalteten Tabellen (@DR-018, Korrektur Daniel
 *   15.10.). Zuschauer/Monitor verraten auch in der Vorlage keinen Gruppenrang (@ZM-102, Review A-36b K4).
 */
import type { Match } from '../../types/tournament';
import type { MatchSlot, SlotSource } from '../models/schemas/MatchSlotSchema';
import { describeOrigin, describeSlot, originText, type SlotLabelContext } from './originText';
import type { SideView, ViewAudience, ViewEdition, ViewLocale, ViewRules } from './types';

export interface SideContext {
  audience: ViewAudience;
  labels: SlotLabelContext;
  locale: ViewLocale;
  rules: Pick<ViewRules, 'groupOrigin'>;
  edition: ViewEdition;
}

const UNDECIDED = { key: 'tournament:slot.undecided', vars: {} } as const;

function placeText(source: SlotSource, ctx: SideContext): string {
  return originText(describeOrigin(source, ctx.labels), ctx.locale);
}

/** Herkunft darf gezeigt werden: Sieger/Verlierer immer, Gruppenrang nur bei groupOrigin. */
function originVisible(source: SlotSource, ctx: SideContext): boolean {
  return source.kind === 'matchResult' || ctx.rules.groupOrigin;
}

/** Herkunft ist für das besetzte Team wahr (F1, M6). */
function originTrueForTeam(slot: Extract<MatchSlot, { kind: 'team' }>): boolean {
  if (slot.assignedBy === 'decided' || slot.assignedBy === 'replaced') {
    return true;
  }
  return slot.assignedBy === undefined && slot.resolvedFrom !== undefined;
}

function blankSide(origin: SlotSource | undefined, ctx: SideContext): SideView {
  // @DR-018 gilt für die Leitung (Werkzeug zum Ausfüllen); öffentlich bleibt die Schalter-Regel (@ZM-102).
  const shown = origin !== undefined && (ctx.audience === 'organizer' || originVisible(origin, ctx));
  const label = shown ? placeText(origin, ctx) : originText(UNDECIDED, ctx.locale);
  return { pending: true, ...(origin === undefined ? {} : { origin }), label };
}

export function sideView(match: Pick<Match, 'slotA' | 'slotB' | 'originA' | 'originB' | 'isFinal'>, side: 'A' | 'B', ctx: SideContext): SideView {
  const slot = side === 'A' ? match.slotA : match.slotB;
  const origin = side === 'A' ? match.originA : match.originB;
  const finalRound = match.isFinal === true || origin !== undefined;
  if (ctx.edition === 'blank' && finalRound) {
    return blankSide(origin ?? (slot.kind === 'pending' ? slot.source : undefined), ctx);
  }
  const originField = origin === undefined ? {} : { origin };
  if (slot.kind === 'pending') {
    const label = originVisible(slot.source, ctx) ? placeText(slot.source, ctx) : originText(UNDECIDED, ctx.locale);
    return { pending: true, ...originField, label };
  }
  const name = describeSlot(slot, ctx.labels);
  const label = originText(name, ctx.locale);
  const team = 'text' in name ? { teamId: slot.teamId, teamName: name.text } : {};
  const place = origin ?? slot.resolvedFrom;
  const subLabel =
    place !== undefined && originTrueForTeam(slot) && originVisible(place, ctx) ? { subLabel: placeText(place, ctx) } : {};
  return { pending: false, ...team, ...originField, label, ...subLabel };
}
