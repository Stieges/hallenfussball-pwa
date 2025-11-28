/**
 * PDF Exporter - Generiert druckfertigen PDF-Spielplan
 *
 * Basiert auf HTML-Layout-Referenz:
 * - A4 Portrait (210mm × 297mm)
 * - Fester Header "Wieninger-Libella-Hallenturniere 2025/2026"
 * - Meta-Box mit 4-Spalten Grid
 * - Teilnehmer gruppiert in Boxen
 * - Spiel-Tabellen für Vorrunde
 * - Separate Tabellen pro Finalrunden-Phase
 * - Tabellen in 2-Spalten Layout
 */

import jsPDF from 'jspdf';
import autoTable, { RowInput, CellInput } from 'jspdf-autotable';
import { GeneratedSchedule, ScheduledMatch } from './scheduleGenerator';
import { Standing, RefereeConfig } from '../types/tournament';

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
    sectionTitle: 13, // Section titles (Teilnehmer, Vorrunde)
    phaseTitle: 13,   // Finals phase titles
    groupTitle: 13,   // Group standings titles
    table: 12,        // Table content
    hint: 10,         // Hints/notes
  },
  spacing: {
    pageMargin: {
      top: 14,
      bottom: 16,
      left: 16,
      right: 16,
    },
    sectionGap: 6,    // Gap between sections
    blockGap: 4,      // Gap between blocks within sections
  },
};

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - PDF_STYLE.spacing.pageMargin.left - PDF_STYLE.spacing.pageMargin.right;

// ============================================================================
// TRANSLATIONS
// ============================================================================

