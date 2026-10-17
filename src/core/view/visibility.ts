/**
 * Sichtbarkeit je Zielgruppe und Medium (A-36b, Teilplan A-36 § 2.4) – EIN Satz Schalter für Zuschauer-Seite,
 * Monitor und PDF (@ZM-102, @BM-032, @BM-054, W1/W4/W10/W15).
 * K = Kindermodus `hideScoresForPublic`, T = „Gruppentabellen aus“ `hideRankingsForPublic`, P = Zuschauer-PDF-Wahl.
 */
import type { TournamentViewInput, ViewAudience, ViewMedium, ViewRules, ViewerPdfChoice } from './types';

type RuleSource = Pick<TournamentViewInput, 'hideScoresForPublic' | 'hideRankingsForPublic' | 'isPublic' | 'shareCode'>;

export function viewRules(
  t: Pick<RuleSource, 'hideScoresForPublic' | 'hideRankingsForPublic'> & Partial<Pick<RuleSource, 'isPublic' | 'shareCode'>>,
  audience: ViewAudience,
  medium: ViewMedium,
  viewerPdf: ViewerPdfChoice = 'planOnly',
): ViewRules {
  const viewerLinkAllowed = t.isPublic === true && t.shareCode !== undefined && t.shareCode !== '';
  const viewerPdfOffered = audience === 'viewer' && medium === 'app' && viewerPdf !== 'none' && viewerLinkAllowed;
  if (audience === 'organizer' && medium === 'app') {
    return {
      results: true, liveScore: true, tables: true, groupOrigin: true, awardedMark: true, correctedMark: true,
      viewerLinkAllowed, viewerPdfOffered,
    };
  }
  const kids = t.hideScoresForPublic;
  const noTables = t.hideRankingsForPublic;
  // Zuschauer-PDF: Ergebnisse und Tabellen nur bei „Mit Ergebnissen“ – und nie mehr, als die Schalter erlauben.
  const pdfAllowsResults = audience === 'viewer' && medium === 'print' ? viewerPdf === 'withResults' : true;
  return {
    results: !kids && pdfAllowsResults,
    liveScore: !kids && pdfAllowsResults,
    tables: !kids && !noTables && pdfAllowsResults,
    // W4: die Herkunft mit Platz hängt nur an den Schaltern, nie an der PDF-Wahl.
    groupOrigin: !kids && !noTables,
    awardedMark: !kids,
    correctedMark: !kids,
    viewerLinkAllowed,
    viewerPdfOffered,
  };
}
