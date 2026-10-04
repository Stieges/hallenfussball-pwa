import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { StrictMode, useState } from 'react';
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

function SwapHost() {
  const [phase, setPhase] = useState<'a' | 'b'>('a');
  return (
    <div>
      {phase === 'a' ? (
        <Trap key="trap-a" testId="trap-a" withEscape onClose={() => setPhase('b')} />
      ) : (
        <Trap key="trap-b" testId="trap-b" withEscape onClose={() => setPhase('a')} />
      )}
    </div>
  );
}

describe('useFocusTrap History (B-03 Fixrunde 2)', () => {
  let backSpy: MockInstance;
  let pushSpy: MockInstance;
  let replaceSpy: MockInstance;

  beforeEach(() => {
    window.history.replaceState(BASE_MARKER, '');
    backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    pushSpy = vi.spyOn(window.history, 'pushState');
    replaceSpy = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(async () => {
    cleanup();
    await flushHistory();
    vi.restoreAllMocks();
  });

  it('1: Dialogwechsel im selben Render – kein back, replaceState statt pushState, B bleibt offen', async () => {
    render(<SwapHost />);
    expect(screen.getByTestId('trap-a')).toBeTruthy();
    expect(pushSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('trap-a-close'));
    await flushHistory();

    expect(screen.queryByTestId('trap-a')).toBeNull();
    expect(screen.getByTestId('trap-b')).toBeTruthy();
    expect(backSpy).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const ersatz = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1][0] as { dialogId?: string };
    expect(ersatz.dialogId).toBeTypeOf('string');
    expect(topDialogId()).toBe(ersatz.dialogId);
  });

  it('2: StrictMode-Doppel-Mount – kein back und genau ein History-Eintrag', async () => {
    render(
      <StrictMode>
        <DialogHost testId="trap-strict" />
      </StrictMode>
    );
    await flushHistory();

    expect(screen.getByTestId('trap-strict')).toBeTruthy();
    expect(backSpy).not.toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('3: normales Schliessen ohne Folge-Dialog – genau ein back, erst nach dem Flush', async () => {
    render(<DialogHost testId="trap-zu" />);
    fireEvent.click(screen.getByTestId('trap-zu-close'));

    expect(backSpy).not.toHaveBeenCalled();

    await flushHistory();

    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('4: Esc bei zwei verschachtelten Dialogen schliesst nur den oberen', async () => {
    render(<NestedHost />);
    fireEvent.click(screen.getByTestId('trap-innen-oeffnen'));
    expect(screen.getByTestId('trap-innen')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await flushHistory();

    expect(screen.queryByTestId('trap-innen')).toBeNull();
    expect(screen.getByTestId('trap-aussen')).toBeTruthy();
  });
});