const TRANSLATIONS = {
  de: {
    // Meta box labels
    organizer: 'Veranstalter:',
    hall: 'Halle:',
    matchDuration: 'Spielzeit:',
    mode: 'Modus:',
    gameday: 'Spieltag:',
    time: 'Zeit:',
    break: 'Pause:',

    // Section titles
    participants: 'Teilnehmer',
    groupStage: 'Vorrunde',
    standings: 'Tabelle',

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
    organizerName = 'Wieninger-Libella',
    hallName = schedule.tournament.location,
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
  yPos = renderHints(doc, t, schedule.refereeConfig, yPos);

  // 4. Participants (only for group tournaments)
  const hasGroups = schedule.teams.some(team => team.group);
  if (hasGroups) {
    yPos = renderParticipants(doc, schedule, yPos);
  }

  // 5. Group Stage Matches
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  if (groupPhase) {
    yPos = renderGroupStage(doc, groupPhase.matches, hasGroups, t, schedule.refereeConfig, yPos);
  }

  // 6. Group Standings Tables
  if (hasGroups && includeStandings) {
    yPos = renderGroupStandings(doc, schedule, standings, t, yPos);
  }

  // 7. Finals Sections (separate table per phase)
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  if (finalPhases.length > 0) {
    yPos = renderFinalsSection(doc, finalPhases, t, schedule.refereeConfig, yPos);
  }

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
 * Render Meta Box: 4-column grid layout
 */
function renderMetaBox(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: typeof TRANSLATIONS.de,
  organizerName: string,
  hallName: string,
  yPos: number
): number {
  const boxHeight = 18;
  const startY = yPos;
  const rowHeight = 6;

  // Border
  doc.setDrawColor(...PDF_STYLE.colors.borderDark);
  doc.setLineWidth(0.5);
  doc.rect(
    PDF_STYLE.spacing.pageMargin.left,
    startY,
    CONTENT_WIDTH,
    boxHeight
  );

  // Vertical dividers (4 columns)
  const colWidth = CONTENT_WIDTH / 4;
  for (let i = 1; i < 4; i++) {
    doc.line(
      PDF_STYLE.spacing.pageMargin.left + colWidth * i,
      startY,
      PDF_STYLE.spacing.pageMargin.left + colWidth * i,
      startY + boxHeight
    );
  }

  // Horizontal dividers (3 rows)
  for (let i = 1; i < 3; i++) {
    doc.line(
      PDF_STYLE.spacing.pageMargin.left,
      startY + rowHeight * i,
      PDF_STYLE.spacing.pageMargin.left + CONTENT_WIDTH,
      startY + rowHeight * i
    );
  }

  // Helper function to render label-value pair
  const renderCell = (col: number, row: number, label: string, value: string) => {
    const x = PDF_STYLE.spacing.pageMargin.left + colWidth * col + 2;
    const y = startY + rowHeight * row + 2;

    doc.setFontSize(PDF_STYLE.fonts.meta);
    doc.setTextColor(...PDF_STYLE.colors.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y + 2);

    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, y + 5);
  };

  // Calculate duration values (default values for now - these should come from tournament config)
  const groupDuration = 10; // Default game duration
  const groupBreak = 2; // Default break duration

  // Row 1: Veranstalter | Halle | Spielzeit | Modus
  renderCell(0, 0, t.organizer, organizerName);
  renderCell(1, 0, t.hall, hallName);
  renderCell(2, 0, t.matchDuration, `${groupDuration} Min.`);
  renderCell(3, 0, t.mode, schedule.teams.some(t => t.group) ? 'Gruppen + Finals' : 'Jeder gegen Jeden');

  // Row 2: Spieltag | Zeit | Pause | (empty)
  renderCell(0, 1, t.gameday, schedule.tournament.date);
  const startTime = schedule.startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const endTime = schedule.endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  renderCell(1, 1, t.time, `${startTime} - ${endTime}`);
  renderCell(2, 1, t.break, `${groupBreak} Min.`);

  // Row 3: Age class spanning columns
  const ageX = PDF_STYLE.spacing.pageMargin.left + 2;
  const ageY = startY + rowHeight * 2 + 4;
  doc.setFontSize(PDF_STYLE.fonts.meta);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(schedule.tournament.ageClass, ageX, ageY);

  yPos = startY + boxHeight + PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Hints Section
 */
function renderHints(
  doc: jsPDF,
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  yPos: number
): number {
  const hints: string[] = [];

  if (refereeConfig && refereeConfig.mode !== 'none') {
    hints.push(t.hintReferees);
  }
  hints.push(t.hintResults);

  if (hints.length === 0) return yPos;

  doc.setFontSize(PDF_STYLE.fonts.hint);
  doc.setTextColor(...PDF_STYLE.colors.textMuted);
  doc.setFont('helvetica', 'italic');

  hints.forEach(hint => {
    doc.text(hint, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 4;
  });

  yPos += PDF_STYLE.spacing.blockGap;
  return yPos;
}

/**
 * Render Participants: Grouped in bordered boxes with global team numbering
 */
function renderParticipants(doc: jsPDF, schedule: GeneratedSchedule, yPos: number): number {
  // Section title
  doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(TRANSLATIONS.de.participants, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 6;

  // Get unique groups
  const groups = Array.from(new Set(schedule.teams.map(t => t.group).filter(Boolean))).sort();

  // Calculate global team numbers
  const teamNumbers = new Map<string, number>();
  let globalNumber = 1;
  schedule.teams.forEach(team => {
    teamNumbers.set(team.id, globalNumber++);
  });

  // Render groups in 2-column layout
  const groupsPerRow = 2;
  const colWidth = (CONTENT_WIDTH - 4) / groupsPerRow;
  const boxHeight = 8 + Math.ceil(schedule.teams.length / groups.length) * 5;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const col = i % groupsPerRow;
    const row = Math.floor(i / groupsPerRow);

    const x = PDF_STYLE.spacing.pageMargin.left + col * (colWidth + 4);
    const y = yPos + row * (boxHeight + 3);

    // Check page break
    if (y + boxHeight > PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom) {
      doc.addPage();
      yPos = PDF_STYLE.spacing.pageMargin.top;
      return renderParticipants(doc, schedule, yPos);
    }

    // Group box
    doc.setDrawColor(...PDF_STYLE.colors.border);
    doc.setLineWidth(0.3);
    doc.rect(x, y, colWidth, boxHeight);

    // Group title
    doc.setFillColor(...PDF_STYLE.colors.headBg);
    doc.rect(x, y, colWidth, 6, 'F');
    doc.setFontSize(PDF_STYLE.fonts.table);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gruppe ${group}`, x + colWidth / 2, y + 4, { align: 'center' });

    // Teams
    const groupTeams = schedule.teams.filter(t => t.group === group);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF_STYLE.fonts.table - 1);
    groupTeams.forEach((team, idx) => {
      const teamNum = teamNumbers.get(team.id) || 0;
      const teamY = y + 6 + 2 + idx * 5;
      doc.text(`${teamNum}. ${team.name}`, x + 2, teamY + 3);
    });
  }

  // Calculate final yPos
  const totalRows = Math.ceil(groups.length / groupsPerRow);
  yPos += totalRows * (boxHeight + 3) + PDF_STYLE.spacing.sectionGap;

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
  yPos: number
): number {
  // Check page break
  if (yPos + 40 > PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom) {
    doc.addPage();
    yPos = PDF_STYLE.spacing.pageMargin.top;
  }

  // Section title
  doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
  doc.setTextColor(...PDF_STYLE.colors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(t.groupStage, PDF_STYLE.spacing.pageMargin.left, yPos);
  yPos += 2;

  // Table headers
  const headerRow: CellInput[] = [t.nr, t.timeHeader, t.field, t.group, t.home, t.result, t.away];
  if (refereeConfig && refereeConfig.mode !== 'none') {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Table data
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [
      match.matchNumber.toString(),
      match.time,
      match.field.toString(),
      match.group || '-',
      match.homeTeam,
      '__ : __',
      match.awayTeam,
    ];

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
    margin: { left: PDF_STYLE.spacing.pageMargin.left, right: PDF_STYLE.spacing.pageMargin.right },
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
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },  // Nr
      1: { halign: 'center', cellWidth: 15 },  // Zeit
      2: { halign: 'center', cellWidth: 12 },  // Feld
      3: { halign: 'center', cellWidth: 10 },  // Gr
      4: { halign: 'left' },                   // Heim
      5: { halign: 'center', cellWidth: 20 },  // Ergebnis
      6: { halign: 'left' },                   // Gast
      ...(refereeConfig && refereeConfig.mode !== 'none' ? { 7: { halign: 'center', cellWidth: 12 } } : {}),
    },
    didDrawPage: () => {
      // Reset yPos after page break
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;
  return yPos;
}

/**
 * Render Finals Section: Separate table per phase
 */
function renderFinalsSection(
  doc: jsPDF,
  phases: Array<{ name: string; label: string; matches: ScheduledMatch[] }>,
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  yPos: number
): number {
  phases.forEach(phase => {
    // Check page break
    if (yPos + 30 > PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom) {
      doc.addPage();
      yPos = PDF_STYLE.spacing.pageMargin.top;
    }

    // Phase title
    doc.setFontSize(PDF_STYLE.fonts.phaseTitle);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(phase.label, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 2;

    // Separate matches by finalType
    const mainMatches = phase.matches.filter(m => !m.finalType || m.finalType === 'final');
    const thirdPlaceMatches = phase.matches.filter(m => m.finalType === 'thirdPlace');
    const fifthSixthMatches = phase.matches.filter(m => m.finalType === 'fifthSixth');
    const seventhEighthMatches = phase.matches.filter(m => m.finalType === 'seventhEighth');

    // Render main matches
    if (mainMatches.length > 0) {
      yPos = renderFinalsTable(doc, mainMatches, t, refereeConfig, yPos);
    }

    // Render placement matches with sub-titles
    if (thirdPlaceMatches.length > 0) {
      yPos = renderFinalsTable(doc, thirdPlaceMatches, t, refereeConfig, yPos, t.thirdPlace);
    }
    if (fifthSixthMatches.length > 0) {
      yPos = renderFinalsTable(doc, fifthSixthMatches, t, refereeConfig, yPos, t.fifthSixth);
    }
    if (seventhEighthMatches.length > 0) {
      yPos = renderFinalsTable(doc, seventhEighthMatches, t, refereeConfig, yPos, t.seventhEighth);
    }
  });

  return yPos;
}

/**
 * Render a single finals table
 */
function renderFinalsTable(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: typeof TRANSLATIONS.de,
  refereeConfig: RefereeConfig | undefined,
  yPos: number,
  subtitle?: string
): number {
  // Subtitle for placement matches
  if (subtitle) {
    doc.setFontSize(PDF_STYLE.fonts.table);
    doc.setTextColor(...PDF_STYLE.colors.textMuted);
    doc.setFont('helvetica', 'bold');
    doc.text(subtitle, PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 2;
  }

  // Table headers
  const headerRow: CellInput[] = [t.nr, t.timeHeader, t.field, t.home, t.result, t.away];
  if (refereeConfig && refereeConfig.mode !== 'none') {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Table data
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [
      match.matchNumber.toString(),
      match.time,
      match.field.toString(),
      match.homeTeam,
      '__ : __',
      match.awayTeam,
    ];

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
    margin: { left: PDF_STYLE.spacing.pageMargin.left, right: PDF_STYLE.spacing.pageMargin.right },
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
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },  // Nr
      1: { halign: 'center', cellWidth: 15 },  // Zeit
      2: { halign: 'center', cellWidth: 12 },  // Feld
      3: { halign: 'left' },                   // Heim
      4: { halign: 'center', cellWidth: 20 },  // Ergebnis
      5: { halign: 'left' },                   // Gast
      ...(refereeConfig && refereeConfig.mode !== 'none' ? { 6: { halign: 'center', cellWidth: 12 } } : {}),
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.blockGap;
  return yPos;
}

/**
 * Render Group Standings: 2-column layout with "Tabelle – Gruppe X"
 */
function renderGroupStandings(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  t: typeof TRANSLATIONS.de,
  yPos: number
): number {
  // Get unique groups
  const groups = Array.from(new Set(schedule.teams.map(t => t.group).filter(Boolean))).sort();
  if (groups.length === 0) return yPos;

  // Calculate standings if not provided
  const currentStandings = standings || schedule.initialStandings;

  // Check page break
  if (yPos + 60 > PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom) {
    doc.addPage();
    yPos = PDF_STYLE.spacing.pageMargin.top;
  }

  // Render groups in 2-column layout
  const groupsPerRow = 2;
  const colWidth = (CONTENT_WIDTH - 6) / groupsPerRow;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const col = i % groupsPerRow;

    // Check if we need new row
    if (col === 0 && i > 0) {
      yPos += 50; // Approximate height per row
      if (yPos + 50 > PAGE_HEIGHT - PDF_STYLE.spacing.pageMargin.bottom) {
        doc.addPage();
        yPos = PDF_STYLE.spacing.pageMargin.top;
      }
    }

    const x = PDF_STYLE.spacing.pageMargin.left + col * (colWidth + 6);
    const y = yPos + (col === 0 ? 0 : 0); // Same Y for both columns

    // Group title: "Tabelle – Gruppe X"
    doc.setFontSize(PDF_STYLE.fonts.groupTitle);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.standings} – Gruppe ${group}`, x, y);

    // Get group standings
    const groupTeams = schedule.teams.filter(t => t.group === group);
    const groupStandings = currentStandings
      .filter(s => groupTeams.some(t => t.id === s.team.id))
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

    // Table data
    const headers: RowInput[] = [[t.pos, t.team, t.played, t.won, t.drawn, t.lost, t.goals, t.diff, t.points]];
    const data: RowInput[] = groupStandings.map((standing, index): CellInput[] => [
      (index + 1).toString(),
      standing.team.name,
      standing.played.toString(),
      standing.won.toString(),
      standing.drawn.toString(),
      standing.lost.toString(),
      `${standing.goalsFor}:${standing.goalsAgainst}`,
      standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference.toString(),
      standing.points.toString(),
    ]);

    // Render table
    autoTable(doc, {
      startY: y + 2,
      head: headers,
      body: data,
      margin: { left: x, right: PAGE_WIDTH - x - colWidth },
      tableWidth: colWidth,
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
        0: { halign: 'center', cellWidth: 8 },   // Pos
        1: { halign: 'left', cellWidth: 30 },    // Team
        2: { halign: 'center', cellWidth: 8 },   // Sp
        3: { halign: 'center', cellWidth: 7 },   // S
        4: { halign: 'center', cellWidth: 7 },   // U
        5: { halign: 'center', cellWidth: 7 },   // N
        6: { halign: 'center', cellWidth: 12 },  // Tore
        7: { halign: 'center', cellWidth: 10 },  // Diff
        8: { halign: 'center', cellWidth: 8 },   // Pkt
      },
    });
  }

  // Final yPos after all standings
  const totalRows = Math.ceil(groups.length / groupsPerRow);
  yPos += totalRows * 50 + PDF_STYLE.spacing.sectionGap;

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
