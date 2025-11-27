/**
 * PDF Exporter - Exportiert Schedule als druckfertiges PDF
 *
 * Verwendet jsPDF + autoTable für professionelle PDF-Generierung
 * Layout basiert auf MeinTurnierplan PDFs
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GeneratedSchedule, ScheduledMatch } from './scheduleGenerator';
import { Standing } from '../types/tournament';

export interface PDFExportOptions {
  /** Dateiname (ohne .pdf) */
  filename?: string;
  /** Logo URL (optional) */
  logoUrl?: string;
  /** QR-Code URL für Live-Tracking */
  qrCodeUrl?: string;
  /** Zeige Schiedsrichter-Spalte (SR) */
  showRefereeColumn?: boolean;
  /** Farb-Schema */
  primaryColor?: string;
  accentColor?: string;
  /** Sprache für Übersetzungen */
  locale?: 'de' | 'en';
}

/**
 * Grayscale-optimized color palette for print-friendly PDFs
 *
 * Design Philosophy:
 * - High contrast for readability in grayscale
 * - No color-only information (all info also conveyed through text/icons)
 * - Optimized for black & white laser printers
 */
const PDF_COLORS = {
  // Primary grayscale tones
  primary: '#2C2C2C',       // Dark gray (almost black) - high contrast
  primaryLight: '#6B6B6B',  // Medium gray
  primaryDark: '#000000',   // Black

  // Accent tones (gray-based)
  accent: '#4A4A4A',        // Medium-dark gray
  accentLight: '#8C8C8C',   // Light gray

  // Text colors
  textDark: '#000000',      // Pure black for maximum readability
  textMedium: '#505050',    // Dark gray
  textLight: '#808080',     // Medium gray

  // Backgrounds
  bgLight: '#F0F0F0',       // Very light gray (10% black)
  bgWhite: '#FFFFFF',       // White

  // Borders
  borderDark: '#333333',    // Dark border
  borderMedium: '#CCCCCC',  // Medium border
  borderLight: '#E0E0E0',   // Light border
};

/**
 * Hauptfunktion: Exportiert Schedule als PDF
 */
