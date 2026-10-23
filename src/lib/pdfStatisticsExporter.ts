
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tournament } from '../types/tournament';
import { calculateScorers, calculateFairPlay, type EngineEventsById } from '../utils/calculations';
import { pdfKartenFarben } from './pdf/kartenFarben';
import { printColors, printStroke } from '../design-tokens/print';

// Reuse styles from pdfExporter (simplified)
const PDF_STYLE = {
    colors: {
        headBg: [249, 250, 251] as [number, number, number],
        textMain: [17, 24, 39] as [number, number, number],
        textMuted: [107, 114, 128] as [number, number, number],
    },
    fonts: {
        h1: 18,
        h2: 15,
        sectionTitle: 14,
        table: 11,
    },
    spacing: {
        pageMargin: { top: 20, left: 15, right: 15 },
        sectionGap: 10,
    }
};

// Spaltenpositionen der Fair-Play-Tabelle: Pl., Team, Punkte, Gelb, Gelb-Rot, Zeit, Rot
const COL_YELLOW = 3;
const COL_YELLOW_RED = 4;
const COL_RED = 6;
const GELB_ROT_LABEL = 'Gelb-Rot';
/** Rechter Innenrand der Gelb-Rot-Kopfzelle als Vielfaches des normalen: dort sitzt die rote Ecke. */
const ECKE_RAND_FAKTOR = 3;

export async function exportStatisticsToPDF(tournament: Tournament, engineEventsById?: EngineEventsById): Promise<void> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    doc.setFont('helvetica');

    let yPos = PDF_STYLE.spacing.pageMargin.top;

    // Title
    doc.setFontSize(PDF_STYLE.fonts.h1);
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text('Statistik-Report', 105, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(PDF_STYLE.fonts.h2);
    doc.setFont('helvetica', 'normal');
    doc.text(tournament.title, 105, yPos, { align: 'center' });
    yPos += PDF_STYLE.spacing.sectionGap;

    // 1. Torschützenliste
    const scorers = calculateScorers(tournament, engineEventsById);

    doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Torschützenliste', PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 6;

    if (scorers.length > 0) {
        autoTable(doc, {
            startY: yPos,
            head: [['Pl.', 'Spieler', 'Team', 'Tore', 'Vorlagen']],
            body: scorers.map((s, i) => [
                (i + 1).toString(),
                s.playerName,
                s.teamName,
                s.goals.toString(),
                s.assists.toString()
            ]),
            styles: { fontSize: PDF_STYLE.fonts.table },
            headStyles: { fillColor: PDF_STYLE.colors.headBg, textColor: PDF_STYLE.colors.textMain, fontStyle: 'bold' },
            margin: { left: PDF_STYLE.spacing.pageMargin.left, right: PDF_STYLE.spacing.pageMargin.right },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jspdf-autotable adds lastAutoTable property dynamically
        yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;
    } else {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...PDF_STYLE.colors.textMuted);
        doc.text('Keine Torschützen vorhanden.', PDF_STYLE.spacing.pageMargin.left, yPos);
        yPos += 10;
    }

    // 2. Fair-Play-Tabelle
    const fairPlay = calculateFairPlay(tournament, engineEventsById);

    // Check if we need new page
    if (yPos > 250) {
        doc.addPage();
        yPos = PDF_STYLE.spacing.pageMargin.top;
    }

    doc.setFontSize(PDF_STYLE.fonts.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_STYLE.colors.textMain);
    doc.text('Fair-Play-Tabelle', PDF_STYLE.spacing.pageMargin.left, yPos);
    yPos += 6;

    autoTable(doc, {
        startY: yPos,
        // F3b1 (PO 30.09.): keine festen Punktwerte mehr in der Kopfzeile -- die haengen vom
        // Fair-Play-Profil ab (calculateFairPlay nutzt ohne Parameter den Standard DFBNET).
        head: [['Pl.', 'Team', 'Punkte', 'Gelb', GELB_ROT_LABEL, 'Zeit', 'Rot']],
        body: fairPlay.map((f, i) => [
            (i + 1).toString(),
            f.teamName,
            f.points.toString(),
            f.yellowCards.toString(),
            f.yellowRedCards.toString(),
            f.timePenalties.toString(),
            f.redCards.toString()
        ]),
        styles: { fontSize: PDF_STYLE.fonts.table },
        headStyles: { fillColor: PDF_STYLE.colors.headBg, textColor: PDF_STYLE.colors.textMain, fontStyle: 'bold' },
        // Karten-Farben nur für Karten (Oberfläche E): Kopfzellen Gelb / Gelb-Rot / Rot in Kartenfarbe, Werte aus den Karten-Tokens.
        didParseCell: (data) => {
            if (data.section !== 'head') { return; }
            if (data.column.index === COL_YELLOW || data.column.index === COL_YELLOW_RED) {
                data.cell.styles.fillColor = [...pdfKartenFarben.yellow];
                data.cell.styles.textColor = [...pdfKartenFarben.textOnYellow];
                if (data.column.index === COL_YELLOW_RED) {
                    const rand = (seite: 'top' | 'bottom' | 'left' | 'right'): number => data.cell.padding(seite);
                    data.cell.styles.cellPadding = { top: rand('top'), bottom: rand('bottom'), left: rand('left'), right: rand('right') * ECKE_RAND_FAKTOR };
                }
            } else if (data.column.index === COL_RED) {
                data.cell.styles.fillColor = [...pdfKartenFarben.red];
                data.cell.styles.textColor = [...pdfKartenFarben.textOnRed];
            }
        },
        // Gelb-Rot: die Beschriftung liegt ganz auf Gelb (Tinte, gleiche Grundlinie wie die anderen Kopfzellen), Rot nur als Ecke im
        // verbreiterten rechten Rand – nie unter der Schrift, also lesbar unabhängig vom Untergrund.
        didDrawCell: (data) => {
            if (data.section !== 'head' || data.column.index !== COL_YELLOW_RED) { return; }
            const { x, y, width, height } = data.cell;
            const ecke = data.cell.padding('right');
            // weiße Trennlinie an der linken Kante: „Gelb“ und „Gelb-Rot“ bleiben zwei Zellen
            doc.setDrawColor(...printColors.paper);
            doc.setLineWidth(printStroke.thead);
            doc.line(x, y, x, y + height);
            doc.setFillColor(...pdfKartenFarben.red);
            doc.triangle(x + width, y, x + width, y + height, x + width - ecke, y + height, 'F');
        },
        margin: { left: PDF_STYLE.spacing.pageMargin.left, right: PDF_STYLE.spacing.pageMargin.right },
    });

    // Save
    const filename = `${tournament.title.replace(/\s+/g, '_')}_Statistik.pdf`;
    doc.save(filename);
}
