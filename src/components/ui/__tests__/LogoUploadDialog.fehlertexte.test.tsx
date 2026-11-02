/**
 * Befund C-TEAMLOGO-FEHLERTEXT-ENGLISCH (T5): Der Dialog „Team-Logo hochladen“ zeigt bei einem Fehler keinen rohen
 * Text der Fehlermeldung („Failed to load image“, „Unsupported file type …“), sondern einen übersetzten Text nach Grund.
 * Gherkin @W3-030: „eine größere oder andere Datei nimmt die App nicht an und nennt den Grund“.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18nDe from 'i18next';
import { setI18n } from 'react-i18next';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { createRealI18n } from '../../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const processLogoMock = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/logoProcessor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/logoProcessor')>()),
  processLogo: processLogoMock,
}));

import { LogoUploadDialog } from '../LogoUploadDialog';
import { LogoError } from '../../../utils/logoProcessor';

const ROH = /Failed to|Unsupported|too large|Invalid file|Canvas conversion/i;

function zeige() {
  return render(<LogoUploadDialog teamName="TSV Waging" onSave={vi.fn()} onCancel={vi.fn()} />);
}
const waehle = (file: File): void => {
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [file] } });
};
/** Gültige Datei wählen, Rechte bestätigen, speichern: der Aufbereiter (gemockt) wirft `fehler`. */
async function speichereMitFehler(fehler: Error): Promise<void> {
  processLogoMock.mockRejectedValueOnce(fehler);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
  waehle(new File(['x'], 'wappen.png', { type: 'image/png' }));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Logo speichern' }));
}

afterEach(() => { vi.unstubAllGlobals(); processLogoMock.mockReset(); });

describe('Team-Logo-Dialog: Fehlertexte aus der Übersetzung', () => {
  it('andere Dateiart: Text nach Grund „Format“, kein englischer Rohtext', async () => {
    zeige();
    waehle(new File(['x'], 'notiz.txt', { type: 'text/plain' }));

    const meldung = await screen.findByText(/Dateiformat wird nicht unterstützt/);
    expect(meldung).toHaveTextContent('Erlaubt sind PNG, JPG, WebP, SVG und GIF.');
    expect(document.body.textContent).not.toMatch(ROH);
  });

  it('zu große Datei: Text nach Grund „Größe“ nennt die Grenze (5 MB)', async () => {
    zeige();
    waehle(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'gross.png', { type: 'image/png' }));

    expect(await screen.findByText('Die Datei ist größer als 5 MB.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ROH);
  });

  it('beim Speichern: ein LogoError „nicht lesbar“ zeigt den Text nach Grund, nicht err.message', async () => {
    zeige();
    await speichereMitFehler(new LogoError('unreadable', 'Failed to load image'));

    expect(await screen.findByText(/konnte nicht gelesen werden/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ROH);
  });

  it('beim Speichern: ein unbekannter Fehler zeigt den allgemeinen übersetzten Text, nie err.message (Gegenbeispiel)', async () => {
    zeige();
    await speichereMitFehler(new Error('Failed to get canvas 2D context'));

    expect(await screen.findByText(/Das Logo konnte nicht verarbeitet werden/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(ROH);
  });

  it('EN: dieselben Fälle auf Englisch', async () => {
    await createRealI18n('en');
    try {
      zeige();
      waehle(new File(['x'], 'notiz.txt', { type: 'text/plain' }));

      expect(await screen.findByText(/file format is not supported/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(ROH);
    } finally {
      setI18n(i18nDe);
    }
  });
});
