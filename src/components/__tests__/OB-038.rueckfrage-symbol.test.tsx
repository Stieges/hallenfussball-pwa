/**
 * @OB-038 Beispielzeile „den Kopf einer Rückfrage (Hinweis, Warnung, Gefahr)“ → ein gezeichnetes Symbol in der Farbe der Stufe; „Gefahr“ ohne Sirene.
 * Das Symbol ist ein gezeichnetes Element (svg), im Dialog steht kein Emoji und kein Textzeichen als Symbolersatz; der Titel trägt die Aussage.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmDialog, type ConfirmDialogVariant } from '../ui/ConfirmDialog';
import { OHNE_SYMBOLERSATZ, OHNE_EMOJI } from '../../test/symbolText';

const noop = vi.fn();

describe('@OB-038 Kopf einer Rückfrage (Hinweis, Warnung, Gefahr)', () => {
  it.each([
    ['info', 'Hinweis'],
    ['warning', 'Warnung'],
    ['danger', 'Gefahr'],
  ] as const)('%s: ein gezeichnetes Symbol, kein Emoji im Dialog, der Titel trägt die Aussage', (variant: ConfirmDialogVariant, titel) => {
    render(<ConfirmDialog title={titel} message="Wirklich?" variant={variant} onConfirm={noop} onCancel={noop} />);
    const kopf = screen.getByTestId('confirm-dialog-icon');
    expect(kopf.querySelector('svg')).not.toBeNull();
    expect(kopf).toHaveAttribute('aria-hidden', 'true');
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(OHNE_EMOJI);
    expect(dialog.textContent).not.toMatch(OHNE_SYMBOLERSATZ);
    expect(screen.getByRole('heading', { name: titel })).toBeInTheDocument();
  });

  it('das Symbol trägt die Farbe der Stufe: Hinweis Primärfarbe, Warnung Warnfarbe, Gefahr Fehlerfarbe', () => {
    const farbe = (variant: ConfirmDialogVariant): string => {
      const { unmount } = render(<ConfirmDialog title="T" message="M" variant={variant} onConfirm={noop} onCancel={noop} />);
      const wert = screen.getByTestId('confirm-dialog-icon').style.color;
      unmount();
      return wert;
    };
    expect(farbe('info')).toBe('var(--color-primary)');
    expect(farbe('warning')).toBe('var(--color-warning)');
    expect(farbe('danger')).toBe('var(--color-error)');
  });

  it('Gegenbeispiel: „Gefahr“ ist dasselbe Warnsymbol wie „Warnung“ (keine Sirene), „Hinweis“ ein anderes', () => {
    const form = (variant: ConfirmDialogVariant): string => {
      const { unmount } = render(<ConfirmDialog title="T" message="M" variant={variant} onConfirm={noop} onCancel={noop} />);
      const d = screen.getByTestId('confirm-dialog-icon').querySelector('svg')!.innerHTML;
      unmount();
      return d;
    };
    expect(form('danger')).toBe(form('warning'));
    expect(form('info')).not.toBe(form('warning'));
  });
});