export async function exportScheduleAsPDF(
  schedule: GeneratedSchedule,
  options: PDFExportOptions = {}
): Promise<void> {
  // Auto-enable referee column if referees are configured
  const hasReferees = !!(schedule.refereeConfig && schedule.refereeConfig.mode !== 'none');

  const {
    filename = `${schedule.tournament.title.replace(/\s+/g, '_')}_Spielplan.pdf`,
    logoUrl,
    qrCodeUrl,
    showRefereeColumn = hasReferees,
    primaryColor = PDF_COLORS.primary,
    accentColor = PDF_COLORS.accent,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // A4-Format: 210mm x 297mm
  // Standardränder: 15mm auf allen Seiten
  // Nutzbare Fläche: 180mm x 267mm (von x=15 bis x=195, y=15 bis y=282)

  const hasGroups = schedule.teams.some(t => t.group);

  // Seite 1: Header + Spielplan + Tabelle
  await renderPage1(doc, schedule, { logoUrl, qrCodeUrl, showRefereeColumn, primaryColor, hasGroups });

  // Seite 2 (nur bei Finalrunde): Finalspiele + Finaltabelle
  const hasFinals = schedule.phases.some(p => p.name !== 'groupStage');
  if (hasFinals && hasGroups) {
    doc.addPage();
    renderPage2Finals(doc, schedule, { primaryColor, accentColor });
  }

  // Download
  doc.save(filename);
}

// ============================================================================
// PAGE 1: HAUPTSEITE (Spielplan + Tabelle)
// ============================================================================

async function renderPage1(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  options: {
    logoUrl?: string;
    qrCodeUrl?: string;
    showRefereeColumn: boolean;
    primaryColor: string;
    hasGroups: boolean;
  }
) {
  const { logoUrl, qrCodeUrl, showRefereeColumn, primaryColor, hasGroups } = options;
  const MAX_Y = 277; // Maximum Y position (15mm bottom margin: 297 - 15 - 5 for footer)
  let yPos = 15;

  // Logo (links oben)
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', 15, yPos, 25, 25);
    } catch (e) {
      console.warn('Logo konnte nicht geladen werden:', e);
    }
  }

  // Titel (zentriert)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(schedule.tournament.title, 105, yPos + 8, { align: 'center' });

  // QR-Code (rechts oben)
  if (qrCodeUrl) {
    try {
      doc.addImage(qrCodeUrl, 'PNG', 170, yPos, 25, 25);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Ergebnisse live', 182.5, yPos + 28, { align: 'center' });
    } catch (e) {
      console.warn('QR-Code konnte nicht geladen werden:', e);
    }
  }

  yPos += 35;

  // Meta-Infos Box (grayscale-optimized)
  doc.setFillColor(240, 240, 240); // Light gray background (PDF_COLORS.bgLight)
  doc.setDrawColor(204, 204, 204); // Medium gray border (PDF_COLORS.borderMedium)
  doc.setLineWidth(0.5);
  doc.roundedRect(15, yPos, 180, 30, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(PDF_COLORS.textDark));

  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const firstMatch = groupPhase?.matches[0];
  const matchDuration = firstMatch?.duration || 10;

  // Linke Spalte
  const metaY = yPos + 7;
  const leftX = 20;
  const rightX = 110;
  const lineHeight = 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Veranstalter:', leftX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.tournament.location, leftX + 30, metaY);

  doc.setFont('helvetica', 'bold');
  doc.text('Datum:', leftX, metaY + lineHeight);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.tournament.date, leftX + 30, metaY + lineHeight);

  doc.setFont('helvetica', 'bold');
  doc.text('Beginn:', leftX, metaY + lineHeight * 2);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatTime(schedule.startTime)} Uhr`, leftX + 30, metaY + lineHeight * 2);

  doc.setFont('helvetica', 'bold');
  doc.text('Ort:', leftX, metaY + lineHeight * 3);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.tournament.location, leftX + 30, metaY + lineHeight * 3);

  // Rechte Spalte
  doc.setFont('helvetica', 'bold');
  doc.text('Spieldauer:', rightX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${matchDuration} Min.`, rightX + 25, metaY);

  doc.setFont('helvetica', 'bold');
  doc.text('Teilnehmer:', rightX, metaY + lineHeight);
  doc.setFont('helvetica', 'normal');
  doc.text(`${schedule.teams.length} Teams`, rightX + 25, metaY + lineHeight);

  doc.setFont('helvetica', 'bold');
  doc.text('Spiele:', rightX, metaY + lineHeight * 2);
  doc.setFont('helvetica', 'normal');
  doc.text(`${schedule.allMatches.length} gesamt`, rightX + 25, metaY + lineHeight * 2);

  doc.setFont('helvetica', 'bold');
  doc.text('Ende (ca.):', rightX, metaY + lineHeight * 3);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatTime(schedule.endTime)} Uhr`, rightX + 25, metaY + lineHeight * 3);

  yPos += 38; // Increased spacing after meta box

  // Teilnehmerliste (bei Gruppen und bei Jeder-gegen-Jeden)
  yPos = renderParticipantsList(doc, schedule, yPos, primaryColor, hasGroups);
  yPos += 5; // Add spacing after participants list

  // Check if we need a new page before match table
  if (yPos > MAX_Y - 50) {
    doc.addPage();
    yPos = 15;
  }

  // Spielplan-Tabelle
  yPos = renderMatchTable(doc, schedule, yPos, showRefereeColumn, primaryColor, hasGroups);

  // Tabelle rechts (nur ohne Gruppen)
  if (!hasGroups) {
    renderStandingsTable(doc, schedule.initialStandings, 'Tabelle', 125, 80, primaryColor);
  }

  // Tabellen unten (bei Gruppen)
  if (hasGroups) {
    yPos += 8; // Add spacing before group standings

    // Check if we need a new page for group standings
    if (yPos > MAX_Y - 50) {
      doc.addPage();
      yPos = 15;
    }

    const groupStandings = getGroupStandings(schedule.initialStandings, schedule.teams);
    renderGroupStandings(doc, groupStandings, yPos, primaryColor);
  }

  // Footer (within 15mm bottom margin)
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Erstellt mit Hallenfußball Turnier Manager', 105, 287, { align: 'center' });
}

// ============================================================================
// PAGE 2: FINALRUNDE (nur bei Gruppen + Finals)
// ============================================================================

function renderPage2Finals(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  options: { primaryColor: string; accentColor: string }
) {
  const { primaryColor, accentColor } = options;
  let yPos = 15; // Start at 15mm top margin

  // Titel
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(schedule.tournament.title, 105, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(14);
  doc.text('Finalrunde', 105, yPos, { align: 'center' });

  yPos += 15;

  // Finalspiele-Tabelle
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  const finalMatches = finalPhases.flatMap(p => p.matches);

  if (finalMatches.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Nr.', 'Beginn', 'Spiel', 'Ergebnis', 'n.V.', 'n.E.']],
      body: finalMatches.map(match => [
        match.matchNumber.toString(),
        match.time,
        `${getFinalMatchLabel(match)}\n${match.homeTeam} - ${match.awayTeam}`,
        ' : ',
        '',
        '',
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: hexToRgb(accentColor),
        textColor: hexToRgb(PDF_COLORS.textDark),
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: hexToRgb(PDF_COLORS.textDark),
      },
      alternateRowStyles: {
        fillColor: hexToRgb(PDF_COLORS.bgLight),
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 80 },
        3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
      },
      margin: { left: 15, right: 15 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Finaltabelle (Plätze 1-10)
  const finalStandingsData = [
    ['1.', ''],
    ['2.', ''],
    ['3.', ''],
    ['4.', ''],
    ['5.', ''],
    ['6.', ''],
    ['7.', ''],
    ['8.', ''],
    ['9.', ''],
    ['10.', ''],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Pl', 'Teilnehmer']],
    body: finalStandingsData,
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(primaryColor),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 100 },
    },
    margin: { left: 15 },
  });
}

// ============================================================================
// HELPER RENDERERS
// ============================================================================

function renderParticipantsList(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  yPos: number,
  _primaryColor: string,
  hasGroups: boolean
): number {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Teilnehmer', 15, yPos);

  yPos += 5;

  if (hasGroups) {
    // Mit Gruppen: Gruppiert darstellen
    const groupStandings = getGroupStandings(schedule.initialStandings, schedule.teams as any);
    const xOffset = 15;
    const colWidth = 90;

    groupStandings.forEach((groupData, index) => {
      const xPos = xOffset + (index % 2) * colWidth;
      const currentYPos = yPos + Math.floor(index / 2) * 30;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Gruppe ${groupData.group}`, xPos, currentYPos);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      groupData.groupStandings.forEach((standing, teamIndex) => {
        const teamY = currentYPos + 5 + teamIndex * 4;
        doc.text(`${teamIndex + 1}. ${standing.team.name}`, xPos, teamY);
      });
    });

    return yPos + Math.ceil(groupStandings.length / 2) * 30 + 5;
  } else {
    // Ohne Gruppen (Jeder gegen Jeden): In Spalten darstellen
    const teams = schedule.teams;
    const columns = 3; // 3 Spalten
    const colWidth = 60;
    const xOffset = 15;
    const teamsPerColumn = Math.ceil(teams.length / columns);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    teams.forEach((team, index) => {
      const col = Math.floor(index / teamsPerColumn);
      const row = index % teamsPerColumn;
      const xPos = xOffset + col * colWidth;
      const teamY = yPos + row * 5;

      doc.text(`${index + 1}. ${team.name}`, xPos, teamY);
    });

    return yPos + teamsPerColumn * 5 + 5;
  }
}

