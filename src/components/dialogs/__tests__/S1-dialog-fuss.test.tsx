/**
 * @OB-062 / @OB-063 an den Nutzern des Bausteins: `Dialog` (PDF-Dialog „Als PDF“ über den Fuß-Slot) und `ConfirmDialog`
 * (kurze Rückfrage). Struktur-Vertrag in jsdom; die echte Messung macht tests/e2e/dialog-fuss-fest.spec.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { DialogActions } from '../../ui/molecules';

describe('@OB-062 Dialog – Titel und Schließen im festen Kopf, Tasten im festen Fuß', () => {
  const mount = () =>
    render(
      <Dialog
        isOpen
        onClose={vi.fn()}
        title="Als PDF"
        footer={<DialogActions secondary={[{ label: 'Abbrechen', onClick: vi.fn() }]} primary={{ label: 'Als PDF speichern', onClick: vi.fn(), 'data-testid': 'pdf-save' }} />}
      >
        <p>Inhalt</p>
      </Dialog>,
    );

  it('Titel „Als PDF“ und Schließen-Kreuz stehen im Kopf, nicht im scrollenden Inhalt', () => {
    mount();
    const kopf = screen.getByTestId('dialog-surface-header');
    const inhalt = screen.getByTestId('dialog-surface-body');
    expect(within(kopf).getByRole('heading', { name: 'Als PDF' })).toBeTruthy();
    expect(within(kopf).getByRole('button', { name: 'Schließen' })).toBeTruthy();
    expect(within(inhalt).queryByRole('button', { name: 'Schließen' })).toBeNull();
  });

  it('die Taste „Als PDF speichern“ steht im Fuß, nicht im scrollenden Inhalt; Abbrechen davor, Haupttaste zuletzt', () => {
    mount();
    const fuss = screen.getByTestId('dialog-surface-footer');
    expect(within(fuss).getAllByRole('button').map((b) => b.textContent)).toEqual(['Abbrechen', 'Als PDF speichern']);
    expect(within(screen.getByTestId('dialog-surface-body')).queryByTestId('pdf-save')).toBeNull();
  });

  it('der Baustein für die Tasten setzt keinen eigenen Außenabstand mehr (der Fuß trägt ihn)', () => {
    mount();
    expect(screen.getByTestId('dialog-actions').style.marginTop).toBe('');
  });

  it('Gegenbeispiel: ohne footer gibt es keinen Fuß, der Kopf bleibt fest', () => {
    render(<Dialog isOpen onClose={vi.fn()} title="Teilen"><p>x</p></Dialog>);
    expect(screen.queryByTestId('dialog-surface-footer')).toBeNull();
    expect(screen.getByTestId('dialog-surface-header')).toBeTruthy();
  });
});

describe('@OB-063 ConfirmDialog – kurze Rückfrage: Satz im Inhalt, Tasten im Fuß, nichts gestreckt', () => {
  it('Satz im Inhalt, Tasten im Fuß; Fläche ohne feste Höhe', () => {
    render(<ConfirmDialog isOpen title="Papierkorb leeren?" message="Alle Turniere werden gelöscht." confirmText="Papierkorb leeren" cancelText="Abbrechen" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const panel = screen.getByRole('dialog');
    const inhalt = screen.getByTestId('dialog-surface-body');
    const fuss = screen.getByTestId('dialog-surface-footer');
    expect(within(inhalt).getByText('Alle Turniere werden gelöscht.')).toBeTruthy();
    expect(within(fuss).getByTestId('confirm-dialog-confirm')).toBeTruthy();
    expect(within(fuss).getByTestId('confirm-dialog-cancel')).toBeTruthy();
    expect(within(screen.getByTestId('dialog-surface-header')).getByRole('heading', { name: 'Papierkorb leeren?' })).toBeTruthy();
    expect(panel.style.height).toBe('');
    expect(panel.style.minHeight).toBe('');
  });
});
