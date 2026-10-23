/**
 * B-04c Fixrunde 3 – Zusatz: Schriftgröße des Auswahlfelds für Rundenregeln.
 *
 * Pflichttest: Das Auswahlfeld „Entscheidung bei Unentschieden“ je Runde hat eine
 * Schriftgröße von mindestens 16 px (Token cssVars.fontSizes.lg = 1rem @ 16px base).
 * Gegenbeispiel: Kein px-Literal; der Wert kommt aus dem Design-Token.
 * Mutation: fontSize zurück auf cssVars.fontSizes.sm (12 px) → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { cssVars } from '../../../design-tokens';

describe('B-04c Fixrunde 3 – Schriftgröße Rundenregel-Auswahl (Eingabe ≥ 16 px)', () => {
  it('Pflichttest: Auswahlfeld der Finalrunde nutzt das 16-px-Token', () => {
    render(
      <FinalsConfiguration
        formData={{ numberOfGroups: 2, numberOfFields: 1, finalsConfig: { preset: 'top-4' } }}
        onUpdate={vi.fn()}
      />,
    );

    const auswahl = screen.getByTestId('tiebreaker-round-final');
    expect(auswahl.style.fontSize).toBe(cssVars.fontSizes.lg);
  });

  it('Gegenbeispiel: die Schriftgröße ist kein Literal, sondern das Token der 16-px-Stufe', () => {
    expect(cssVars.fontSizes.lg).toBe('var(--font-size-lg)');
    expect(cssVars.fontSizes.lg).not.toBe(cssVars.fontSizes.sm);
  });
});
