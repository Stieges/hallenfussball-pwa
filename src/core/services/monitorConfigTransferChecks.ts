/**
 * Prüfungen und Entscheidungen beim Übernehmen von Monitoren (B-22b, @ME-061 bis @ME-063). Rein, kein React.
 * - Folien mit Feld/Gruppe, die das Zielturnier nicht hat (@ME-061)
 * - Eigener QR-Link: aus Turnier mitnehmen (http/https), aus Datei verwerfen (@ME-063)
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import type { Tournament, TournamentField } from '../../types/tournament';
import { createDefaultFields } from '../../utils/displayNames';
import { isSingleGroupId, standingsGroups } from '../models/standingsGroups';
import type { MonitorConfigPayload, TransferSlide } from './monitorConfigTransfer';

/** Ziel der Umstellung „Auf Feld 1 umstellen“ (@ME-061) */
export const REASSIGN_FIELD_ID = 'field-1';

/** Felder und Gruppen, die ein Turnier hat (Ids, wie die Folien sie referenzieren) */
export interface SlotTargets {
  fieldIds: readonly string[];
  groupIds: readonly string[];
}

type TournamentSlotSource = Partial<Pick<Tournament, 'fields' | 'numberOfFields' | 'groups' | 'numberOfGroups' | 'groupSystem' | 'teams'>>;

/**
 * Felder des Turniers, wie der Monitor-Editor sie zeigt und die Übernahme-Prüfung sie kennt:
 * `fields`, sonst field-1 … field-N aus der Anzahl (K4, gemeinsame Quelle).
 */
export function tournamentFieldList(tournament: Partial<Pick<Tournament, 'fields' | 'numberOfFields'>>): TournamentField[] {
  return tournament.fields?.length
    ? tournament.fields
    : createDefaultFields(Math.max(1, tournament.numberOfFields ?? 1));
}

/**
 * Gruppen, zu denen tatsächlich Teams gehören (sortiert, ohne Dubletten). Leer, wenn kein Team eine Gruppe hat – dann gibt es keine
 * Zuordnung, aus der sich Gruppen ableiten ließen. Die Monitor-Angebote richten sich nach dieser Zuordnung, nicht nach
 * gespeicherten Standardgruppen (@ZM-181, @ZM-177; Befund C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN).
 */
export function assignedGroupIds(teams: readonly { group?: string }[] | undefined): string[] {
  // EINE Regel für die Zuordnung (`standingsGroups`/`groupKeyOf`, wie die Monitor-Folie): leer, fehlend und 'all' sind „keine Gruppe“
  return standingsGroups(teams ?? []).map((g) => g.group).filter((id) => !isSingleGroupId(id));
}

/** Gleiche Regeln wie der Monitor-Editor: Felder wie `tournamentFieldList`; Gruppen wie dort */
export function tournamentSlotTargets(tournament: TournamentSlotSource): SlotTargets {
  const fieldIds = tournamentFieldList(tournament).map(f => f.id);

  let groupIds: string[];
  if (tournament.groupSystem === 'roundRobin') {
    // Jeder gegen Jeden: eine Gruppe, auch wenn noch eine Gruppenzahl gespeichert ist (K2)
    groupIds = ['default'];
  } else if (assignedGroupIds(tournament.teams).length > 0) {
    groupIds = assignedGroupIds(tournament.teams);
  } else if (tournament.groups && tournament.groups.length > 0) {
    groupIds = tournament.groups.map(g => g.id);
  } else {
    const numGroups = tournament.numberOfGroups ?? 1;
    groupIds = numGroups <= 1
      ? ['default']
      : Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i));
  }
  return { fieldIds, groupIds };
}

export type SlideReferenceProblem = 'field' | 'group';

interface ReferencingSlide {
  type: string;
  config: { fieldId?: string; groupId?: string };
}

/** Welche Referenz einer Folie im Zielturnier fehlt (null = alles vorhanden oder keine Referenz) */
export function slideReferenceProblem(slide: ReferencingSlide, targets: SlotTargets): SlideReferenceProblem | null {
  const { fieldId, groupId } = slide.config;
  if ((slide.type === 'live' || slide.type === 'schedule-field') && fieldId && !targets.fieldIds.includes(fieldId)) {
    return 'field';
  }
  if ((slide.type === 'standings' || slide.type === 'schedule-group') && groupId && !targets.groupIds.includes(groupId)) {
    return 'group';
  }
  return null;
}

/** Entscheidung je Folie; ohne Entscheidung bleibt die Folie (@ME-061) */
export type SlideFix = 'reassign-field' | 'all-groups' | 'remove';

export interface ReferenceIssue {
  /** Schlüssel „Monitor:Folie“ in der Payload-Reihenfolge */
  key: string;
  problem: SlideReferenceProblem;
  slideType: TransferSlide['type'];
  /** Fehlende Id, z. B. „field-2“ oder „C“ */
  missingId: string;
  fixes: SlideFix[];
}

