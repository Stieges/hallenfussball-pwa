/**
 * B-43b1 — useFocusTrap hält den Hintergrund per Referenzzählung inert:
 * Schließt ein innerer Portal-Dialog, bleibt der Hintergrund gesperrt, solange
 * der äußere Dialog offen ist (@OB-055: verschachtelte Dialoge).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

function PortalDialog({ id, children }: { id: string; children?: React.ReactNode }) {
  const { containerRef } = useFocusTrap({ isActive: true });
  return createPortal(
    <div ref={containerRef} data-testid={id}>
      <button type="button">{id}-knopf</button>
      {children}
    </div>,
    document.body,
  );
}

function Verschachtelt() {
  const [innenOffen, setInnenOffen] = useState(false);
  return (
    <div id="app-root" data-testid="app-root">
      <button type="button" onClick={() => setInnenOffen(true)}>
        Hintergrund
      </button>
      <PortalDialog id="aussen">
        <button type="button" onClick={() => setInnenOffen((v) => !v)}>
          innen-umschalten
        </button>
      </PortalDialog>
      {innenOffen && <PortalDialog id="innen" />}
    </div>
  );
}

/** Inert sitzt auf dem Body-Kind, das das Element enthält. */
const isInert = (el: Element): boolean => el.closest('[inert]') !== null;

describe('B-43b1 useFocusTrap – inert per Referenzzählung', () => {
  afterEach(() => cleanup());

  it('@OB-055 Hintergrund bleibt gesperrt, wenn der innere Dialog schließt und der äußere offen bleibt', () => {
    render(<Verschachtelt />);
    const root = screen.getByTestId('app-root');
    expect(isInert(root)).toBe(true);

    fireEvent.click(screen.getByText('innen-umschalten')); // innen öffnen
    expect(screen.getByTestId('innen')).toBeInTheDocument();
    expect(isInert(root)).toBe(true);

    fireEvent.click(screen.getByText('innen-umschalten')); // innen schließen
    expect(screen.queryByTestId('innen')).toBeNull();
    // Der äußere Dialog ist noch offen -> Hintergrund bleibt inert.
    expect(isInert(root)).toBe(true);
  });

  it('@OB-055 der äußere Dialog ist nur gesperrt, solange der innere offen ist', () => {
    render(<Verschachtelt />);
    expect(isInert(screen.getByTestId('aussen'))).toBe(false);

    fireEvent.click(screen.getByText('innen-umschalten')); // innen öffnen
    expect(isInert(screen.getByTestId('aussen'))).toBe(true);

    fireEvent.click(screen.getByText('innen-umschalten')); // innen schließen
    expect(isInert(screen.getByTestId('aussen'))).toBe(false);
  });

  it('Gegenbeispiel: nach dem Schließen aller Dialoge ist der Hintergrund wieder frei', () => {
    const { unmount } = render(<Verschachtelt />);
    const root = screen.getByTestId('app-root');
    expect(isInert(root)).toBe(true);
    unmount();
    expect(document.getElementById('app-root')).toBeNull();
    expect(document.querySelectorAll('[inert]').length).toBe(0);
  });
});
