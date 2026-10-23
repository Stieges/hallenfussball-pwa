/**
 * Vorschau beim Anlegen (Wizard, HÄUFIG VERGESSEN): der PDF-Knopf öffnet den Dialog „Als PDF“; Hinweise zu Zeichen kommen
 * VOR dem Speichern (@DR-012, G45), Knopf und Hinweistext in den Sprachdateien (G63, G64). Echte Texte, echter PDF-Bau,
 * nur `doc.save` am Mitschnitt.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import deTournament from '../../../i18n/locales/de/tournament.json';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';
import { lastCapture, resetCapture } from '../../../lib/pdf/__tests__/pdfCapture';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';

vi.mock('../../../components/ScheduleDisplay', () => ({ ScheduleDisplay: () => <div /> }));
vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('jspdf', async importOriginal => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('../../../lib/pdf/__tests__/pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { TournamentPreview } = await import('../TournamentPreview');

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'wizard',
    ns: ['wizard', 'tournament'],
    resources: { de: { wizard: deWizard, tournament: deTournament }, en: { wizard: enWizard, tournament: deTournament } },
    interpolation: { escapeValue: false },
  });
});
beforeEach(() => resetCapture());
afterEach(() => vi.restoreAllMocks());

function renderPreview(names: string[] = []) {
  const teams = HALLENCUP_TEAMS.map((team, i) => (names[i] ? { ...team, name: names[i] } : team));
  const tournament = hallencupTournament({ teams, isPublic: false, shareCode: undefined });
  return render(<TournamentPreview tournament={tournament} schedule={hallencupSchedule(tournament)} onEdit={() => undefined} onPublish={() => undefined} />);
}

describe('G63 G64 Vorschau: Knopf „Als PDF“ und Hinweistext aus den Sprachdateien', () => {
  it('der Knopf heißt „Als PDF“, der Hinweis sagt „festgelegt“ und „speichern“, nie „freigegeben“ oder „exportieren“', () => {
    renderPreview();

    expect(screen.getByTestId('preview-export-pdf')).toHaveTextContent('Als PDF');
    expect(document.body.textContent).toContain('Solange das Turnier nicht festgelegt ist');
    expect(document.body.textContent).toContain('als PDF speichern');
    expect(document.body.textContent).not.toMatch(/freigegeben|exportieren/);
  });

  it('der Knopf öffnet den Dialog; der Aushang ist ausgegraut, weil nicht online geteilt', () => {
    renderPreview();
    fireEvent.click(screen.getByTestId('preview-export-pdf'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-choice-notice')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('@DR-012 Vorschau: Hinweis vor dem Speichern', () => {
  it('Gegenbeispiel: ohne auffällige Zeichen speichert der Dialog sofort', async () => {
    renderPreview(['Динамо Север']);
    fireEvent.click(screen.getByTestId('preview-export-pdf'));
    fireEvent.click(screen.getByTestId('pdf-save'));

    await waitFor(() => expect(lastCapture()).toBeDefined(), { timeout: 20000 });
    expect(screen.queryByTestId('pdf-hint-step')).toBeNull();
  });

  it('arabischer Teamname: erst der Hinweis, noch keine Datei; „Trotzdem speichern“ speichert', async () => {
    renderPreview(['الأهلي']);
    fireEvent.click(screen.getByTestId('preview-export-pdf'));
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-step', undefined, { timeout: 20000 });

    expect(lastCapture()).toBeUndefined();
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));
    expect(lastCapture()).toBeDefined();
  });
});
