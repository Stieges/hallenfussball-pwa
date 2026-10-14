/**
 * PDF-Export-Dialog: Hinweise nach dem Export (B-28a2 Fixrunde F4). Mit Hinweisen bleibt der Dialog offen und zeigt
 * nur „Schließen“. Ohne Hinweise schließt er sich wie bisher.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { exportScheduleToPDF } from '../../../lib/pdfExporter';
import { generateFullSchedule } from '../../../core/generators';
import { hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';
import { PDFExportDialog } from '../PDFExportDialog';

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

const exportMock = vi.mocked(exportScheduleToPDF);
const tournament = hallencupTournament();
const schedule = generateFullSchedule(tournament, 'de');
const NOTE = 'Teamname ‚Ярославль‘ enthält Zeichen, die im PDF nicht dargestellt werden können';

function renderDialog(onClose: () => void) {
  return render(
    <PDFExportDialog isOpen onClose={onClose} tournament={tournament} schedule={schedule} standings={[]} />,
  );
}

describe('PDFExportDialog – Hinweise nach dem Export', () => {
  beforeEach(() => {
    exportMock.mockReset();
  });

  it('zeigt die Hinweise im Statusbereich, bietet nur „Schließen“ und schließt nicht von allein', async () => {
    exportMock.mockResolvedValue({ notes: [NOTE] });
    const onClose = vi.fn();
    renderDialog(onClose);

    fireEvent.click(screen.getByText('tournament:pdfExport.export'));

    const notes = await screen.findByTestId('pdf-export-notes');
    expect(notes).toHaveAttribute('role', 'status');
    expect(notes).toHaveTextContent(NOTE);
    expect(screen.queryByText('tournament:pdfExport.export')).not.toBeInTheDocument();
    expect(screen.queryByText('tournament:pdfExport.cancel')).not.toBeInTheDocument();

    // Nach einer Wartezeit ist der Dialog noch offen (kein automatisches Schließen mit Hinweisen).
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('tournament:pdfExport.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Hinweise schließt der Dialog wie bisher', async () => {
    exportMock.mockResolvedValue({ notes: [] });
    const onClose = vi.fn();
    renderDialog(onClose);

    fireEvent.click(screen.getByText('tournament:pdfExport.export'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(screen.queryByTestId('pdf-export-notes')).not.toBeInTheDocument();
  });
});
