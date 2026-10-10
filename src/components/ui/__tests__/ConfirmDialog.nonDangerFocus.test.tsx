/**
 * @OB-014 / W5 (Fixrunde 1 Teil b) — Fokus auf „Abbrechen" und Enter-Sperre
 * gelten NUR bei `variant === 'danger'`. Andere Varianten verhalten sich wie auf
 * main (`git show origin/main:src/components/ui/ConfirmDialog.tsx`): der
 * Bestätigen-Knopf bekommt den Fokus (50-ms-Verzögerung), Enter löst aus.
 *
 * Test:    warning/dialog (info) — Fokus auf „Bestätigen", Enter ruft onConfirm.
 * Gegenbeispiel: danger — Fokus auf „Abbrechen", Enter ändert nichts
 * (hier als Kontrast, die Szenario-Abdeckung @OB-014 steht in
 * components/dialogs/__tests__/dangerConfirmFocus.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, type ConfirmDialogVariant } from '../ConfirmDialog';

beforeEach(() => vi.clearAllMocks());

describe('ConfirmDialog — Fokus/Enter nur bei danger (@OB-014, W5)', () => {
  it.each(['warning', 'info'] as const)(
    'Nicht-danger (%s) wie auf main: Fokus auf „Bestätigen“, Enter bestätigt',
    async (variant: ConfirmDialogVariant) => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          title="Änderungen speichern?"
          message="Frage"
          variant={variant}
          confirmText="Bestätigen"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const dialog = screen.getByRole('dialog');
      const confirm = within(dialog).getByRole('button', { name: 'Bestätigen' });
      const cancel = within(dialog).getByRole('button', { name: 'common:actions.cancel' });

      // main: Fokus nach 50 ms auf dem Bestätigen-Knopf.
      await new Promise((resolve) => {
        setTimeout(resolve, 80);
      });
      expect(document.activeElement).toBe(confirm);
      expect(document.activeElement).not.toBe(cancel);

      await user.keyboard('{Enter}');
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    }
  );

  it('Gegenbeispiel danger: Fokus auf „Abbrechen“, Enter ändert nichts', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Turnier löschen"
        message="Unwiederbringlich"
        variant="danger"
        confirmText="Bestätigen"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'common:actions.cancel' });

    await waitFor(() => expect(document.activeElement).toBe(cancel));

    await user.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