function getColumnStyles(hasGroups: boolean, showFieldColumn: boolean, showRefereeColumn: boolean) {
  if (hasGroups) {
    // Mit Gruppen: Nr | Beginn | Gr | Spiel | Ergebnis | [Feld] | [SR]
    const styles: any = {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // Nr
      1: { cellWidth: 18, halign: 'center' }, // Beginn
      2: { cellWidth: 10, halign: 'center' }, // Gr
      3: { cellWidth: showFieldColumn || showRefereeColumn ? 50 : 60 }, // Spiel
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Ergebnis
    };

    let colIndex = 5;
    if (showFieldColumn) {
      styles[colIndex] = { cellWidth: 12, halign: 'center' }; // Feld
      colIndex++;
    }
    if (showRefereeColumn) {
      styles[colIndex] = { cellWidth: 12, halign: 'center' }; // SR
    }
    return styles;
  } else {
    // Ohne Gruppen: Nr | Beginn | Spiel | Ergebnis | [Feld] | [SR]
    const styles: any = {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // Nr
      1: { cellWidth: 18, halign: 'center' }, // Beginn
      2: { cellWidth: showFieldColumn || showRefereeColumn ? 50 : 60 }, // Spiel
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Ergebnis
    };

    let colIndex = 4;
    if (showFieldColumn) {
      styles[colIndex] = { cellWidth: 12, halign: 'center' }; // Feld
      colIndex++;
    }
    if (showRefereeColumn) {
      styles[colIndex] = { cellWidth: 12, halign: 'center' }; // SR
    }
    return styles;
  }
}

