/**
 * Vorschau: Hinweise aus dem PDF-Export erscheinen als Warn-Toast (B-28a2 Fixrunde F5). Ohne Hinweise kein Toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import { ToastProvider } from '../../../components/ui/Toast';

vi.mock('../../../core/generators', () => ({ generateFullSchedule: vi.fn() }));
vi.mock('../../../components/ScheduleDisplay', () => ({ ScheduleDisplay: () => <div /> }));
vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

import { exportScheduleToPDF } from '../../../lib/pdfExporter';
import { TournamentPreview } from '../TournamentPreview';

const exportMock = vi.mocked(exportScheduleToPDF);
const NOTE = 'Teamname ‚Ярославль‘ enthält Zeichen, die im PDF nicht dargestellt werden können';

const tournament = {
  id: 't1',
  title: 'Test Cup',
  ageClass: 'U13',
  date: '2030-01-01',
  teams: [{ id: '1', name: 'A' }],
  matches: [],
  status: 'draft',
  location: { name: 'Halle' },
} as unknown as Tournament;

const schedule = {
  allMatches: [],
  initialStandings: [],
  tournament,
  phases: [],
  teams: [],
  numberOfFields: 1,
} as unknown as GeneratedSchedule;

function renderPreview() {
  return render(
    <ToastProvider>
      <TournamentPreview tournament={tournament} schedule={schedule} onEdit={() => undefined} onPublish={() => undefined} />
    </ToastProvider>,
  );
}

describe('TournamentPreview – Hinweise aus dem PDF-Export', () => {
  beforeEach(() => {
    exportMock.mockReset();
  });

  it('zeigt jeden Hinweis als Toast', async () => {
    exportMock.mockResolvedValue({ notes: [NOTE] });
    renderPreview();

    fireEvent.click(screen.getByTestId('preview-export-pdf'));

    expect(await screen.findByText(NOTE)).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Hinweise erscheint kein Toast', async () => {
    exportMock.mockResolvedValue({ notes: [] });
    renderPreview();

    fireEvent.click(screen.getByTestId('preview-export-pdf'));

    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
