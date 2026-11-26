/**
 * @ZM-207 Ein Namenswechsel (Umbenennen, @OB-091) ersetzt den Text im Baustein vollständig: kein alter Textknoten bleibt stehen.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SlashBreaks, TeamName } from '../TeamName';

describe('Teamname-Baustein beim Namenswechsel', () => {
  it('@ZM-207 TeamName zeigt nach dem Wechsel nur den neuen Namen', () => {
    const { container, rerender } = render(<TeamName name="SG Taching/Tengling" />);
    rerender(<TeamName name="SG Tengling/Taching" />);
    expect(container.textContent).toBe('SG Tengling/Taching');
  });

  it('@ZM-207 SlashBreaks zeigt nach dem Wechsel nur den neuen Namen', () => {
    const { container, rerender } = render(<SlashBreaks text="SG Taching/Tengling" />);
    rerender(<SlashBreaks text="SG Tengling/Taching" />);
    expect(container.textContent).toBe('SG Tengling/Taching');
  });

  it('@ZM-207 SlashBreaks mit Wechsel von Namen ohne und mit Schrägstrich', () => {
    const { container, rerender } = render(<SlashBreaks text="FC Nord" />);
    rerender(<SlashBreaks text="SG Taching/Tengling" />);
    expect(container.textContent).toBe('SG Taching/Tengling');
  });
});
