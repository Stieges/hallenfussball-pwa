/**
 * Aushang/Spielplan-Kopf: Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { hallencupSchedule, hallencupTournament } from '../../../lib/pdf/__tests__/pdfFixture';
import { TournamentHeader } from '../TournamentHeader';

function untertitel(ageClass: string): string {
  const tournament = hallencupTournament({ ageClass });
  const { container } = render(<TournamentHeader schedule={hallencupSchedule(tournament)} />);
  const title = container.querySelector('h1');
  return (title?.parentElement?.nextElementSibling?.textContent ?? '').trim();
}

describe('Kopf des Spielplans', () => {
  it('@W2B-022 ohne Altersklasse steht kein Trennzeichen vor dem Datum', () => {
    const text = untertitel('');
    expect(text).not.toBe('');
    expect(text.startsWith('\u2022')).toBe(false);
    expect(text).not.toMatch(/Keine Angabe|U11/);
  });

  it.each(['U11', 'E2-Jugend', 'AH'])('@W2B-024 @W2B-026 „%s“ steht genau so davor', (wert) => {
    expect(untertitel(wert).startsWith(`${wert} \u2022 `)).toBe(true);
  });
});