function renderMatchTable(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  yPos: number,
  showRefereeColumn: boolean,
  primaryColor: string,
  hasGroups: boolean
): number {
  const phase = schedule.phases.find(p => p.name === 'groupStage');
  if (!phase) return yPos;

  const showFieldColumn = schedule.numberOfFields > 1;

  const headers = hasGroups
    ? ['Nr.', 'Beginn', 'Gr', 'Spiel', 'Ergebnis']
    : ['Nr.', 'Beginn', 'Spiel', 'Ergebnis'];

  if (showFieldColumn) {
    headers.push('Feld');
  }

  if (showRefereeColumn) {
    headers.push('SR');
  }

  const body = phase.matches.map(match => {
    const row = [
      match.matchNumber.toString(),
      match.time,
    ];

    if (hasGroups) {
      row.push(match.group || '-');
    }

    row.push(`${match.homeTeam} - ${match.awayTeam}`);
    row.push(' : ');

    if (showFieldColumn) {
      row.push(match.field ? match.field.toString() : '-');
    }

    if (showRefereeColumn) {
      row.push(match.referee ? match.referee.toString() : '-');
    }

    return row;
  });

  const tableWidth = hasGroups ? 120 : 110;

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: hexToRgb(primaryColor),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: hexToRgb(PDF_COLORS.textDark),
    },
    alternateRowStyles: {
      fillColor: hexToRgb(PDF_COLORS.bgLight),
    },
    columnStyles: getColumnStyles(hasGroups, showFieldColumn, showRefereeColumn),
    margin: { left: 15, right: hasGroups ? 15 : 100 },
    tableWidth: tableWidth,
  });

  return (doc as any).lastAutoTable.finalY;
}

function renderStandingsTable(
  doc: jsPDF,
  standings: Standing[],
  title: string,
  xPos: number,
  yPos: number,
  primaryColor: string
) {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, xPos, yPos);

  yPos += 5;

  const headers = ['Pl', 'Team', 'Sp', 'S', 'U', 'N', 'T', 'TD', 'Pkt'];
  const body = standings.map((standing, index) => [
    (index + 1).toString(),
    standing.team.name.substring(0, 15),
    standing.played.toString(),
    standing.won.toString(),
    standing.drawn.toString(),
    standing.lost.toString(),
    `${standing.goalsFor}:${standing.goalsAgainst}`,
    (standing.goalDifference >= 0 ? '+' : '') + standing.goalDifference,
    standing.points.toString(),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: hexToRgb(primaryColor),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: hexToRgb(PDF_COLORS.textDark),
    },
    alternateRowStyles: {
      fillColor: hexToRgb(PDF_COLORS.bgLight),
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', fillColor: hexToRgb(PDF_COLORS.bgLight) },
      1: { cellWidth: 30 },
      2: { cellWidth: 7, halign: 'center' },
      3: { cellWidth: 7, halign: 'center' },
      4: { cellWidth: 7, halign: 'center' },
      5: { cellWidth: 7, halign: 'center' },
      6: { cellWidth: 12, halign: 'center', fontSize: 6 },
      7: { cellWidth: 10, halign: 'center' },
      8: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: xPos },
    tableWidth: 70,
  });
}

function renderGroupStandings(
  doc: jsPDF,
  groupStandings: Array<{ group: string; groupStandings: Standing[] }>,
  yPos: number,
  primaryColor: string
) {
  const xOffset = 15;
  const colWidth = 90;

  groupStandings.forEach((groupData, index) => {
    const xPos = xOffset + (index % 2) * colWidth;
    const currentYPos = yPos + Math.floor(index / 2) * 60;

    renderStandingsTable(
      doc,
      groupData.groupStandings,
      `Gruppe ${groupData.group}`,
      xPos,
      currentYPos,
      primaryColor
    );
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getFinalMatchLabel(match: ScheduledMatch): string {
  if (match.finalType === 'final') return 'Finale';
  if (match.finalType === 'thirdPlace') return 'Spiel um Platz 3';
  if (match.finalType === 'fifthSixth') return 'Spiel um Platz 5';
  if (match.finalType === 'seventhEighth') return 'Spiel um Platz 7';

  // Check for semifinal labels from match definition
  if (match.label?.includes('Halbfinale')) return match.label;
  if (match.phase === 'semifinal') return 'Halbfinale';
  if (match.phase === 'roundOf16') return 'Achtelfinale';
  if (match.phase === 'quarterfinal') return 'Viertelfinale';

  return 'Finalspiel';
}

function getGroupStandings(
  allStandings: Standing[],
  teams: Array<{ id: string; name: string; group?: string }>
): Array<{ group: string; groupStandings: Standing[] }> {
  const groups = new Set(teams.map(t => t.group).filter(Boolean)) as Set<string>;

  return Array.from(groups)
    .sort()
    .map(group => ({
      group,
      groupStandings: allStandings.filter(s =>
        teams.find(t => t.id === s.team.id)?.group === group
      ),
    }));
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 230, 118]; // Fallback: primary green
}
