/**
 * PDF-Paket T8: der Dialog „Als PDF“ liest die Turniergrafiken dieses Geräts aus dem Gerätespeicher und gibt sie samt
 * Akzentfarbe an Spielplan und Aushang (@DR-023, @DR-024, @DR-041, @W3-030). Der Speicher ist hier ein Zwischenspeicher im
 * Arbeitsspeicher; der echte Speicher hat eigene Tests (T3).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TournamentGraphics } from '../../../core/storage/tournamentGraphicsStore';
import deTournament from '../../../i18n/locales/de/tournament.json';
import { lastCapture, resetCapture } from '../../../lib/pdf/__tests__/pdfCapture';
import { hallencupSchedule, hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';
import { pngBytes } from '../../../lib/pdf/__tests__/pdfLogoFixture';

vi.unmock('i18next');
vi.unmock('react-i18next');
const store = vi.hoisted(() => ({ graphics: {}, failure: undefined as Error | undefined, loads: 0 }));
vi.mock('jspdf', async importOriginal => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('../../../lib/pdf/__tests__/pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});
vi.mock('../../../lib/pdf/schedulePdf', async importOriginal => {
  const real = await importOriginal<typeof import('../../../lib/pdf/schedulePdf')>();
  return { ...real, buildSchedulePdf: vi.fn(real.buildSchedulePdf) };
});
vi.mock('../../../lib/pdf/notice', async importOriginal => {
  const real = await importOriginal<typeof import('../../../lib/pdf/notice')>();
  return { ...real, buildNoticePdf: vi.fn(real.buildNoticePdf) };
});
vi.mock('../../../core/storage/tournamentGraphicsStore', async importOriginal => {
  const real = await importOriginal<typeof import('../../../core/storage/tournamentGraphicsStore')>();
  return {
    ...real,
    tournamentGraphicsStore: {
      load: async () => { store.loads += 1; if (store.failure) { throw store.failure; } return store.graphics; },
      save: async () => undefined, remove: async () => undefined, copy: async () => undefined,
    },
  };
});

const i18next = (await import('i18next')).default;
const { initReactI18next } = await import('react-i18next');
const { PDFExportDialog } = await import('../PDFExportDialog');
const schedulePdf = await import('../../../lib/pdf/schedulePdf');
const notice = await import('../../../lib/pdf/notice');

const BLAU = '#2A2576';
const tournament = hallencupTournament({ isPublic: true, shareCode: 'ABC123' });
const schedule = hallencupSchedule(tournament);
const grafik = (breite: number, hoehe: number) => ({
  dataUrl: `data:image/png;base64,${Buffer.from(pngBytes(breite, hoehe)).toString('base64')}`, widthPx: breite, heightPx: hoehe, originalHeightPx: hoehe,
});
const KAPUTT = { dataUrl: 'data:image/png;base64,AAECAwQFBgcICQ==', widthPx: 300, heightPx: 300, originalHeightPx: 300 };

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'],
    resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  resetCapture();
  store.graphics = {};
  store.failure = undefined;
  store.loads = 0;
  vi.mocked(schedulePdf.buildSchedulePdf).mockClear();
  vi.mocked(notice.buildNoticePdf).mockClear();
});

const renderDialog = () => render(<MemoryRouter><PDFExportDialog isOpen onClose={vi.fn()} tournament={tournament} schedule={schedule} standings={[]} /></MemoryRouter>);
const speichern = async (): Promise<void> => {
  fireEvent.click(screen.getByTestId('pdf-save'));
  await waitFor(() => expect(screen.queryByTestId('pdf-save')).not.toBeInTheDocument(), { timeout: 20000 });
};

describe('@DR-041 @DR-023 Grafiken und Akzent aus dem Gerätespeicher gehen an den Spielplan', () => {
  it('Spielplan: linke und rechte Grafik und der Akzent des Wappens kommen im Bau an, ohne Hinweis', async () => {
    store.graphics = { left: grafik(240, 240), right: grafik(480, 240), accent: BLAU } satisfies TournamentGraphics;
    renderDialog();

    await speichern();

    const options = vi.mocked(schedulePdf.buildSchedulePdf).mock.calls[0][0].options;
    expect(options.logoLeft?.format).toBe('PNG');
    expect(options.logoRight?.format).toBe('PNG');
    expect(options.accent).toEqual({ line: BLAU, tint: '#DDDCE9' });
    expect(screen.getByTestId('pdf-done')).toBeInTheDocument();
    expect(lastCapture()).toBeDefined();
  });

  it('Aushang: dieselben Grafiken und derselbe Akzent', async () => {
    store.graphics = { left: grafik(240, 240), right: grafik(480, 240), accent: BLAU };
    renderDialog();
    fireEvent.click(screen.getByTestId('pdf-choice-notice'));

    await speichern();

    const input = vi.mocked(notice.buildNoticePdf).mock.calls[0][0];
    expect(input.graphics.left?.format).toBe('PNG');
    expect(input.graphics.right?.format).toBe('PNG');
    expect(input.accent).toEqual({ line: BLAU, tint: '#DDDCE9' });
  });

  it('@W3-030 Gerät ohne Eintrag (Co-Admin): keine Grafik, kein Akzent, kein Hinweis, das PDF wird sofort gespeichert', async () => {
    renderDialog();

    await speichern();

    const options = vi.mocked(schedulePdf.buildSchedulePdf).mock.calls[0][0].options;
    expect(options.logoLeft).toBeUndefined();
    expect(options.logoRight).toBeUndefined();
    expect(options.accent).toBeUndefined();
    expect(screen.queryByTestId('pdf-hint-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('pdf-done')).toBeInTheDocument();
  });

  it('der Speicher wird bei jedem Speichern frisch gelesen: eine zwischendurch hinterlegte Grafik kommt mit', async () => {
    renderDialog();
    await speichern();
    expect(vi.mocked(schedulePdf.buildSchedulePdf).mock.calls[0][0].options.logoLeft).toBeUndefined();

    store.graphics = { left: grafik(240, 240), accent: BLAU };
    fireEvent.click(screen.getByTestId('pdf-close'));
    fireEvent.click(screen.getByTestId('pdf-save'));
    await waitFor(() => expect(vi.mocked(schedulePdf.buildSchedulePdf).mock.calls).toHaveLength(2), { timeout: 20000 });

    expect(vi.mocked(schedulePdf.buildSchedulePdf).mock.calls[1][0].options.logoLeft).toBeDefined();
    expect(store.loads).toBe(2);
  });
});

describe('@DR-024 kaputte gespeicherte Datei oder unlesbarer Speicher: Hinweis, das PDF entsteht trotzdem', () => {
  it('kaputte linke Datei: Hinweis vor dem Speichern, nach „Trotzdem speichern“ ist das PDF da', async () => {
    store.graphics = { left: KAPUTT, accent: BLAU };
    renderDialog();

    fireEvent.click(screen.getByTestId('pdf-save'));
    await waitFor(() => expect(screen.getByTestId('pdf-hint-step')).toBeInTheDocument(), { timeout: 20000 });

    expect(screen.getAllByTestId('pdf-hint-logo')).toHaveLength(1);
    expect(screen.getByTestId('pdf-hint-logo')).toHaveTextContent(deTournament.pdfExport.hints.logoLeft);
    expect(lastCapture()).toBeUndefined();
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));
    expect(screen.getByTestId('pdf-done')).toBeInTheDocument();
    expect(lastCapture()).toBeDefined();
  });

  it('der Speicher ließ sich nicht lesen: Hinweis für beide Seiten, das PDF entsteht ohne Grafik', async () => {
    store.failure = new Error('IndexedDB UnknownError');
    renderDialog();

    fireEvent.click(screen.getByTestId('pdf-save'));
    await waitFor(() => expect(screen.getByTestId('pdf-hint-step')).toBeInTheDocument(), { timeout: 20000 });

    expect(screen.getAllByTestId('pdf-hint-logo')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('pdf-save-anyway'));
    expect(screen.getByTestId('pdf-done')).toBeInTheDocument();
    expect(vi.mocked(schedulePdf.buildSchedulePdf).mock.calls[0][0].options.logoLeft).toBeUndefined();
  });
});
