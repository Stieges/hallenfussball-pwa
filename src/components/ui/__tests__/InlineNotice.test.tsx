/**
 * B-28 C8-F (VISUAL-DESIGN § 7): jeder Ton trägt ein Symbol, Farbe allein bedeutet nichts. Fehler ist ein Alarm.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineNotice } from '../molecules';

describe('InlineNotice', () => {
  it.each(['warn', 'info', 'error', 'ok'] as const)('Ton %s: Symbol vorhanden, für Vorleser versteckt, Text daneben', tone => {
    render(<InlineNotice tone={tone} data-testid="n">Text</InlineNotice>);
    const notice = screen.getByTestId('n');
    const symbol = notice.querySelector('[aria-hidden="true"] svg');

    expect(symbol, 'Symbol').not.toBeNull();
    expect(notice).toHaveTextContent('Text');
    expect(notice).toHaveAttribute('role', tone === 'error' ? 'alert' : 'status');
  });

  it('Vorgabe ist die Warnung; ein eigenes Symbol ersetzt das des Tons', () => {
    render(<InlineNotice data-testid="n" icon={<svg data-testid="eigen" />}>Text</InlineNotice>);

    expect(screen.getByTestId('n')).toHaveAttribute('data-tone', 'warn');
    expect(screen.getByTestId('eigen')).toBeInTheDocument();
  });

  it('Gegenbeispiel: Info und Warnung tragen verschiedene Symbole', () => {
    const a = render(<InlineNotice tone="info" data-testid="a">x</InlineNotice>);
    const info = a.container.querySelector('svg')?.innerHTML;
    a.unmount();
    const b = render(<InlineNotice tone="warn" data-testid="b">x</InlineNotice>);

    expect(b.container.querySelector('svg')?.innerHTML).not.toBe(info);
  });
});
