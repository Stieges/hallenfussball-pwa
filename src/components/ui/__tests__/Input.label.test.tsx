/** Input: Label und Feld sind verknüpft (axe „label“; Fix aus Paket KP, Review #280 B5). */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../Input';

describe('Input Label-Verknüpfung', () => {
  it('getByLabelText findet das Eingabefeld', () => {
    render(<Input label="Name der Kopie" value="x" onChange={() => undefined} data-testid="feld" />);
    expect(screen.getByLabelText('Name der Kopie')).toBe(screen.getByTestId('feld'));
  });

  it('mehrere Felder mit gleichem Label bekommen eigene IDs', () => {
    render(<><Input label="Name" value="a" data-testid="a" /><Input label="Name" value="b" data-testid="b" /></>);
    const [a, b] = screen.getAllByLabelText('Name');
    expect(a.id).not.toBe(b.id);
  });

  it('Gegenbeispiel: ohne Label bleibt das Feld ohne Label-Verknüpfung', () => {
    render(<Input value="x" data-testid="feld" />);
    expect(screen.queryByLabelText('x')).toBeNull();
  });
});
