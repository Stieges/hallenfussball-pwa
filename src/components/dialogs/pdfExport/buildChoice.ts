/**
 * Baut das gewählte PDF des Dialogs, ohne es zu speichern (B-28 C8, @DR-013): erst Bauen, dann Speichern; wirft das
 * Bauen, entsteht keine Datei. Der Turnierstand (Ergebnis, Status, Korrektur, Strafstoß) wird eingemischt, die Sichtbarkeit
 * begrenzt `lib/pdf/visibility.ts`.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing, Tournament } from '../../../types/tournament';
import { getLocationName } from '../../../utils/locationHelpers';
import { buildNoticePdf } from '../../../lib/pdf/notice';
import type { PdfHints } from '../../../lib/pdf/notes';
import { toPdfInput } from '../../../lib/pdf/pdfInput';
import type { PDFExportOptions } from '../../../lib/pdf/pdfOptions';
import { buildSchedulePdf } from '../../../lib/pdf/schedulePdf';
import { withTournamentState } from '../../../lib/pdf/tournamentState';
import type { PdfAudience } from '../../../lib/pdf/visibility';

/** Was der Dialog anbietet: Spielplan, Spielplan zum Ausfüllen, Endstand (nach dem Abschluss), Aushang mit QR-Code. */
export type PdfChoice = 'schedule' | 'blank' | 'final' | 'notice';

export interface BuildContext {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  audience: PdfAudience;
  /** Hat das Gerät Netz? Ohne Netz trägt jede Fußzeile „ohne Verbindung“ (@DR-021). */
  online: boolean;
  now: Date;
}

export interface BuiltPdf {
  doc: jsPDF;
  filename: string;
  hints: PdfHints;
}

/** `notShared`: der Aushang braucht das Online-Teilen (@ZM-064). */
export type BuildResult = { ok: true; pdf: BuiltPdf } | { ok: false; reason: 'notShared' };

export async function buildChoice(choice: PdfChoice, ctx: BuildContext): Promise<BuildResult> {
  const { tournament, standings, audience, online, now } = ctx;
  const schedule = withTournamentState(ctx.schedule, tournament);
  const options: PDFExportOptions = {
    tournament,
    audience,
    online,
    now,
    includeStandings: true,
    includeScores: choice !== 'blank',
    edition: choice === 'blank' ? 'blank' : 'plan',
    viewerResultsHidden: tournament.hideScoresForPublic,
    ...(tournament.organizer?.trim() ? { organizerName: tournament.organizer } : {}),
    hallName: getLocationName(tournament),
  };

  if (choice === 'notice') {
    const built = await buildNoticePdf(toPdfInput({ schedule, standings, options }));
    return built.ok ? { ok: true, pdf: { doc: built.doc, filename: built.filename, hints: built.hints } } : { ok: false, reason: built.reason };
  }
  if (choice === 'final') {
    // Der Endstand wird erst mit C10 (A-19/A-21a) angeboten; die Karte ist bis dahin ausgegraut und nie wählbar.
    throw new Error('Endstand-PDF ist noch nicht verfügbar');
  }
  const built = await buildSchedulePdf({ schedule, standings, options });
  return { ok: true, pdf: { doc: built.doc, filename: built.filename, hints: built.hints } };
}
