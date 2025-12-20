/**
 * PDF Exporter - Generiert druckfertigen PDF-Spielplan
 *
 * Basiert auf HTML-Layout-Referenz:
 * - A4 Portrait (210mm × 297mm)
 * - Fester Header "Wieninger-Libella-Hallenturniere 2025/2026"
 * - Meta-Box mit 4-Spalten Grid
 * - Teilnehmer in Tabelle
 * - Spiel-Tabellen für Vorrunde
 * - Separate Tabellen pro Finalrunden-Phase
 */

import jsPDF from 'jspdf';
import autoTable, { RowInput, CellInput } from 'jspdf-autotable';
import { GeneratedSchedule, ScheduledMatch } from './scheduleGenerator';
import { Standing, RefereeConfig } from '../types/tournament';
import { getLocationName, getLocationAddressLine } from '../utils/locationHelpers';

// ============================================================================
// STYLE CONFIGURATION (matching HTML reference)
// ============================================================================

const PDF_STYLE = {
  colors: {
    border: [229, 231, 235] as [number, number, number],      // #e5e7eb
    borderDark: [212, 212, 216] as [number, number, number],  // #d4d4d8
    headBg: [249, 250, 251] as [number, number, number],      // #f9fafb
    textMain: [17, 24, 39] as [number, number, number],       // #111827
    textMuted: [107, 114, 128] as [number, number, number],   // #6b7280
    white: [255, 255, 255] as [number, number, number],       // #ffffff
  },
  fonts: {
    h1: 18,           // Main title
    h2: 15,           // Subtitle
    meta: 11,         // Meta box content
    sectionTitle: 14, // Section titles (Teilnehmer, Vorrunde, Platzierung)
    phaseTitle: 14,   // Finals phase titles
    groupTitle: 13,   // Group standings titles
    table: 11,        // Table content
    hint: 10,         // Hints/notes
  },
  spacing: {
    pageMargin: {
      top: 14,
      bottom: 16,
      left: 16,
      right: 16,
    },
    sectionGap: 6,    // Gap zwischen Abschnitten
    blockGap: 4,      // Gap zwischen Blöcken in einem Abschnitt
  },
};

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH =
  PAGE_WIDTH - PDF_STYLE.spacing.pageMargin.left - PDF_STYLE.spacing.pageMargin.right;
const PAGE_BOTTOM = PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom;
const PAGE_TOP = PDF_STYLE.spacing.pageMargin.top;

// Helper: sorgt dafür, dass für den nächsten Block genug Platz ist,
// sonst wird eine neue Seite begonnen.
function ensureSpace(doc: jsPDF, yPos: number, minSpace: number): number {
  if (yPos + minSpace > PAGE_BOTTOM) {
    doc.addPage();
    return PAGE_TOP;
  }
  return yPos;
}

// ============================================================================
// TRANSLATIONS
// ============================================================================

const TRANSLATIONS = {
  de: {
    // Meta box labels
    organizer: 'Veranstalter',
    hall: 'Halle',
    matchDuration: 'Spielzeit',
    mode: 'Modus',
    gameday: 'Spieltag',
    time: 'Zeit',
    break: 'Pause',

    // Section titles
    participants: 'Teilnehmer',
    groupStage: 'Gruppenphase',
    standings: 'Tabelle',
    finalRanking: 'Platzierung',

    // Table headers
    nr: 'Nr',
    timeHeader: 'Zeit',
    field: 'Feld',
    group: 'Gr',
    home: 'Heim',
    result: 'Ergebnis',
    away: 'Gast',
    referee: 'SR',

    // Standings table headers
    pos: 'Pl',
    team: 'Team',
    played: 'Sp',
    won: 'S',
    drawn: 'U',
    lost: 'N',
    goals: 'Tore',
    diff: 'Diff',
    points: 'Pkt',

    // Finals phases
    roundOf16: 'Achtelfinale',
    quarterfinal: 'Viertelfinale',
    semifinal: 'Halbfinale',
    final: 'Finalspiele',
    thirdPlace: 'Spiel um Platz 3',
    fifthSixth: 'Spiel um Platz 5',
    seventhEighth: 'Spiel um Platz 7',

    // Hints
    hintReferees: 'SR = Schiedsrichter (SR1, SR2, ...)',
    hintResults: 'Ergebnisse bitte nach Spielende eintragen',
  },
};

