/**
 * RejectedOutboxDialog (C3a-2a Fixrunde 4, Minor 3): eigener Test -- bisher hatte die Komponente
 * keinen eigenen Test, ein hart kodierter Titel waere nicht aufgefallen (R9 aus dem Re-Review
 * blieb GRUEN). Prueft: Titel laeuft ueber i18n (`common:outbox.rejected.dialogTitle`), die
 * Ablehnungsliste wird gerendert, "Verstanden" ruft `onDismiss` mit der richtigen ID auf,
 * geschlossen (isOpen=false) rendert nichts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RejectedOutboxDialog } from '../RejectedOutboxDialog';
import type { EngineRejectedEntry } from '../../../match-engine/useEngineOutboxSummary';

const entries: EngineRejectedEntry[] = [
  {
    event: { id: 'e1', type: 'GOAL', actor: 'helper', at: 0, section: 1, clockMs: 0, payload: {} },
    code: 'MATCH_FULL',
    rejectedAt: 0,
    matchId: 'm1',
  },
];

describe('RejectedOutboxDialog (C3a-2a Fixrunde 4, Minor 3)', () => {
  it('zeigt den Titel ueber i18n (common:outbox.rejected.dialogTitle), nicht hart kodiert', () => {
    render(<RejectedOutboxDialog isOpen entries={entries} onClose={vi.fn()} onDismiss={vi.fn()} />);

    // i18n ist im Test global als Namespace:Schluessel-Passthrough gemockt (src/test/setup.ts) --
    // der Schluessel selbst ist hier das beobachtbare Signal.
    expect(screen.getByText('common:outbox.rejected.dialogTitle')).toBeInTheDocument();
  });

  it('rendert die Ablehnungsliste und ruft onDismiss mit der Event-ID auf', () => {
    const onDismiss = vi.fn();
    render(<RejectedOutboxDialog isOpen entries={entries} onClose={vi.fn()} onDismiss={onDismiss} />);

    expect(screen.getByTestId('outbox-rejected-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss'));
    expect(onDismiss).toHaveBeenCalledWith(['e1']);
  });

  it('rendert nichts, wenn isOpen false ist', () => {
    render(<RejectedOutboxDialog isOpen={false} entries={entries} onClose={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId('outbox-rejected-panel')).not.toBeInTheDocument();
  });
});
