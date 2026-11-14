/**
 * @OB-085 Dialog „Spielplan teilen“: kurze Adresse ohne „#/“ für Link, QR-Code und Kopieren; Taste im Fuß.
 * Die echte Größen-Messung (360×640, 390×664, 390×844) macht tests/e2e/teilen-dialog-handy-ob085.spec.ts.
 * Die Übersetzung liefert in Vitest „namespace:schlüssel“ (siehe src/test/setup.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

const qrAufrufe: string[] = [];
vi.mock('../../../utils/qrCodeGenerator', () => ({
  generateQRCode: vi.fn((url: string) => {
    qrAufrufe.push(url);
    return Promise.resolve('data:image/png;base64,AAAA');
  }),
}));

import { ShareDialog } from '../ShareDialog';

const mount = (props: Partial<React.ComponentProps<typeof ShareDialog>> = {}) =>
  render(
    <ShareDialog isOpen onClose={vi.fn()} tournamentId="t-1" tournamentTitle="Nikolaus-Turnier" shareCode="NIKO26" isPublic {...props} />,
  );

describe('@OB-085 öffentlicher Zustand', () => {
  const kurz = `${window.location.origin}/live/NIKO26`;
  let schreiben: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    qrAufrufe.length = 0;
    schreiben = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: schreiben }, configurable: true });
  });

  it('der Link steht als kurze Adresse /live/CODE ohne „#/“ als lesbarer Text', () => {
    mount();
    const link = screen.getByTestId('share-dialog-link');
    expect(link.textContent).toBe(kurz);
    expect(link.textContent).not.toContain('#/');
    expect(link.textContent).not.toContain('…');
  });

  it('der QR-Code trägt dieselbe kurze Adresse wie der Link', async () => {
    mount();
    await waitFor(() => expect(qrAufrufe.length).toBeGreaterThan(0));
    expect(qrAufrufe.at(-1)).toBe(kurz);
  });

  it('„Link kopieren“ kopiert genau diese Adresse und meldet „kopiert“', async () => {
    mount();
    fireEvent.click(screen.getByTestId('share-dialog-copy'));
    await waitFor(() => expect(schreiben).toHaveBeenCalledWith(kurz));
    expect((await screen.findByTestId('share-dialog-feedback')).textContent).toBe('dashboard:share.copySuccess');
  });

  it('der Code und die Taste „Link kopieren“ stehen da; die Taste steht im Fuß, nicht im scrollenden Inhalt', () => {
    mount();
    expect(screen.getByTestId('share-dialog-code').textContent).toContain('NIKO26');
    const fuss = screen.getByTestId('dialog-surface-footer');
    expect(within(fuss).getByTestId('share-dialog-copy')).toBeTruthy();
    expect(within(screen.getByTestId('dialog-surface-body')).queryByTestId('share-dialog-copy')).toBeNull();
  });

  it('Fehlerfall: scheitert das Kopieren, erscheint die Fehlermeldung statt „kopiert“', async () => {
    schreiben.mockRejectedValue(new Error('verweigert'));
    // der Rückfall über execCommand scheitert in jsdom ebenfalls
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    mount();
    fireEvent.click(screen.getByTestId('share-dialog-copy'));
    expect((await screen.findByTestId('share-dialog-feedback')).textContent).toBe('dashboard:share.copyError');
  });
});

describe('@OB-085 Gegenbeispiele', () => {
  beforeEach(() => { qrAufrufe.length = 0; });

  it('nicht öffentlich: Hinweis statt Code, interne Adresse bleibt (mit „#/“), QR trägt dieselbe Adresse', async () => {
    mount({ isPublic: false, shareCode: null });
    expect(screen.queryByTestId('share-dialog-code')).toBeNull();
    expect(screen.getByTestId('share-dialog-not-public')).toBeTruthy();
    const intern = `${window.location.origin}/#/tournament/t-1`;
    expect(screen.getByTestId('share-dialog-link').textContent).toBe(intern);
    await waitFor(() => expect(qrAufrufe.at(-1)).toBe(intern));
  });

  it('öffentlich markiert, aber ohne Code: kein Code und keine kurze Adresse', () => {
    mount({ shareCode: null });
    expect(screen.queryByTestId('share-dialog-code')).toBeNull();
    expect(screen.getByTestId('share-dialog-link').textContent).not.toContain('/live/');
  });

  it('eine übergebene Basisadresse ersetzt die erzeugte, wie bisher', () => {
    mount({ baseUrl: 'https://example.org/x' });
    expect(screen.getByTestId('share-dialog-link').textContent).toBe('https://example.org/x');
  });
});