type Language = keyof typeof TRANSLATIONS;

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export interface PDFExportOptions {
  locale?: Language;
  includeStandings?: boolean;
  includeScores?: boolean;
  organizerName?: string;
  hallName?: string;
}

export async function exportScheduleToPDF(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    locale = 'de',
    includeStandings = true,
    includeScores = false,
    organizerName = schedule.tournament.organizer || '',
    hallName = getLocationName(schedule.tournament),
  } = options;

  const t = TRANSLATIONS[locale];

  // Create PDF (A4 Portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Set default font
  doc.setFont('helvetica');

  let yPos = PDF_STYLE.spacing.pageMargin.top;

  // 1. Header
  yPos = renderHeader(doc, schedule, yPos);

  // 2. Meta Box
  yPos = renderMetaBox(doc, schedule, t, organizerName, hallName, yPos);

  // 3. Hints
  yPos = renderHints(doc, t, yPos);

  // 4. Participants
  const hasGroups = schedule.teams.some(team => team.group);
  yPos = renderParticipants(doc, schedule, t, yPos);

  // 5. Group Stage Matches
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  if (groupPhase) {
    yPos = renderGroupStage(
      doc,
      groupPhase.matches,
      hasGroups,
      t,
      schedule.refereeConfig,
      schedule.numberOfFields,
      includeScores,
      yPos
    );
  }

  // 6. Group Standings Tables
  if (hasGroups && includeStandings) {
    yPos = renderGroupStandings(doc, schedule, standings, t, yPos);
  }

  // 7. Finals Sections (separate table per phase)
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  if (finalPhases.length > 0) {
    yPos = renderFinalsSection(
      doc,
      finalPhases,
      t,
      schedule.refereeConfig,
      schedule.numberOfFields,
      includeScores,
      yPos
    );
  }

  // 8. Final Ranking (at the end)
  renderFinalRanking(doc, schedule, standings, t, hasGroups, yPos);

  // Save PDF
  const filename = `${schedule.tournament.title.replace(/\s+/g, '_')}_Spielplan.pdf`;
  doc.save(filename);
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Render Header: Dynamic tournament title from metadata
 */
function renderHeader(doc: jsPDF, schedule: GeneratedSchedule, yPos: number): number {
  const centerX = PAGE_WIDTH / 2;

  // Platz für Titel + Untertitel
  yPos = ensureSpace(doc, yPos, 14);

  // Main title (dynamic - from tournament data)
  doc.setFontSize(PDF_STYLE.fonts.h1);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(schedule.tournament.title, centerX, yPos, { align: 'center' });

  yPos += 7;

  // Subtitle (age class)
  doc.setFontSize(PDF_STYLE.fonts.h2);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.tournament.ageClass, centerX, yPos, { align: 'center' });

  yPos += PDF_STYLE.spacing.sectionGap + 2;

  return yPos;
}

/**
 * Render Meta Box: Two-column layout with single rounded border
 *
 * Note: PDF form fields (fillable fields) are NOT used for metadata.
 * Form fields are only intended for match results and table statistics.
 * However, jsPDF does not natively support PDF form fields (AcroForms).
 * Visual placeholders with spaces are used instead for manual filling.
 */
