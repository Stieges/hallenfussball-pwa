/**
 * w1 — Feld „Regelwerk“ im Wizard, Schritt 3.
 *
 * @DR-016 Höchstens 80 Zeichen; das Feld sagt es. Leer → kein Feld gespeichert.
 * @DR-006 Der Kopf zeigt das eingetragene Regelwerk (Datenquelle: Turnierkonfiguration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { Step3_Metadata } from '../Step3_Metadata';

// LocationForm/ContactForm brauchen einen RepositoryProvider; sie sind hier nicht Gegenstand.
vi.mock('../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../components/ContactForm', () => ({ ContactForm: () => null }));

function renderStep3(formData: Partial<Tournament>) {
  const onUpdate = vi.fn();
  render(<Step3_Metadata formData={formData} onUpdate={onUpdate} />);
  return { onUpdate, input: screen.getByTestId('wizard-rulebook') };
}

beforeEach(() => vi.clearAllMocks());

describe('Wizard Schritt 3 — Regelwerk', () => {
  it('@DR-006 die Eingabe wird als rulebook übernommen', () => {
    const { onUpdate, input } = renderStep3({ title: 'Hallencup Nord' });

    fireEvent.change(input, { target: { value: 'BFV-Richtlinien für Futsal und private Hallenturniere' } });

    expect(onUpdate).toHaveBeenLastCalledWith('rulebook', 'BFV-Richtlinien für Futsal und private Hallenturniere');
  });

  it('@DR-016 das Feld hat maxLength 80 und den Hinweis „höchstens 80 Zeichen“', () => {
    const { input } = renderStep3({});

    expect(input).toHaveAttribute('maxlength', '80');
    expect(screen.getByText('wizard:step3.rulebookLimit')).toBeInTheDocument();
  });

  it('@DR-016 81 Zeichen: nur 80 werden übernommen, der Kürzungs-Hinweis ist sichtbar', () => {
    const { onUpdate, input } = renderStep3({});

    fireEvent.change(input, { target: { value: 'a'.repeat(81) } });

    expect(onUpdate).toHaveBeenLastCalledWith('rulebook', 'a'.repeat(80));
    expect(screen.getByRole('status')).toHaveTextContent('wizard:step3.rulebookTruncated');
  });

  it('Gegenbeispiel: leeres Feld speichert undefined, nicht ""', () => {
    const { onUpdate, input } = renderStep3({ rulebook: 'alt' });

    fireEvent.change(input, { target: { value: '' } });

    expect(onUpdate).toHaveBeenLastCalledWith('rulebook', undefined);
  });
});
