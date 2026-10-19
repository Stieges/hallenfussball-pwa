/**
 * A-11 @ZM-019 „den Aushang zum Drucken erzeugen“ (R-A11-5: tournamentSettings): Maria (Co-Admin) bekommt die Karte
 * „Aushang mit QR-Code“ angeboten; ohne das Recht (Tom, Helfer) fehlt die Gruppe „Zum Aufhängen“. Das Recht fragt der
 * Aufrufer über useCan und gibt es als `canCreateNotice` herein.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import deTournament from '../../../i18n/locales/de/tournament.json';
import { hallencupSchedule, hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';

vi.unmock('i18next');
vi.unmock('react-i18next');

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { PDFExportDialog } = await import('../PDFExportDialog');

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'],
    resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false },
  });
});

const tournament = hallencupTournament({ isPublic: true, shareCode: 'ABC123' });
const schedule = hallencupSchedule(tournament);

describe('@ZM-019 Aushang zum Drucken', () => {
  it('@ZM-019 ohne Recht auf Turniereinstellungen (Tom): „Aushang mit QR-Code“ ist nicht angeboten', () => {
    render(<PDFExportDialog isOpen onClose={vi.fn()} tournament={tournament} schedule={schedule} standings={[]} canCreateNotice={false} />);
    expect(screen.queryByTestId('pdf-choice-notice')).not.toBeInTheDocument();
    expect(screen.queryByText('Zum Aufhängen')).not.toBeInTheDocument();
    expect(screen.getByTestId('pdf-choice-schedule')).toBeInTheDocument();
  });

  it('Gegenbeispiel @ZM-019 Maria (Co-Admin): „Aushang mit QR-Code“ ist angeboten', () => {
    render(<PDFExportDialog isOpen onClose={vi.fn()} tournament={tournament} schedule={schedule} standings={[]} canCreateNotice />);
    expect(screen.getByTestId('pdf-choice-notice')).toBeInTheDocument();
  });
});