function renderMetaBox(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: typeof TRANSLATIONS.de,
  organizerName: string,
  hallName: string,
  yPos: number
): number {
  const padding = 4;
  const lineHeight = 5;
  const rowGap = 1;
  const columnGap = 10;

  // Get duration values from first group stage match
  const firstGroupMatch = schedule.phases.find(p => p.name === 'groupStage')?.matches[0];
  const groupDuration = firstGroupMatch?.duration || 10;

  const startTime = schedule.startTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = schedule.endTime.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const mode = schedule.teams.some(team => team.group) ? 'Gruppen + Finals' : 'Jeder gegen Jeden';

  // Get location address line (street, city)
  const locationAddressLine = getLocationAddressLine(schedule.tournament);

  // Format date as DD.MM.YYYY
  const formatGameDay = (): string => {
    const dateStr = schedule.tournament.date;
    if (!dateStr) {
      return 'Kein Datum';
    }
    // If already in DD.MM.YYYY format, return as is
    if (dateStr.includes('.')) {
      return dateStr;
    }
    // Otherwise try to parse YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  // Split fields into two columns - only include organizer if it has a value
  const leftFields: { label: string; value: string }[] = [];
  if (organizerName) {
    leftFields.push({ label: t.organizer, value: organizerName });
  }
  leftFields.push(
    { label: t.hall, value: hallName },
    { label: t.gameday, value: formatGameDay() },
    { label: t.time, value: `${startTime} - ${endTime}` }
  );

  // Right fields - removed "Pause" as it's not needed
  const rightFields = [
    { label: t.mode, value: mode },
    { label: t.matchDuration, value: `${groupDuration} Min.` },
  ];

  // Calculate the longest label width for each column (including colon)
  doc.setFontSize(PDF_STYLE.fonts.meta);
  doc.setFont('helvetica', 'normal');

  const leftMaxLabelWidth = Math.max(...leftFields.map(f => doc.getTextWidth(`${f.label}:`)));
  const rightMaxLabelWidth = Math.max(...rightFields.map(f => doc.getTextWidth(`${f.label}:`)));

  const valueStartXLeft = leftMaxLabelWidth + 3;
  const valueStartXRight = rightMaxLabelWidth + 3;

  // Calculate content height (use the max of both columns)
  // Add extra line for location address if present
  const maxRows = Math.max(leftFields.length, rightFields.length);
  const extraLineForAddress = locationAddressLine ? 1 : 0;
  const contentHeight = maxRows * lineHeight + (maxRows - 1) * rowGap + padding * 2 + (extraLineForAddress * lineHeight);

  // Platz für Meta-Box
  yPos = ensureSpace(doc, yPos, contentHeight + 4);
  const startY = yPos;
  const startX = PDF_STYLE.spacing.pageMargin.left;

  // Single rounded border
  doc.setDrawColor(...PDF_STYLE.colors.borderDark);
  doc.setLineWidth(0.8);
  doc.roundedRect(startX, startY, CONTENT_WIDTH, contentHeight, 2, 2); // 2mm radius for rounded corners

  // Left column
  const leftColumnX = startX + padding;
  let currentYLeft = startY + padding + 4;

  leftFields.forEach((field) => {
    doc.setFontSize(PDF_STYLE.fonts.meta);
    doc.setTextColor(...PDF_STYLE.colors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${field.label}:`, leftColumnX, currentYLeft);

    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(field.value, leftColumnX + valueStartXLeft, currentYLeft);

    currentYLeft += lineHeight + rowGap;

    // Add location address line below "Halle" field
    if (field.label === t.hall && locationAddressLine) {
      doc.setFontSize(PDF_STYLE.fonts.meta - 1);
      doc.setTextColor(...PDF_STYLE.colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(locationAddressLine, leftColumnX + valueStartXLeft, currentYLeft);
      currentYLeft += lineHeight + rowGap;
    }
  });

  // Right column
  const rightColumnX = startX + (CONTENT_WIDTH / 2) + columnGap;
  let currentYRight = startY + padding + 4;

  rightFields.forEach((field) => {
    doc.setFontSize(PDF_STYLE.fonts.meta);
    doc.setTextColor(...PDF_STYLE.colors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(`${field.label}:`, rightColumnX, currentYRight);

    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(field.value, rightColumnX + valueStartXRight, currentYRight);

    currentYRight += lineHeight + rowGap;
  });

  yPos = startY + contentHeight + PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Hints Section
 */
function renderHints(doc: jsPDF, t: typeof TRANSLATIONS.de, yPos: number): number {
  // Platz für Hinweis
  yPos = ensureSpace(doc, yPos, 6);

  // Only show result hint (no SR explanation)
  doc.setFontSize(PDF_STYLE.fonts.hint);
  doc.setTextColor(...PDF_STYLE.colors.textMuted);
  doc.setFont('helvetica', 'italic');
  doc.text(t.hintResults, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 4;

  yPos += PDF_STYLE.spacing.blockGap;
  return yPos;
}

/**
 * Render Participants: Rounded boxes per group, 2 groups side-by-side
 * Special case: If only 1 group, show all teams in single box without group title
 */
function renderParticipants(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: typeof TRANSLATIONS.de,
  yPos: number
): number {
  // Platz für Titel
  yPos = ensureSpace(doc, yPos, 10);

  // Section title
  doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(t.participants, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 4;

  // Teams nach Gruppe sortieren
  const teamsByGroup = new Map<string, typeof schedule.teams>();
  schedule.teams.forEach(team => {
    const groupKey = team.group || 'Alle';
    if (!teamsByGroup.has(groupKey)) {
      teamsByGroup.set(groupKey, []);
    }
    teamsByGroup.get(groupKey)!.push(team);
  });

  // Sortiere Teams in jeder Gruppe alphabetisch
  teamsByGroup.forEach(teams => teams.sort((a, b) => a.name.localeCompare(b.name)));

  const groups = Array.from(teamsByGroup.keys()).sort();
  const colGap = 6;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const boxPadding = 3;
  const titleHeight = 6;
  const teamLineHeight = 4;

  let teamCounter = 1;

  // Special case: Only 1 group - show all teams in single box without group title
  if (groups.length === 1) {
    const allTeams = teamsByGroup.get(groups[0])!;
    const boxHeight = allTeams.length * teamLineHeight + boxPadding * 2;

    yPos = ensureSpace(doc, yPos, boxHeight + 4);
    const rowStartY = yPos;

    // Single box spanning full width
    const boxX = PDF_STYLE.spacing.pageMargin.left;
    doc.setDrawColor(...PDF_STYLE.colors.borderDark);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, rowStartY, CONTENT_WIDTH, boxHeight, 2, 2);

    // Teams (no title)
    let currentY = rowStartY + boxPadding + 4;
    doc.setFontSize(PDF_STYLE.fonts.table - 1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_STYLE.colors.textMain);

    allTeams.forEach(team => {
      doc.text(`${teamCounter}. ${team.name}`, boxX + boxPadding, currentY);
      currentY += teamLineHeight;
      teamCounter++;
    });

    yPos = rowStartY + boxHeight + PDF_STYLE.spacing.sectionGap;
    return yPos;
  }

  // Process groups in rows of 2
  for (let i = 0; i < groups.length; i += 2) {
    const leftGroup = groups[i];
    const rightGroup = i + 1 < groups.length ? groups[i + 1] : null;

    const leftTeams = teamsByGroup.get(leftGroup)!;
    const rightTeams = rightGroup ? teamsByGroup.get(rightGroup)! : [];

    // Calculate box heights
    const leftBoxHeight = titleHeight + leftTeams.length * teamLineHeight + boxPadding * 2;
    const rightBoxHeight = rightGroup ? titleHeight + rightTeams.length * teamLineHeight + boxPadding * 2 : 0;
    const rowHeight = Math.max(leftBoxHeight, rightBoxHeight);

    // Ensure space for this row
    yPos = ensureSpace(doc, yPos, rowHeight + 4);
    const rowStartY = yPos;

    // Render left box
    const leftX = PDF_STYLE.spacing.pageMargin.left;
    doc.setDrawColor(...PDF_STYLE.colors.borderDark);
    doc.setLineWidth(0.5);
    doc.roundedRect(leftX, rowStartY, colWidth, leftBoxHeight, 2, 2);

    // Left group title
    let currentY = rowStartY + boxPadding + 4;
    doc.setFontSize(PDF_STYLE.fonts.table);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    const leftTitle = leftGroup !== 'Alle' ? `Gruppe ${leftGroup}` : 'Teilnehmer';
    doc.text(leftTitle, leftX + boxPadding, currentY);
    currentY += titleHeight - 2;

    // Left teams
    doc.setFontSize(PDF_STYLE.fonts.table - 1);
    doc.setFont('helvetica', 'normal');
    leftTeams.forEach(team => {
      doc.text(`${teamCounter}. ${team.name}`, leftX + boxPadding, currentY);
      currentY += teamLineHeight;
      teamCounter++;
    });

    // Render right box (if exists)
    if (rightGroup) {
      const rightX = PDF_STYLE.spacing.pageMargin.left + colWidth + colGap;
      doc.setDrawColor(...PDF_STYLE.colors.borderDark);
      doc.setLineWidth(0.5);
      doc.roundedRect(rightX, rowStartY, colWidth, rightBoxHeight, 2, 2);

      // Right group title
      currentY = rowStartY + boxPadding + 4;
      doc.setFontSize(PDF_STYLE.fonts.table);
      doc.setTextColor(...PDF_STYLE.colors.textMain);
      doc.setFont('helvetica', 'bold');
      const rightTitle = rightGroup !== 'Alle' ? `Gruppe ${rightGroup}` : 'Teilnehmer';
      doc.text(rightTitle, rightX + boxPadding, currentY);
      currentY += titleHeight - 2;

      // Right teams
      doc.setFontSize(PDF_STYLE.fonts.table - 1);
      doc.setFont('helvetica', 'normal');
      rightTeams.forEach(team => {
        doc.text(`${teamCounter}. ${team.name}`, rightX + boxPadding, currentY);
        currentY += teamLineHeight;
        teamCounter++;
      });
    }

    // Move to next row
    yPos = rowStartY + rowHeight + 4;
  }

  yPos += PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Group Stage Matches Table
 */
function renderGroupStage(
  doc: jsPDF,
  matches: ScheduledMatch[],
  _hasGroups: boolean,
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number,
  includeScores: boolean,
  yPos: number
): number {
  // Platz für Titel
  yPos = ensureSpace(doc, yPos, 10);

  // Check how many unique groups exist
  const uniqueGroups = new Set(matches.map(m => m.group).filter(Boolean));
  const hasMultipleGroups = uniqueGroups.size > 1;

  // Section title
  doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(t.groupStage, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 2;

  // Determine if we should show field column
  const showFieldColumn = numberOfFields > 1;

  // Table headers
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  if (hasMultipleGroups) {headerRow.push(t.group);}
  headerRow.push(t.home, t.result, t.away);
  if (refereeConfig && refereeConfig.mode !== 'none') {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Table data
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}
    if (hasMultipleGroups) {row.push(match.group || '-');}

    // Show scores if includeScores is true and scores are available
    const resultColumn = includeScores && (match.scoreA !== undefined && match.scoreB !== undefined)
      ? `${match.scoreA} : ${match.scoreB}`
      : '     :     ';

    row.push(match.homeTeam, resultColumn, match.awayTeam);

    if (refereeConfig && refereeConfig.mode !== 'none') {
      row.push(match.referee ? `SR${match.referee}` : '-');
    }

    return row;
  });

  // Render table
  autoTable(doc, {
    startY: yPos,
    head: headers,
    body: data,
    margin: {
      left: PDF_STYLE.spacing.pageMargin.left,
      right: PDF_STYLE.spacing.pageMargin.right,
    },
    styles: {
      fontSize: PDF_STYLE.fonts.table,
      cellPadding: 2,
      lineColor: PDF_STYLE.colors.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: PDF_STYLE.colors.headBg,
      textColor: PDF_STYLE.colors.textMain,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: (() => {
      let colIndex = 0;
      const styles: any = {};

      styles[colIndex++] = { halign: 'center', cellWidth: 10 }; // Nr
      styles[colIndex++] = { halign: 'center', cellWidth: 15 }; // Zeit
      if (showFieldColumn) {styles[colIndex++] = { halign: 'center', cellWidth: 15 };} // Feld
      if (hasMultipleGroups) {styles[colIndex++] = { halign: 'center', cellWidth: 10 };} // Gr
      styles[colIndex++] = { halign: 'left' }; // Heim
      styles[colIndex++] = { halign: 'center', cellWidth: 25 }; // Ergebnis
      styles[colIndex++] = { halign: 'left' }; // Gast
      if (refereeConfig && refereeConfig.mode !== 'none') {
        styles[colIndex++] = { halign: 'center', cellWidth: 15 }; // SR
      }

      return styles;
    })(),
  });

  yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Finals Section: Separate table per phase
 * Renders matches in their original order (by matchNumber) like in the preview
 */
function renderFinalsSection(
  doc: jsPDF,
  phases: Array<{ name: string; label: string; matches: ScheduledMatch[] }>,
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number,
  includeScores: boolean,
  yPos: number
): number {
  phases.forEach(phase => {
    // Platz für Phasen-Titel
    yPos = ensureSpace(doc, yPos, 10);

    // Phase title
    doc.setFontSize(PDF_STYLE.fonts.phaseTitle);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(phase.label, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 2;

    // Sort matches by matchNumber to maintain original schedule order
    const sortedMatches = [...phase.matches].sort((a, b) => a.matchNumber - b.matchNumber);

    // Group consecutive matches with same finalType
    const matchGroups: Array<{ matches: ScheduledMatch[]; subtitle?: string }> = [];
    let currentGroup: ScheduledMatch[] = [];
    let currentFinalType: string | undefined = undefined;

    sortedMatches.forEach((match, index) => {
      if (match.finalType !== currentFinalType) {
        // Start new group
        if (currentGroup.length > 0) {
          matchGroups.push({
            matches: currentGroup,
            subtitle: getSubtitleForFinalType(currentFinalType, t),
          });
        }
        currentGroup = [match];
        currentFinalType = match.finalType;
      } else {
        currentGroup.push(match);
      }

      // Push last group
      if (index === sortedMatches.length - 1 && currentGroup.length > 0) {
        matchGroups.push({
          matches: currentGroup,
          subtitle: getSubtitleForFinalType(currentFinalType, t),
        });
      }
    });

    // Render all match groups
    matchGroups.forEach(group => {
      yPos = renderFinalsTable(doc, group.matches, t, refereeConfig, numberOfFields, includeScores, yPos, group.subtitle);
    });
  });

  return yPos;
}

/**
 * Get subtitle for finalType
 */
function getSubtitleForFinalType(
  finalType: string | undefined,
  t: typeof TRANSLATIONS.de
): string | undefined {
  if (!finalType) {return undefined;}

  switch (finalType) {
    case 'thirdPlace':
      return t.thirdPlace;
    case 'fifthSixth':
      return t.fifthSixth;
    case 'seventhEighth':
      return t.seventhEighth;
    default:
      return undefined;
  }
}

/**
 * Render a single finals table
 */
function renderFinalsTable(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number,
  includeScores: boolean,
  yPos: number,
  subtitle?: string
): number {
  const showFieldColumn = numberOfFields > 1;

  // Subtitle für Platzierungsspiele
  if (subtitle) {
    yPos = ensureSpace(doc, yPos, 8);
    doc.setFontSize(PDF_STYLE.fonts.table);
    doc.setTextColor(...PDF_STYLE.colors.textMuted);
    doc.setFont('helvetica', 'bold');
    doc.text(subtitle, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 4; // Mehr Abstand nach Untertitel
  }

  // Table headers
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  headerRow.push(t.home, t.result, t.away);
  if (refereeConfig && refereeConfig.mode !== 'none') {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Table data
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}

    // Show scores if includeScores is true and scores are available
    const resultColumn = includeScores && (match.scoreA !== undefined && match.scoreB !== undefined)
      ? `${match.scoreA} : ${match.scoreB}`
      : '     :     ';

    row.push(match.homeTeam, resultColumn, match.awayTeam);

    if (refereeConfig && refereeConfig.mode !== 'none') {
      row.push(match.referee ? `SR${match.referee}` : '-');
    }

    return row;
  });

  // Render table
  autoTable(doc, {
    startY: yPos,
    head: headers,
    body: data,
    margin: {
      left: PDF_STYLE.spacing.pageMargin.left,
      right: PDF_STYLE.spacing.pageMargin.right,
    },
    styles: {
      fontSize: PDF_STYLE.fonts.table,
      cellPadding: 2,
      lineColor: PDF_STYLE.colors.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: PDF_STYLE.colors.headBg,
      textColor: PDF_STYLE.colors.textMain,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: showFieldColumn
      ? {
          0: { halign: 'center', cellWidth: 10 }, // Nr
          1: { halign: 'center', cellWidth: 15 }, // Zeit
          2: { halign: 'center', cellWidth: 15 }, // Feld
          3: { halign: 'left' },                  // Heim
          4: { halign: 'center', cellWidth: 25 }, // Ergebnis
          5: { halign: 'left' },                  // Gast
          ...(refereeConfig && refereeConfig.mode !== 'none'
            ? { 6: { halign: 'center', cellWidth: 15 } }
            : {}),
        }
      : {
          0: { halign: 'center', cellWidth: 10 }, // Nr
          1: { halign: 'center', cellWidth: 15 }, // Zeit
          2: { halign: 'left' },                  // Heim
          3: { halign: 'center', cellWidth: 25 }, // Ergebnis
          4: { halign: 'left' },                  // Gast
          ...(refereeConfig && refereeConfig.mode !== 'none'
            ? { 5: { halign: 'center', cellWidth: 15 } }
            : {}),
        },
  });

  yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Group Standings: einfache Liste von Tabellen
 */
function renderGroupStandings(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  t: typeof TRANSLATIONS.de,
  yPos: number
): number {
  // Einzigartige Gruppen bestimmen
  const groups = Array.from(new Set(schedule.teams.map(t => t.group).filter(Boolean))).sort();
  if (groups.length === 0) {return yPos;}

  // Standings-Quelle
  const currentStandings = standings || schedule.initialStandings;

  groups.forEach(group => {
    // Platz für Titel + Tabelle
    yPos = ensureSpace(doc, yPos, 12);

    // Titel "Tabelle – Gruppe X"
    doc.setFontSize(PDF_STYLE.fonts.groupTitle);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.standings} – Gruppe ${group}`, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 2;

    const groupTeams = schedule.teams.filter(t => t.group === group);
    const groupStandings = currentStandings
      .filter(s => groupTeams.some(t => t.id === s.team.id))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor
      );

    const headers: RowInput[] = [[
      t.pos,
      t.team,
      t.played,
      t.won,
      t.drawn,
      t.lost,
      t.goals,
      t.diff,
      t.points,
    ]];

    const data: RowInput[] = groupStandings.map((standing, index): CellInput[] => [
      (index + 1).toString(),
      standing.team.name,
      standing.played > 0 ? standing.played.toString() : '',
      standing.won > 0 ? standing.won.toString() : '',
      standing.drawn > 0 ? standing.drawn.toString() : '',
      standing.lost > 0 ? standing.lost.toString() : '',
      standing.goalsFor > 0 || standing.goalsAgainst > 0
        ? `${standing.goalsFor}:${standing.goalsAgainst}`
        : '',
      standing.goalDifference !== 0
        ? standing.goalDifference > 0
          ? `+${standing.goalDifference}`
          : standing.goalDifference.toString()
        : '',
      standing.points > 0 ? standing.points.toString() : '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: headers,
      body: data,
      margin: {
        left: PDF_STYLE.spacing.pageMargin.left,
        right: PDF_STYLE.spacing.pageMargin.right,
      },
      styles: {
        fontSize: PDF_STYLE.fonts.table - 1,
        cellPadding: 1.5,
        lineColor: PDF_STYLE.colors.border,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: PDF_STYLE.colors.headBg,
        textColor: PDF_STYLE.colors.textMain,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },  // Pos
        1: { halign: 'left', cellWidth: 40 },   // Team
        2: { halign: 'center', cellWidth: 8 },  // Sp
        3: { halign: 'center', cellWidth: 7 },  // S
        4: { halign: 'center', cellWidth: 7 },  // U
        5: { halign: 'center', cellWidth: 7 },  // N
        6: { halign: 'center', cellWidth: 12 }, // Tore
        7: { halign: 'center', cellWidth: 10 }, // Diff
        8: { halign: 'center', cellWidth: 8 },  // Pkt
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap + 4;
  });

  yPos += PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Final Ranking: Overall placement at the end of the document
 */
function renderFinalRanking(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  t: typeof TRANSLATIONS.de,
  _hasGroups: boolean,
  yPos: number
): number {
  // Platz für Titel + Tabelle
  yPos = ensureSpace(doc, yPos, 12);

  // Section title
  doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(t.finalRanking, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 2;

  const currentStandings = standings || schedule.initialStandings;

  // Sort all teams by points, goal difference, etc.
  const finalStandings = [...currentStandings].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor
  );

  // Table data
  const headers: RowInput[] = [[
    t.pos,
    t.team,
    t.played,
    t.won,
    t.drawn,
    t.lost,
    t.goals,
    t.diff,
    t.points,
  ]];
  const data: RowInput[] = finalStandings.map((standing, index): CellInput[] => [
    (index + 1).toString(),
    standing.team.name,
    standing.played > 0 ? standing.played.toString() : '',
    standing.won > 0 ? standing.won.toString() : '',
    standing.drawn > 0 ? standing.drawn.toString() : '',
    standing.lost > 0 ? standing.lost.toString() : '',
    standing.goalsFor > 0 || standing.goalsAgainst > 0
      ? `${standing.goalsFor}:${standing.goalsAgainst}`
      : '',
    standing.goalDifference !== 0
      ? standing.goalDifference > 0
        ? `+${standing.goalDifference}`
        : standing.goalDifference.toString()
      : '',
    standing.points > 0 ? standing.points.toString() : '',
  ]);

  // Render table
  autoTable(doc, {
    startY: yPos,
    head: headers,
    body: data,
    margin: {
      left: PDF_STYLE.spacing.pageMargin.left,
      right: PDF_STYLE.spacing.pageMargin.right,
    },
    styles: {
      fontSize: PDF_STYLE.fonts.table - 1,
      cellPadding: 1.5,
      lineColor: PDF_STYLE.colors.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: PDF_STYLE.colors.headBg,
      textColor: PDF_STYLE.colors.textMain,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },  // Pos
      1: { halign: 'left', cellWidth: 40 },   // Team
      2: { halign: 'center', cellWidth: 8 },  // Sp
      3: { halign: 'center', cellWidth: 7 },  // S
      4: { halign: 'center', cellWidth: 7 },  // U
      5: { halign: 'center', cellWidth: 7 },  // N
      6: { halign: 'center', cellWidth: 12 }, // Tore
      7: { halign: 'center', cellWidth: 10 }, // Diff
      8: { halign: 'center', cellWidth: 8 },  // Pkt
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;

  return yPos;
}

// ============================================================================
// TYPE AUGMENTATION FOR AUTOTABLE
// ============================================================================

// Extend jsPDF type to include autoTable metadata
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
