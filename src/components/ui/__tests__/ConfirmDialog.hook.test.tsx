/**
 * Abdeckung (Fixrunde 1 Teil b) — useConfirmDialog (Rückwärtskompatibilitäts-Hook
 * in ui/ConfirmDialog.tsx): confirm() liefert true/false, close() schließt ohne
 * Auflösung. Die Dialog-Varianten selbst deckt
 * components/ui/__tests__/ConfirmDialog.nonDangerFocus.test.tsx ab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, useConfirmDialog } from '../ConfirmDialog';

function Harness() {
  const { isOpen, dialogProps, confirm, close } = useConfirmDialog({
    title: 'Frage',
    message: 'Text',
  });
  const [result, setResult] = useState('offen');
  return (
    <div>
      <button
        data-testid="ask"
        onClick={() => {
          void confirm().then((value) => setResult(value ? 'ja' : 'nein'));
        }}
      >
        fragen
      </button>
      <button data-testid="close" onClick={close}>
        zu
      </button>
      <span data-testid="result">{result}</span>
      {isOpen && <ConfirmDialog {...dialogProps} />}
    </div>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('useConfirmDialog (Abdeckung)', () => {
  it('Bestätigen löst true aus', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('ask'));
    await user.click(screen.getByTestId('confirm-dialog-confirm'));

    expect(screen.getByTestId('result')).toHaveTextContent('ja');
  });

  it('Abbrechen löst false aus, close() schließt ohne Ergebnis', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('ask'));
    await user.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(screen.getByTestId('result')).toHaveTextContent('nein');

    await user.click(screen.getByTestId('ask'));
    await user.click(screen.getByTestId('close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('result')).toHaveTextContent('nein');
  });
});