export function slideKey(monitorIndex: number, slideIndex: number): string {
  return `${monitorIndex}:${slideIndex}`;
}

/** Alle Folien der Payload, deren Feld oder Gruppe im Zielturnier fehlt, mit den Entscheidungen, die es gibt */
export function findReferenceIssues(payload: MonitorConfigPayload, targets: SlotTargets): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  payload.monitors.forEach((monitor, mi) => {
    monitor.slides.forEach((slide, si) => {
      const problem = slideReferenceProblem(slide, targets);
      if (!problem) {return;}
      const missingId = problem === 'field' ? String(slide.config.fieldId) : String(slide.config.groupId);
      let fixes: SlideFix[] = ['remove'];
      if (problem === 'field') {fixes = ['reassign-field', 'remove'];}
      if (problem === 'group' && slide.type === 'standings') {fixes = ['all-groups', 'remove'];}
      issues.push({ key: slideKey(mi, si), problem, slideType: slide.type, missingId, fixes });
    });
  });
  return issues;
}

/** Wendet die getroffenen Entscheidungen an; nicht entschiedene Folien bleiben unverändert */
export function applySlideFixes(payload: MonitorConfigPayload, fixes: Readonly<Record<string, SlideFix>>): MonitorConfigPayload {
  return {
    ...payload,
    monitors: payload.monitors.map((monitor, mi) => ({
      ...monitor,
      slides: monitor.slides.flatMap((slide, si): TransferSlide[] => {
        const fix = fixes[slideKey(mi, si)];
        if (fix === 'remove') {return [];}
        if (fix === 'reassign-field') {return [{ ...slide, config: { ...slide.config, fieldId: REASSIGN_FIELD_ID } }];}
        if (fix === 'all-groups') {
          const { groupId: _ignored, ...rest } = slide.config;
          return [{ ...slide, type: 'all-standings', config: rest }];
        }
        return [slide];
      }),
    })),
  };
}

export interface CustomQrSkipped {
  /** Eigene Links mit einer Adresse, die nicht http/https ist (aus Turnier oder Datei) */
  invalidUrl: number;
}

/** Eigener Link aus einer Datei, der übernommen wird und zum Prüfen angezeigt wird (@ME-063) */
export interface FileCustomQrLink {
  /** Schlüssel „Monitor:Folie“ in der Payload-Reihenfolge */
  key: string;
  url: string;
}

/** Normalisierte http/https-Adresse (@ME-063): Leerzeichen am Rand weg, Schema klein; sonst null */
function normalizeHttpUrl(value: string | undefined): string | null {
  if (!value) {return null;}
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {return null;}
  } catch {
    return null;
  }
  return trimmed.replace(/^[a-z]+:/i, scheme => scheme.toLowerCase());
}

/**
 * Eigener QR-Link (@ME-063): eine Adresse, die nicht http/https ist, wird immer verworfen und gemeldet.
 * Gültige Links bleiben; aus einer Datei werden sie zum Prüfen gelistet.
 */
export function sanitizeCustomQr(
  payload: MonitorConfigPayload,
  source: 'tournament' | 'file',
): { payload: MonitorConfigPayload; skipped: CustomQrSkipped; fileLinks: FileCustomQrLink[] } {
  const skipped: CustomQrSkipped = { invalidUrl: 0 };
  const fileLinks: FileCustomQrLink[] = [];
  const monitors = payload.monitors.map((monitor, mi) => ({
    ...monitor,
    slides: monitor.slides.map((slide, si): TransferSlide => {
      if (slide.config.qrTarget !== 'custom') {return slide;}
      const url = normalizeHttpUrl(slide.config.customQrUrl);
      if (url === null) {
        skipped.invalidUrl += 1;
        const { qrTarget: _qr, customQrUrl: _url, ...config } = slide.config;
        return { ...slide, config };
      }
      if (source === 'file') {fileLinks.push({ key: slideKey(mi, si), url });}
      return { ...slide, config: { ...slide.config, customQrUrl: url } };
    }),
  }));
  return { payload: { ...payload, monitors }, skipped, fileLinks };
}

/** „Link entfernen“ (@ME-063): die gewählten Folien zeigen danach auf das QR-Ziel „Turnier“ */
export function applyCustomQrRemovals(payload: MonitorConfigPayload, keys: ReadonlySet<string>): MonitorConfigPayload {
  if (keys.size === 0) {return payload;}
  return {
    ...payload,
    monitors: payload.monitors.map((monitor, mi) => ({
      ...monitor,
      slides: monitor.slides.map((slide, si): TransferSlide => {
        if (!keys.has(slideKey(mi, si))) {return slide;}
        const { customQrUrl: _url, ...config } = slide.config;
        return { ...slide, config: { ...config, qrTarget: 'tournament' } };
      }),
    })),
  };
}
