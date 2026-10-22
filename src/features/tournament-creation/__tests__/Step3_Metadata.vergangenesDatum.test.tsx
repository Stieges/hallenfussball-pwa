/**
 * Assistent, Schritt 1 (Stammdaten): ein vergangenes Datum blockiert ein festgelegtes Turnier nicht
 * (C-META-NOVALID, @W5-003). Am Feld steht keine Fehlermeldung und das Datum hat kein `min`.
 * Gegenbeispiel: beim Entwurf bleiben Meldung und `min` (F-113).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

// LocationForm/ContactForm brauchen einen RepositoryProvider; sie sind hier nicht Gegenstand.
vi.mock('../../../components/LocationForm', () => ({ LocationForm: () => null }));
vi.mock('../../../components/ContactForm', () => ({ ContactForm: () => null }));

import { Step3_Metadata } from '../Step3_Metadata';

function zeige(status: 'draft' | 'published') {
  const formData = {
    status, title: 'Wintercup', startDate: '2020-01-11', date: '2020-01-11', startTime: '10:00',
    sport: 'football', location: { name: 'Halle' },
  } as unknown as Partial<Tournament>;
  render(<Step3_Metadata formData={formData} onUpdate={vi.fn()} />);
  return screen.getByTestId('wizard-start-date');
}

describe('Schritt 1: vergangenes Datum (C-META-NOVALID, @W5-003)', () => {
  it('@W5-003 festgelegtes Turnier: keine Fehlermeldung, kein min am Datum', () => {
    const feld = zeige('published');
    expect(screen.queryByText(/Vergangenheit/)).toBeNull();
    expect(feld.getAttribute('min')).toBeNull();
  });

  it('@W5-003 Gegenbeispiel: Entwurf zeigt die Meldung und setzt min', () => {
    const feld = zeige('draft');
    expect(screen.getByText(/Vergangenheit/)).toBeTruthy();
    expect(feld.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
