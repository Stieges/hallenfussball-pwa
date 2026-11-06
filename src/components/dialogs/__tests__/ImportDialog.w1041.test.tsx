/**
 * @W1-041 Der Import meldet Erfolg erst, wenn das Turnier gespeichert ist (docs/anforderungen/2026-09-27_wizard-einstieg-und-fuehrung.md).
 * Gegeben Olli hat „f2.json“ gewählt und sieht die Vorschau. Wenn er „Importieren“ tippt, ist das Turnier gespeichert,
 * bevor „Import erfolgreich“ erscheint; schließt er die Meldung mit X oder Esc, steht es auf der Startseite.
 * Die Meldung sagt bei einer Datei ohne Spielplan „Spielplan noch erstellen“, bei einer mit Spielplan „Bereit“.
 * Befund C-IMPORT-ERFOLG-VOR-SPEICHERN. Texte kommen als Schlüssel (Test-i18n); die Wortlaute prüft zustandswoerter.lz001.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const hoisted = vi.hoisted(() => ({ parsed: { tournament: undefined as object | undefined, isValid: true, errors: [] as unknown[], warnings: [] as unknown[] } }));
vi.mock('../../../utils/tournamentImporter', () => ({
  detectImportFormat: () => 'json',
  validateAndParseTournamentImport: () => hoisted.parsed,
}));

import { ImportDialog } from '../ImportDialog';

const turnier = (matches: unknown[]) =>
  ({ id: 'f2', title: 'F2-Junioren Hallenturnier', matches, teams: [], externalSource: 'Datei', location: { name: 'Halle' }, ageClass: 'F2' });

async function bisVorschau(user: ReturnType<typeof userEvent.setup>) {
  const datei = new File(['{}'], 'f2.json', { type: 'application/json' });
  await user.upload(screen.getByTestId('import-file-input'), datei);
  await screen.findByTestId('import-confirm');
}

function zeige(onImport = vi.fn(() => Promise.resolve())) {
  const onClose = vi.fn();
  const onContinue = vi.fn();
  render(<ImportDialog isOpen onClose={onClose} onImport={onImport} onContinue={onContinue} />);
  return { onImport, onClose, onContinue };
}

beforeEach(() => { hoisted.parsed = { tournament: turnier([]), isValid: true, errors: [], warnings: [] }; });

describe('@W1-041 Import speichert vor „Import erfolgreich“', () => {
  it('„Importieren“ speichert; „Import erfolgreich“ steht erst nach dem Speichern', async () => {
    const user = userEvent.setup();
    let fertig: () => void = () => undefined;
    const onImport = vi.fn(() => new Promise<void>((resolve) => { fertig = resolve; }));
    zeige(onImport);
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('import-success-go')).toBeNull();
    fertig();
    expect(await screen.findByTestId('import-success-go')).toBeTruthy();
  });

  it('Schließen mit dem Kreuz nach der Erfolgsmeldung verliert nichts: gespeichert ist schon, „Weiter“ wird nicht erzwungen', async () => {
    const user = userEvent.setup();
    const { onImport, onClose, onContinue } = zeige();
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    await screen.findByTestId('import-success-go');
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('Esc nach der Erfolgsmeldung schließt ohne zweites Speichern', async () => {
    const user = userEvent.setup();
    const { onImport, onClose } = zeige();
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    await screen.findByTestId('import-success-go');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('Datei ohne Spielplan: Text „Spielplan noch erstellen“, Taste führt zum Spielplan (onContinue)', async () => {
    const user = userEvent.setup();
    const { onContinue } = zeige();
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    await screen.findByTestId('import-success-go');
    expect(screen.getByTestId('import-success-hint')).toHaveTextContent('import.success.hintNoSchedule');
    await user.click(screen.getByTestId('import-success-go'));
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ id: 'f2' }));
  });

  it('Datei mit Spielplan: Text „Bereit“, die Taste schließt nur (kein Assistent)', async () => {
    hoisted.parsed = { tournament: turnier([{ id: 'm1' }]), isValid: true, errors: [], warnings: [] };
    const user = userEvent.setup();
    const { onContinue, onClose } = zeige();
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    await screen.findByTestId('import-success-go');
    expect(screen.getByTestId('import-success-hint')).toHaveTextContent('import.success.hintReady');
    await user.click(screen.getByTestId('import-success-go'));
    expect(onContinue).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Gegenbeispiel: scheitert das Speichern, gibt es keine Erfolgsmeldung, der Dialog bleibt in der Vorschau mit Fehler und Wiederholen', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn().mockRejectedValueOnce(new Error('Speicher voll')).mockResolvedValueOnce(undefined);
    zeige(onImport);
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-save-error')).toBeTruthy();
    expect(screen.queryByTestId('import-success-go')).toBeNull();
    await user.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(screen.getByTestId('import-success-go')).toBeTruthy());
    expect(onImport).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: ein zweites Tippen während des Speicherns speichert nicht doppelt', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(() => new Promise<void>(() => undefined));
    zeige(onImport);
    await bisVorschau(user);
    await user.click(screen.getByTestId('import-confirm'));
    await user.click(screen.getByTestId('import-confirm'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
