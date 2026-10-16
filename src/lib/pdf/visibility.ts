/**
 * Sichtbarkeit im Spielplan-PDF (B-28 C5, @BM-032, @BM-054, @DR-018). Rein: keine Zeichnung, kein Dokument.
 *
 * Die Schalter des Turniers gelten für jede Zielgruppe (Veranstalter wie Zuschauer) und unabhängig davon, ob die
 * öffentliche Ansicht läuft: „Gruppentabellen“ ist `!hideRankingsForPublic`, „Ergebnisse“ ist `!hideScoresForPublic`.
 * Die Zielgruppe `viewer` sieht zusätzlich nur den Spielplan (Vorbelegung, Wahl später): keine Ergebnisse, keine Tabellen.
 * Ohne Tabellen entfällt auch die Platzierung, und die Herkunft aus Gruppen („Erster Gruppe A“) bleibt „noch offen“,
 * Sieger und Verlierer einer Runde bleiben lesbar. `isKidsTournament` wird nicht ausgewertet (Daniel 10.10.).
 */
import type { Tournament } from '../../types/tournament';
import { viewerUrl } from '../qr/publicQr';

export type PdfAudience = 'organizer' | 'viewer';

/** Was die Regeln vom Turnier lesen. `isKidsTournament` steht absichtlich nicht darin. */
export type PdfContentSource = Pick<Tournament, 'hideScoresForPublic' | 'hideRankingsForPublic' | 'isPublic' | 'shareCode'> &
  Partial<Pick<Tournament, 'isKidsTournament'>>;

export interface PdfContentRules {
  /** Ergebnisse drucken. */
  results: boolean;
  /** Gruppentabellen und Platzierung drucken. */
  tables: boolean;
  /** Adresse für den Zuschauer-QR; `null`, wenn das Turnier nicht online geteilt ist (@ZM-064). */
  qrUrl: string | null;
  /** Herkunft aus Gruppen (noch nicht besetzt) als „noch offen“ drucken. */
  hidePendingOrigin: boolean;
}

/** Inhaltsregeln des PDFs für eine Zielgruppe. `baseUrl` ist der Ursprung der Zuschauer-Adresse (Vorgabe: Ursprung der App). */
export function pdfContentRules(tournament: PdfContentSource, audience: PdfAudience, baseUrl?: string): PdfContentRules {
  const viewerOnlyPlan = audience === 'viewer';
  const tables = !tournament.hideRankingsForPublic && !viewerOnlyPlan;
  return {
    results: !tournament.hideScoresForPublic && !viewerOnlyPlan,
    tables,
    qrUrl: viewerUrl(tournament, baseUrl),
    hidePendingOrigin: !tables,
  };
}
