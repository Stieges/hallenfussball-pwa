/**
 * B-28 C8 – PDF-Dialog „Als PDF“ gegen das freigegebene Mockup (G44 bis G47, G63 bis G69, G77 bis G80), mit echten Texten
 * und echtem PDF-Bau; nur `doc.save` ist am Mitschnitt ersetzt. Szenarien: @BM-051/-028 (Olli über die Toolbar), @BM-032,
 * @ZM-064, @DR-011, @DR-012 (Hinweis vor dem Speichern, „Динамо Север“ ohne Hinweis), @DR-013, @DR-021, @DR-026, @DR-027,
 * @BM-057.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { PDF_FONT } from '../../../lib/pdf/fonts';
import { lastCapture, resetCapture } from '../../../lib/pdf/__tests__/pdfCapture';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('jspdf', async importOriginal => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('../../../lib/pdf/__tests__/pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});
vi.mock('../../../lib/pdf/schedulePdf', async importOriginal => {
  const real = await importOriginal<typeof import('../../../lib/pdf/schedulePdf')>();
  return { ...real, buildSchedulePdf: vi.fn(real.buildSchedulePdf) };
});

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { ScheduleToolbar } = await import('../../../features/tournament-management/components/ScheduleToolbar');
const { ScheduleActionButtons } = await import('../../ScheduleActionButtons');
const { PublicPdfButton } = await import('../../PublicPdfButton');
const { PDFExportDialog } = await import('../PDFExportDialog');
const schedulePdf = await import('../../../lib/pdf/schedulePdf');

import type { Tournament } from '../../../types/tournament';

const NOW = new Date(2026, 10, 14, 15, 7);
const ARABISCH = 'الأهلي';
const SHARED = { isPublic: true, shareCode: 'ABC123' };

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'tournament',
    ns: ['tournament'],
    resources: { de: { tournament: deTournament }, en: { tournament: enTournament } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  resetCapture();
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

function withTeams(names: string[], overrides: Partial<Tournament> = {}): Tournament {
  const teams = HALLENCUP_TEAMS.map((team, i) => (names[i] ? { ...team, name: names[i] } : team));
  return hallencupTournament({ teams, ...SHARED, ...overrides });
}

function renderToolbar(tournament: Tournament = hallencupTournament(SHARED)) {
  const noop = vi.fn();
  return render(
    <MemoryRouter>
      <ScheduleToolbar
        isEditing={false} onStartEditing={noop} onSave={noop} onCancel={noop} hasUnsavedChanges={false}
        onUndo={noop} onRedo={noop} canUndo={false} canRedo={false}
        onRedistributeSR={noop} onRedistributeFields={noop} showSRButton={false} showFieldsButton={false}
        viewMode="table" onViewModeChange={noop}
        tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]}
      />
    </MemoryRouter>,
  );
}

const openDialog = (): void => {
  fireEvent.click(screen.getByTestId('schedule-action-pdf'));
};
const save = async (): Promise<void> => {
  fireEvent.click(screen.getByTestId('pdf-save'));
  await waitFor(() => expect(screen.queryByTestId('pdf-save')).not.toBeInTheDocument(), { timeout: 20000 });
};
const text = (): string => (lastCapture()?.pages ?? []).flat().join(' ');

describe('@BM-051 @BM-028 Olli: Toolbar → „Als PDF“ → Wahl der Fassung', () => {
  it('Dialog „Als PDF“ nennt vier Karten und „Format: A4 hoch“; vorbelegt ist „Spielplan“', () => {
    renderToolbar();
    openDialog();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Als PDF' })).toBeInTheDocument();
    for (const id of ['schedule', 'blank', 'final', 'notice']) {
      expect(screen.getByTestId(`pdf-choice-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('pdf-choice-blank')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Format: A4 hoch')).toBeInTheDocument();
  });

  it('Spielplan zum Ausfüllen: das PDF trägt die Kopfzeile „Spielplan zum Ausfüllen“ und heißt wie im Record', async () => {
    renderToolbar();
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-choice-blank'));
    await save();

    expect(text()).toContain('Spielplan zum Ausfüllen');
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
  });

  it('Gegenbeispiel Vorbelegung: „Spielplan“ mit Kopfzeile „Spielplan“, hoch, nie „zum Ausfüllen“', async () => {
    renderToolbar();
    openDialog();
    await save();

    const captured = lastCapture();
    expect(captured?.pageWidth).toBeLessThan(captured?.pageHeight ?? 0);
    expect(text()).not.toContain('zum Ausfüllen');
    expect(captured?.pages[0]).toContain('Spielplan');
  });

  it('@DR-026 keine Wahl „quer“ und keine freie Wahl „Mit Spielstand“ oder „Tabellen einschließen“', () => {
    renderToolbar();
    openDialog();
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryByText(/quer/i)).toBeNull();
    expect(within(dialog).queryByText(/Mit Spielstand|Ohne Spielstand|Tabellen einschließen/)).toBeNull();
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('@DR-011 G44 G65 Karte „Endstand“: vor dem Abschluss ausgegraut mit Grund', () => {
  it('sichtbar, ausgegraut, nennt „Erst nach Abschluss des Turniers“ und ist nicht wählbar', () => {
    renderToolbar();
    openDialog();
    const card = screen.getByTestId('pdf-choice-final');

    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('pdf-choice-final-reason')).toHaveTextContent('Erst nach Abschluss des Turniers');
    expect(card).toHaveTextContent('Alle Plätze und die Ergebnisse, nach dem Abschluss des Turniers.');
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('pdf-choice-schedule')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('@ZM-064 @BM-017 G66 G67 G68 Karte „Aushang mit QR-Code“', () => {
  it('nicht online geteilt: ausgegraut mit „Erst nach dem Online-Teilen“, Hinweis mit Weg zum Teilen', () => {
    renderToolbar(hallencupTournament({ isPublic: false, shareCode: 'ABC123' }));
    openDialog();

    expect(screen.getByTestId('pdf-choice-notice')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('pdf-choice-notice-reason')).toHaveTextContent('Erst nach dem Online-Teilen');
    expect(screen.getByTestId('pdf-hint-not-shared')).toHaveTextContent('Der QR-Code erscheint, sobald das Turnier online geteilt ist.');
    expect(screen.getByTestId('pdf-choice-notice')).toHaveTextContent('Turniername, QR-Code und kurze Anleitung zum Aufhängen.');
  });

  it('geteilt: wählbar, Hinweis „Der Aushang zeigt nur den QR-Code …“, Datei Hallencup_Nord_Aushang_A4.pdf', async () => {
    renderToolbar();
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-choice-notice'));

    expect(screen.queryByTestId('pdf-hint-not-shared')).toBeNull();
    expect(screen.getByTestId('pdf-hint-notice')).toHaveTextContent('Der Aushang zeigt nur den QR-Code zur Zuschauer-Seite, keine Ergebnisse und Tabellen.');
    await save();
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Aushang_A4.pdf');
  });
});

describe('@BM-032 Sichtbarkeit: der Dialog sagt, was das PDF nicht zeigt', () => {
  it.each([
    ['Tabellen aus', { hideRankingsForPublic: true }, 'Tabellen sind für Zuschauer ausgeblendet – das PDF zeigt sie nicht.'],
    ['Ergebnisse aus', { hideScoresForPublic: true }, 'Ergebnisse sind für Zuschauer ausgeblendet – das PDF zeigt sie nicht.'],
    ['beides aus', { hideScoresForPublic: true, hideRankingsForPublic: true }, 'Ergebnisse und Tabellen sind für Zuschauer ausgeblendet – das PDF zeigt sie nicht.'],
  ])('%s', (_name, overrides, hint) => {
    renderToolbar(hallencupTournament({ ...SHARED, ...overrides }));
    openDialog();

    expect(screen.getByTestId('pdf-hint-visibility')).toHaveTextContent(hint);
    expect(screen.getByTestId('pdf-open-visibility')).toHaveTextContent('Sichtbarkeit ändern');
  });

  it('Gegenbeispiel: nichts ausgeblendet → kein Hinweis; und das PDF mit „Tabellen aus“ hat keine Gruppentabelle', async () => {
    const { unmount } = renderToolbar();
    openDialog();
    expect(screen.queryByTestId('pdf-hint-visibility')).toBeNull();
    unmount();

    renderToolbar(hallencupTournament({ ...SHARED, hideRankingsForPublic: true }));
    openDialog();
    await save();
    expect(text()).not.toMatch(/Tabelle\s*–\s*Gruppe/);
  });
});

describe('@DR-012 G45 G78 G80 Hinweis vor dem Speichern, nicht danach', () => {
  it('Kyrillisch „Динамо Север“ druckt ohne Hinweis: der Dialog speichert sofort und zeigt „PDF gespeichert“', async () => {
    const tournament = withTeams(['Динамо Север']);
    renderToolbar(tournament);
    openDialog();
    await save();

    expect(screen.queryByTestId('pdf-hint-step')).toBeNull();
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
    expect(screen.getByTestId('pdf-done')).toHaveTextContent('PDF gespeichert');
  });

  it('arabischer Teamname: eigener Schritt „Vor dem Speichern“, noch keine Datei, Original und „??????“, Hinweis zur Turnierleitung', async () => {
    renderToolbar(withTeams([ARABISCH]));
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-step', undefined, { timeout: 20000 });

    expect(screen.getByRole('heading', { name: 'Vor dem Speichern' })).toBeInTheDocument();
    expect(lastCapture()).toBeUndefined();
    expect(screen.getByText('Ein Teamname enthält Zeichen, die als „?“ gedruckt werden:')).toBeInTheDocument();
    const item = screen.getByTestId('pdf-hint-item');
    expect(item).toHaveTextContent(ARABISCH);
    expect(item).toHaveTextContent('wird gedruckt als');
    expect(item).toHaveTextContent('??????');
    expect(screen.getByText(/Das PDF wird trotzdem erzeugt\. Die Namen kann die Turnierleitung im Turnier ändern\./)).toBeInTheDocument();
  });

  it('„Trotzdem speichern“ speichert; „Abbrechen“ geht zurück zur Wahl und speichert nichts', async () => {
    renderToolbar(withTeams([ARABISCH]));
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-step', undefined, { timeout: 20000 });

    fireEvent.click(screen.getByTestId('pdf-back'));
    expect(screen.getByTestId('pdf-choice-schedule')).toBeInTheDocument();
    expect(lastCapture()).toBeUndefined();

    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-step', undefined, { timeout: 20000 });
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));
    expect(lastCapture()?.filename).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
    expect(screen.getByTestId('pdf-done')).toBeInTheDocument();
  });

  it('das PDF trägt an der Stelle des Zeichens „?“ (es entsteht trotzdem)', async () => {
    renderToolbar(withTeams([ARABISCH]));
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-step', undefined, { timeout: 20000 });
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));

    expect((lastCapture()?.pages ?? []).flat()).toContain('??????');
  });
});

describe('@DR-027 G79 Ersatzschrift: Hinweis vor dem Speichern', () => {
  it('Schrift lädt nicht: „Sonderzeichen können als ? erscheinen“ mit Folgesatz vor dem Speichern, danach entsteht das PDF', async () => {
    vi.spyOn(PDF_FONT.load, 'normal').mockRejectedValue(new Error('offline'));
    renderToolbar();
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-hint-font', undefined, { timeout: 20000 });

    expect(lastCapture()).toBeUndefined();
    expect(screen.getByTestId('pdf-hint-font')).toHaveTextContent('Sonderzeichen können als ? erscheinen');
    expect(screen.getByTestId('pdf-hint-font')).toHaveTextContent('Das PDF wird mit einer Ersatzschrift erstellt, alle Inhalte sind enthalten.');
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));
    expect(lastCapture()).toBeDefined();
  });
});

describe('@DR-013 G77 Scheitert das Erzeugen, entsteht keine Datei', () => {
  it('Bauen wirft: nichts gespeichert, Meldung im Du, „Erneut versuchen“; der zweite Versuch speichert genau einmal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(schedulePdf.buildSchedulePdf).mockRejectedValueOnce(new Error('boom'));
    renderToolbar();
    openDialog();
    fireEvent.click(screen.getByTestId('pdf-save'));
    await screen.findByTestId('pdf-error', undefined, { timeout: 20000 });

    expect(lastCapture()).toBeUndefined();
    expect(screen.getByTestId('pdf-error')).toHaveTextContent('PDF konnte nicht erstellt werden');
    expect(screen.getByTestId('pdf-error')).toHaveTextContent('Es wurde keine Datei gespeichert. Bitte versuche es erneut.');
    expect(screen.getByTestId('pdf-save')).toHaveTextContent('Erneut versuchen');

    await save();
    expect(lastCapture()?.filename).toContain('_Spielplan_');
  });
});

describe('@DR-021 G69 ohne Netz: Datum und Uhrzeit wie im PDF', () => {
  it('Hinweis „Ohne Verbindung – Stand 14.11. 15:07“, der Knopf bleibt aktiv, jede Seite trägt „ohne Verbindung“', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    renderToolbar();
    openDialog();

    expect(screen.getByTestId('pdf-hint-offline')).toHaveTextContent('Ohne Verbindung – Stand 14.11. 15:07');
    expect(screen.getByTestId('pdf-hint-offline')).toHaveTextContent('Das PDF entsteht trotzdem aus dem Stand auf diesem Gerät.');
    expect(screen.getByTestId('pdf-save')).toBeEnabled();
    await save();
    expect(text()).toContain('ohne Verbindung');
  });

  it('Gegenbeispiel: mit Netz kein Hinweis und keine „ohne Verbindung“-Zeile im PDF', async () => {
    renderToolbar();
    openDialog();
    expect(screen.queryByTestId('pdf-hint-offline')).toBeNull();
    await save();
    expect(text()).not.toContain('ohne Verbindung');
  });
});

describe('G46 Der Dialog bleibt nach dem Speichern stehen', () => {
  it('„PDF gespeichert“ mit Dateiname, bis „Schließen“ getippt wird', async () => {
    const onClose = vi.fn();
    const tournament = hallencupTournament(SHARED);
    render(<MemoryRouter><PDFExportDialog isOpen onClose={onClose} tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} /></MemoryRouter>);
    await save();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('pdf-done')).toHaveTextContent('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
    fireEvent.click(screen.getByTestId('pdf-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('@BM-057 G47 Zuschauer: der kleine Dialog bleibt, ohne Wahl', () => {
  const renderViewer = (tournament: Tournament) =>
    render(<MemoryRouter><PublicPdfButton tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} /></MemoryRouter>);

  it('Titel „Spielplan als PDF“, keine Karten, Hinweis „Ergebnisse und Tabellen sind ausgeblendet“, Format A4 hoch', () => {
    renderViewer(hallencupTournament(SHARED));
    fireEvent.click(screen.getByTestId('public-pdf-button'));

    expect(screen.getByRole('heading', { name: 'Spielplan als PDF' })).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-choice-blank')).toBeNull();
    expect(screen.queryByTestId('pdf-choice-notice')).toBeNull();
    expect(screen.getByText('Ergebnisse und Tabellen sind ausgeblendet – das PDF zeigt sie nicht.')).toBeInTheDocument();
    expect(screen.getByText('Format: A4 hoch')).toBeInTheDocument();
  });

  it('das PDF des Zuschauers hat keine Gruppentabelle und keine Platzierung, auch bei eingeschalteten Schaltern', async () => {
    renderViewer(hallencupTournament(SHARED));
    fireEvent.click(screen.getByTestId('public-pdf-button'));
    await save();

    expect(text()).not.toMatch(/Tabelle\s*–\s*Gruppe/);
    expect((lastCapture()?.pages ?? []).flat().some(t => /^\d+ Platzierung$/.test(t))).toBe(false);
  });

  it('@BM-057 über die alte Zuschauer-Adresse (variant public) gibt es keinen PDF-Knopf mehr, nur „Teilen“', () => {
    const tournament = hallencupTournament(SHARED);
    render(<MemoryRouter><ScheduleActionButtons tournament={tournament} schedule={hallencupSchedule(tournament)} standings={[]} variant="public" /></MemoryRouter>);

    expect(screen.queryByTestId('schedule-action-pdf')).toBeNull();
    expect(screen.queryByText('Als PDF')).toBeNull();
    expect(screen.getByText('Teilen')).toBeInTheDocument();
  });
});

describe('G63 englische App: Texte des Dialogs', () => {
  it('EN: „As PDF“, „Save as PDF“, „Try again“ nach Fehler, „Creating …“ ist vorhanden', async () => {
    await i18next.changeLanguage('en');
    try {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(schedulePdf.buildSchedulePdf).mockRejectedValueOnce(new Error('boom'));
      renderToolbar();
      expect(screen.getByTestId('schedule-action-pdf')).toHaveTextContent('As PDF');
      openDialog();
      expect(screen.getByTestId('pdf-save')).toHaveTextContent('Save as PDF');
      fireEvent.click(screen.getByTestId('pdf-save'));
      await screen.findByTestId('pdf-error', undefined, { timeout: 20000 });
      expect(screen.getByTestId('pdf-save')).toHaveTextContent('Try again');
      expect(enTournament.pdfExport.creating).toBe('Creating …');
    } finally {
      await i18next.changeLanguage('de');
    }
  });
});
