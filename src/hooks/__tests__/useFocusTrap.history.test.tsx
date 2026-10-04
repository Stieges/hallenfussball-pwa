import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

const BASE_MARKER = { marker: 'base' };

function topDialogId(): string | undefined {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('dialogId' in state)) {
    return undefined;
  }
  const value = (state as { dialogId?: unknown }).dialogId;
  return typeof value === 'string' ? value : undefined;
}

type TrapProps = {
  testId: string;
  withEscape: boolean;
  onClose: () => void;
};

function Trap({ testId, withEscape, onClose }: TrapProps) {
  const { containerRef } = useFocusTrap({
    isActive: true,
    onEscape: withEscape ? onClose : undefined,
  });
  return (
    <div ref={containerRef} data-testid={testId}>
      <button type="button" data-testid={`${testId}-close`} onClick={onClose}>
        Schliessen
      </button>
    </div>
  );
}

function DialogHost({ testId, withEscape = true }: { testId: string; withEscape?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return null;
  }
  return <Trap testId={testId} withEscape={withEscape} onClose={() => setOpen(false)} />;
}

function NestedHost() {
  const [innerOpen, setInnerOpen] = useState(false);
  return (
    <div>
      <DialogHost testId="trap-aussen" />
      <button type="button" data-testid="trap-innen-oeffnen" onClick={() => setInnerOpen(true)}>
        Oeffnen
      </button>
      {innerOpen ? <DialogHost testId="trap-innen" /> : null}
    </div>
  );
}

async function flushHistory(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe('useFocusTrap History-Mechanik (B-03 Fixliste 5)', () => {
  beforeEach(() => {
    window.history.replaceState(BASE_MARKER, '');
  });

  afterEach(async () => {
    cleanup();
    await flushHistory();
  });

  it('ohne onEscape entsteht kein History-Eintrag (F-05)', () => {
    const laengeVorher = window.history.length;
    render(<DialogHost testId="trap-ohne-esc" withEscape={false} />);

    expect(screen.getByTestId('trap-ohne-esc')).toBeTruthy();
    expect(topDialogId()).toBeUndefined();
    expect(window.history.length).toBe(laengeVorher);
    expect(window.history.state).toEqual(BASE_MARKER);
  });

  it('Schliessen-Knopf stellt den History-Stand wieder her (F-14)', async () => {
    const laengeVorher = window.history.length;
    render(<DialogHost testId="trap-knopf" />);
    expect(topDialogId()).toBeTypeOf('string');
    expect(window.history.length).toBe(laengeVorher + 1);

    fireEvent.click(screen.getByTestId('trap-knopf-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('trap-knopf')).toBeNull();
      expect(topDialogId()).toBeUndefined();
      expect(window.history.state).toEqual(BASE_MARKER);
    });
  });

  it('Esc stellt den History-Stand wieder her (F-14)', async () => {
    render(<DialogHost testId="trap-esc" />);
    expect(topDialogId()).toBeTypeOf('string');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('trap-esc')).toBeNull();
      expect(topDialogId()).toBeUndefined();
      expect(window.history.state).toEqual(BASE_MARKER);
    });
  });

  it('verschachtelt: eine Zurrueck-Taste schliesst nur den oberen Dialog (F-07)', async () => {
    render(<NestedHost />);
    const aussenId = topDialogId();
    expect(aussenId).toBeTypeOf('string');

    fireEvent.click(screen.getByTestId('trap-innen-oeffnen'));
    const innenId = topDialogId();
    expect(innenId).toBeTypeOf('string');
    expect(innenId).not.toEqual(aussenId);

    await act(async () => {
      window.history.back();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('trap-innen')).toBeNull();
      expect(screen.getByTestId('trap-aussen')).toBeTruthy();
      expect(topDialogId()).toEqual(aussenId);
    });
  });

  it('verschachtelt: der innere Schliessen-Knopf laesst den aeusseren Dialog offen (F-07)', async () => {
    render(<NestedHost />);
    const aussenId = topDialogId();
    expect(aussenId).toBeTypeOf('string');

    fireEvent.click(screen.getByTestId('trap-innen-oeffnen'));
    expect(topDialogId()).not.toEqual(aussenId);

    fireEvent.click(screen.getByTestId('trap-innen-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('trap-innen')).toBeNull();
      expect(screen.getByTestId('trap-aussen')).toBeTruthy();
      expect(topDialogId()).toEqual(aussenId);
    });
  });
});
