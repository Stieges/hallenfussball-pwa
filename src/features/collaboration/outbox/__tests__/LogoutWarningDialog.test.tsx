/**
 * Task C2b, Aufgabe 5: Abmelde-Warnung (D-C2).
 * Warnen und aufheben -- die Eintraege bleiben auf dem Geraet gespeichert.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogoutWarningDialog } from '../LogoutWarningDialog';

describe('LogoutWarningDialog (D-C2)', () => {
  it('zeigt den Warntext mit der Anzahl der wartenden Eintraege', () => {
    render(<LogoutWarningDialog isOpen count={3} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByTestId('logout-warning-dialog');
    expect(dialog).toHaveTextContent('common:outbox.logoutWarning.message');
    expect(dialog).toHaveTextContent('common:actions.cancel');
    expect(dialog).toHaveTextContent('common:outbox.logoutWarning.confirm');
  });

  it('Abbrechen ruft onCancel und bestaetigt nicht', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutWarningDialog isOpen count={1} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('logout-warning-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Trotzdem abmelden ruft onConfirm', () => {
    const onConfirm = vi.fn();
    render(<LogoutWarningDialog isOpen count={1} onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('logout-warning-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ohne isOpen rendert nichts', () => {
    render(<LogoutWarningDialog isOpen={false} count={1} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });
});
