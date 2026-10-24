/**
 * Import-Vorschau: Altersklasse (Record Wizard-Regelprofile @W2B-022, @W2B-024, @W2B-026). Texte liefern im Test den Schlüssel.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { PreviewStep } from '../ImportSteps';

function vorschau(ageClass: string) {
  const tournament = {
    id: 'i1', title: 'Importcup', ageClass, teams: [], matches: [], location: { name: 'Halle' },
    startDate: '2030-01-01', date: '2030-01-01', externalSource: 'Datei',
  } as unknown as Tournament;
  return render(<PreviewStep tournament={tournament} onBack={() => undefined} onImport={() => undefined} />);
}

describe('Import-Vorschau zeigt die Altersklasse nur, wenn sie angegeben ist', () => {
  it('@W2B-022 leer oder nur Leerzeichen: weder Bezeichnung noch Wert', () => {
    vorschau('   ');
    expect(screen.queryByText(/labels\.ageClass$/)).toBeNull();
  });

  it.each(['U11', 'AH'])('@W2B-024 @W2B-026 „%s“ steht genau so da', (wert) => {
    vorschau(wert);
    expect(screen.getByText(/labels\.ageClass$/)).toBeInTheDocument();
    expect(screen.getByText(wert)).toBeInTheDocument();
  });
});
