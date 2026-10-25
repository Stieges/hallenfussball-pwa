/**
 * R3-3 Review #394 m-3: die Hinweisseite zum Wizard eines abgeschlossenen Turniers ist eine eigene Seite -- Überschrift, Fokus
 * darauf, genau eine Live-Region, die Zurück-Taste ist die Haupttaste (@LZ-036).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ClosedTournamentEditNotice } from '../ClosedTournamentEditNotice';

describe('ClosedTournamentEditNotice', () => {
  it('Überschrift hat den Fokus, eine Live-Region, eine Haupttaste', () => {
    const onBack = vi.fn();
    render(<ClosedTournamentEditNotice onBack={onBack} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(within(screen.getByTestId('wizard-closed-notice')).getAllByRole('status')).toHaveLength(1);
    expect(document.querySelectorAll('[data-primary]')).toHaveLength(1);
    screen.getByTestId('wizard-closed-back').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
