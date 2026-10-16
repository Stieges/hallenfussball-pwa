/**
 * w1 — Feld „Regelwerk“ im Wizard, Schritt 3.
 *
 * @DR-016 Höchstens 80 Zeichen; das Feld sagt es. Leer → kein Feld gespeichert.
 * @DR-006 Der Kopf zeigt das eingetragene Regelwerk (Datenquelle: Turnierkonfiguration).
 *
 * Die Kürzungs-Tests fügen über userEvent.paste ein (wie der Browser) und halten den Wert
 * im Zustand (Harness), damit das kontrollierte Feld den gekürzten Wert wirklich anzeigt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function StatefulStep3() {
  const [form, setForm] = useState<Partial<Tournament>>({});
  return (
    <Step3_Metadata
      formData={form}
      onUpdate={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Wizard Schritt 3 — Regelwerk', () => {
  it('@DR-006 die Eingabe wird als rulebook übernommen', () => {
    const { onUpdate, input } = renderStep3({ title: 'Hallencup Nord' });

    fireEvent.change(input, { target: { value: 'BFV-Richtlinien für Futsal und private Hallenturniere' } });

    expect(onUpdate).toHaveBeenLastCalledWith('rulebook', 'BFV-Richtlinien für Futsal und private Hallenturniere');
  });

  it('@DR-016 der Hinweis „Höchstens 80 Zeichen.“ hängt am Feld (aria-describedby)', () => {
    renderStep3({});

    expect(screen.getByText('wizard:step3.rulebookLimit')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-rulebook')).toHaveAccessibleDescription(/wizard:step3\.rulebookLimit/);
  });

  it('@DR-016 Einfügen von 81 Zeichen: Feld zeigt 80 Zeichen, Kürzungshinweis sichtbar', async () => {
    const user = userEvent.setup();
    render(<StatefulStep3 />);
    const input = screen.getByTestId('wizard-rulebook');

    await user.click(input);
    await user.paste('a'.repeat(81));

    expect(input).toHaveValue('a'.repeat(80));
    expect(screen.getByRole('status')).toHaveTextContent('wizard:step3.rulebookTruncated');
  });

  it('@DR-016 Gegenbeispiel: Einfügen von genau 80 Zeichen zeigt keinen Kürzungshinweis', async () => {
    const user = userEvent.setup();
    render(<StatefulStep3 />);
    const input = screen.getByTestId('wizard-rulebook');

    await user.click(input);
    await user.paste('a'.repeat(80));

    expect(input).toHaveValue('a'.repeat(80));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('Gegenbeispiel: leeres Feld speichert undefined, nicht ""', () => {
    const { onUpdate, input } = renderStep3({ rulebook: 'alt' });

    fireEvent.change(input, { target: { value: '' } });

    expect(onUpdate).toHaveBeenLastCalledWith('rulebook', undefined);
  });
});
