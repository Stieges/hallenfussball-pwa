
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tournament } from '../types/tournament';
import { calculateScorers, calculateFairPlay } from '../utils/calculations';

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

export async function exportStatisticsToPDF(tournament: Tournament): Promise<void> {
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
    const scorers = calculateScorers(tournament);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable adds lastAutoTable property dynamically
        yPos = (doc as any).lastAutoTable.finalY + PDF_STYLE.spacing.sectionGap;
    } else {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...PDF_STYLE.colors.textMuted);
        doc.text('Keine Torschützen vorhanden.', PDF_STYLE.spacing.pageMargin.left, yPos);
        yPos += 10;
    }

    // 2. Fair-Play-Tabelle
    const fairPlay = calculateFairPlay(tournament);

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
        head: [['Pl.', 'Team', 'Punkte', 'Gelb (1)', 'Zeit (3)', 'Rot (5)']],
        body: fairPlay.map((f, i) => [
            (i + 1).toString(),
            f.teamName,
            f.points.toString(),
            f.yellowCards.toString(),
            f.timePenalties.toString(),
            f.redCards.toString()
        ]),
        styles: { fontSize: PDF_STYLE.fonts.table },
        headStyles: { fillColor: PDF_STYLE.colors.headBg, textColor: PDF_STYLE.colors.textMain, fontStyle: 'bold' },
        margin: { left: PDF_STYLE.spacing.pageMargin.left, right: PDF_STYLE.spacing.pageMargin.right },
    });

    // Save
    const filename = `${tournament.title.replace(/\s+/g, '_')}_Statistik.pdf`;
    doc.save(filename);
}
