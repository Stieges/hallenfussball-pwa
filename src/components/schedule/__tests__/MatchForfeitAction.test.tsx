/**
 * B-12 (@FU-119, @SL-118, @W2A-022, @W2A-026): die Taste an der Spielkarte erscheint nur bei einem geplanten Spiel
 * („Nicht angetreten“) und bei einer Wertung („Wertung zurücknehmen“), nur mit Bedienung der Turnierleitung.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MatchForfeitAction } from '../MatchForfeitAction';
import type { ViewMatchStatus } from '../../../core/view/types';

const actions = () => ({ mark: vi.fn(), revoke: vi.fn() });

describe('MatchForfeitAction', () => {
  it('@W2A-022 geplantes Spiel → „Nicht angetreten“ ruft mark mit der Spiel-ID', () => {
    const forfeit = actions();
    render(<MatchForfeitAction matchId="m1" viewStatus="scheduled" forfeit={forfeit} />);
    fireEvent.click(screen.getByTestId('forfeit-mark-m1'));
    expect(forfeit.mark).toHaveBeenCalledWith('m1');
    expect(forfeit.revoke).not.toHaveBeenCalled();
    expect(screen.queryByTestId('forfeit-revoke-m1')).toBeNull();
  });

  it('@W2A-026 gewertetes Spiel → „Wertung zurücknehmen“ ruft revoke', () => {
    const forfeit = actions();
    render(<MatchForfeitAction matchId="m1" viewStatus="awarded" forfeit={forfeit} />);
    fireEvent.click(screen.getByTestId('forfeit-revoke-m1'));
    expect(forfeit.revoke).toHaveBeenCalledWith('m1');
    expect(screen.queryByTestId('forfeit-mark-m1')).toBeNull();
  });

  it.each<ViewMatchStatus>(['running', 'paused', 'finished', 'cancelled'])('@FU-119 Gegenbeispiel: Status %s → keine Taste', (status) => {
    render(<MatchForfeitAction matchId="m1" viewStatus={status} forfeit={actions()} />);
    expect(screen.queryByTestId('forfeit-mark-m1')).toBeNull();
    expect(screen.queryByTestId('forfeit-revoke-m1')).toBeNull();
  });

  it('@SL-118 Gegenbeispiel: ohne Bedienung (Helfer, Zuschauer) → keine Taste, auch bei geplant und gewertet', () => {
    const { container, rerender } = render(<MatchForfeitAction matchId="m1" viewStatus="scheduled" forfeit={undefined} />);
    expect(container.innerHTML).toBe('');
    rerender(<MatchForfeitAction matchId="m1" viewStatus="awarded" forfeit={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
