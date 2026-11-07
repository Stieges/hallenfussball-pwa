/**
 * Baut das gewählte PDF des Dialogs, ohne es zu speichern (B-28 C8, @DR-013): erst Bauen, dann Speichern; wirft das
 * Bauen, entsteht keine Datei. Der Turnierstand (Ergebnis, Status, Korrektur, Strafstoß) wird eingemischt, die Sichtbarkeit
 * begrenzt `lib/pdf/visibility.ts`.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import type { TournamentGraphics } from '../../../core/storage/tournamentGraphicsStore';
import type { Standing, Tournament } from '../../../types/tournament';
import { getLocationName } from '../../../utils/locationHelpers';
import { graphicsOptions } from './graphicsOptions';
import { buildNoticePdf } from '../../../lib/pdf/notice';
import type { PdfHints } from '../../../lib/pdf/notes';
import { toPdfInput } from '../../../lib/pdf/pdfInput';
import type { PDFExportOptions } from '../../../lib/pdf/pdfOptions';
import type { RankEntry } from '../../../lib/pdf/placement';
import { buildSchedulePdf } from '../../../lib/pdf/schedulePdf';
import { withTournamentState } from '../../../lib/pdf/tournamentState';
import type { PdfAudience } from '../../../lib/pdf/visibility';

/**
 * Ansprechpartner fürs PDF nur mit Häkchen „Ansprechpartner öffentlich zeigen“ (@W1-031, @W1-032): Name, Telefon, E-Mail
 * und Website in einer Zeile; ohne Häkchen oder ohne Angaben keine Zeile.
 */
export function publicContactOption(tournament: Pick<Tournament, 'contactInfo'>): Pick<PDFExportOptions, 'contact'> {
  const info = tournament.contactInfo;
  if (info?.showPublic !== true) {
    return {};
  }
  const parts = [info.name, info.phone, info.email, info.website]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '');
  return parts.length === 0 ? {} : { contact: parts.join(' · ') };
}

/** Was der Dialog anbietet: Spielplan, Spielplan ohne Ergebnisse, Endstand (nach dem Abschluss), Aushang mit QR-Code. */
export type PdfChoice = 'schedule' | 'blank' | 'final' | 'notice';

export interface BuildContext {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  audience: PdfAudience;
  /** Hat das Gerät Netz? Ohne Netz trägt jede Fußzeile „ohne Verbindung“ (@DR-021). */
  online: boolean;
  now: Date;
  /** Grafiken dieses Geräts (Gerätespeicher, @W3-030); fehlen sie (anderes Gerät), druckt das PDF ohne sie (@DR-024). */
  graphics?: TournamentGraphics;
  /** Der Gerätespeicher ließ sich nicht lesen: das PDF entsteht ohne Grafiken, der Hinweis nennt es (@DR-024). */
  graphicsUnreadable?: boolean;
  /**
   * Gespeicherter Endstand des abgeschlossenen Turniers (@ET-045, nie neu gerechnet): Plätze und Abschlusszeitpunkt. Der Spielplan
   * nennt damit den ganzen Endstand (@DR-009), der Endstand braucht ihn (@DR-011). Fehlt er, gibt es kein Endstand-PDF.
   */
  final?: { ranking: RankEntry[]; closedAt: Date };
}

export interface BuiltPdf {
  doc: jsPDF;
  filename: string;
  hints: PdfHints;
}

/** `notShared`: der Aushang braucht das Online-Teilen (@ZM-064). */
export type BuildResult = { ok: true; pdf: BuiltPdf } | { ok: false; reason: 'notShared' };

export async function buildChoice(choice: PdfChoice, ctx: BuildContext): Promise<BuildResult> {
  const { tournament, standings, audience, online, now, final } = ctx;
  if (choice === 'final' && final === undefined) {
    // Ohne gespeicherten Endstand kein Endstand-PDF (@DR-011): die Karte ist dann ausgegraut, hier nur die Sicherung
    throw new Error('Endstand-PDF ohne gespeicherten Endstand');
  }
  const schedule = withTournamentState(ctx.schedule, tournament);
  const options: PDFExportOptions = {
    tournament,
    // Das Endstand-PDF der Zuschauer-Seite ist „Mit Ergebnissen“ (@BM-041): es folgt nur den Schaltern, wie das der Turnierleitung
    audience: choice === 'final' ? 'organizer' : audience,
    online,
    now,
    includeStandings: true,
    includeScores: choice !== 'blank',
    edition: choice === 'blank' ? 'blank' : choice === 'final' ? 'final' : 'plan',
    // Nach dem Abschluss: Platzierung laut gespeichertem Endstand (@DR-009), im Endstand dazu die Abschlusszeile (@DR-011)
    ...(final !== undefined && choice !== 'blank' ? { ranking: final.ranking, closed: true, closedAt: final.closedAt } : {}),
    viewerResultsHidden: tournament.hideScoresForPublic,
    ...(tournament.organizer?.trim() ? { organizerName: tournament.organizer } : {}),
    ...publicContactOption(tournament),
    hallName: getLocationName(tournament),
    ...graphicsOptions(ctx.graphics),
  };
  const withStoreHint = (hints: PdfHints): PdfHints => (ctx.graphicsUnreadable === true ? { ...hints, logos: ['left', 'right'] } : hints);

  if (choice === 'notice') {
    const built = await buildNoticePdf(toPdfInput({ schedule, standings, options }));
    return built.ok ? { ok: true, pdf: { doc: built.doc, filename: built.filename, hints: withStoreHint(built.hints) } } : { ok: false, reason: built.reason };
  }
  const built = await buildSchedulePdf({ schedule, standings, options });
  return { ok: true, pdf: { doc: built.doc, filename: built.filename, hints: withStoreHint(built.hints) } };
}
