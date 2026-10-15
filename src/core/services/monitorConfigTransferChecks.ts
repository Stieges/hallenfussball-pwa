/**
 * Prüfungen und Entscheidungen beim Übernehmen von Monitoren (B-22b, @ME-061 bis @ME-063). Rein, kein React.
 * - Folien mit Feld/Gruppe, die das Zielturnier nicht hat (@ME-061)
 * - Eigener QR-Link: aus Turnier mitnehmen (http/https), aus Datei verwerfen (@ME-063)
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import type { Tournament } from '../../types/tournament';
import type { MonitorConfigPayload, TransferSlide } from './monitorConfigTransfer';

/** Ziel der Umstellung „Auf Feld 1 umstellen“ (@ME-061) */
export const REASSIGN_FIELD_ID = 'field-1';

/** Felder und Gruppen, die ein Turnier hat (Ids, wie die Folien sie referenzieren) */
export interface SlotTargets {
  fieldIds: readonly string[];
  groupIds: readonly string[];
}

type TournamentSlotSource = Partial<Pick<Tournament, 'fields' | 'numberOfFields' | 'groups' | 'numberOfGroups'>>;

/** Gleiche Regeln wie der Monitor-Editor: Felder aus `fields`, sonst aus der Anzahl; Gruppen wie dort */
export function tournamentSlotTargets(tournament: TournamentSlotSource): SlotTargets {
  const fieldIds = tournament.fields?.length
    ? tournament.fields.map(f => f.id)
    : Array.from({ length: Math.max(1, tournament.numberOfFields ?? 1) }, (_, i) => `field-${i + 1}`);

  let groupIds: string[];
  if (tournament.groups && tournament.groups.length > 0) {
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
  /** Eigene Links aus einer Datei (@ME-063) */
  fromFile: number;
  /** Eigene Links mit einer Adresse, die nicht http/https ist */
  invalidUrl: number;
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) {return false;}
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Eigener QR-Link (@ME-063): aus einer Datei wird er nie übernommen; aus einem Turnier nur, wenn
 * die Adresse http/https ist. Übernommen wird dann die Standardeinstellung (Zuschauer-Seite).
 */
export function sanitizeCustomQr(
  payload: MonitorConfigPayload,
  source: 'tournament' | 'file',
): { payload: MonitorConfigPayload; skipped: CustomQrSkipped } {
  const skipped: CustomQrSkipped = { fromFile: 0, invalidUrl: 0 };
  const monitors = payload.monitors.map(monitor => ({
    ...monitor,
    slides: monitor.slides.map((slide): TransferSlide => {
      if (slide.config.qrTarget !== 'custom') {return slide;}
      if (source === 'file') {
        skipped.fromFile += 1;
      } else if (!isHttpUrl(slide.config.customQrUrl)) {
        skipped.invalidUrl += 1;
      } else {
        return slide;
      }
      const { qrTarget: _qr, customQrUrl: _url, ...config } = slide.config;
      return { ...slide, config };
    }),
  }));
  return { payload: { ...payload, monitors }, skipped };
}
