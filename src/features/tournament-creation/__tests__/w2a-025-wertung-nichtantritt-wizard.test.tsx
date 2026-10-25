/**
 * R2 PR 3 – @W2A-025 im Wizard (Schritt 2, Abschnitt Match Cockpit), CLAUDE.md „Häufig vergessen“: der Wizard hat eine eigene
 * Instanz des Feldes „Wertung bei Nichtantritt“.
 *   Gegeben die Turnierleitung stellt die Nichtantritt-Wertung auf 3:0 / Wenn ein Nichtantritt markiert wird / Dann lautet die Wertung 3:0.
 * Und @W2A-078 (gesperrt, sobald ein Spiel als Nichtantritt gewertet ist) gilt auch hier, z. B. beim Bearbeiten eines laufenden
 * Turniers über den Wizard.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../../components/ui/Toast/ToastContext';
import { renderInRouter, oeffneAlleAbschnitte } from '../../../__tests__/helpers/b03PlatzhalterHarness';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { forfeitResultFor } from '../../../core/models/forfeit';
import type { Match, Tournament } from '../../../types/tournament';

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

const gewertetesSpiel = {
  id: 'm-1', round: 1, field: 1,
  slotA: { kind: 'team', teamId: 'a' }, slotB: { kind: 'team', teamId: 'b' },
  matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B',
} as unknown as Match;

function zeige(start: Partial<Tournament>) {
  const onUpdate = vi.fn();
  function Harness() {
    const [formData, setFormData] = useState<Partial<Tournament>>(start);
    return (
      <Step2_ModeAndSystem
        formData={formData}
        onUpdate={(field, value) => { setFormData((f) => ({ ...f, [field]: value })); onUpdate(field, value); }}
        onMovePlacementLogic={vi.fn()}
        onTogglePlacementLogic={vi.fn()}
      />
    );
  }
  const { container } = renderInRouter(<ToastProvider><Harness /></ToastProvider>);
  oeffneAlleAbschnitte(container);
  return { onUpdate, feld: screen.getByTestId('settings-forfeit-score') };
}

describe('@W2A-025 Wizard Schritt 2: Wertung bei Nichtantritt', () => {
  it('@W2A-025 vorbelegt 2 (2:0); 3 eingestellt → der Wizard übernimmt 3:0, ein Nichtantritt wird dann 3:0 gewertet', () => {
    const { feld, onUpdate } = zeige({ mode: 'classic' });
    expect(feld).toHaveValue(2);
    fireEvent.change(feld, { target: { value: '3' } });
    fireEvent.blur(feld);
    expect(onUpdate).toHaveBeenCalledWith('forfeitScore', { winner: 3, loser: 0 });
    expect(forfeitResultFor({ forfeitScore: { winner: 3, loser: 0 } }, 'A')).toEqual({ a: 0, b: 3 });
    expect(feld).toHaveValue(3);
  }, 30_000);

  it('Gegenbeispiel: 21 Tore liegen außerhalb des gültigen Bereichs → Hinweis am Feld, nichts übernommen', () => {
    const { feld, onUpdate } = zeige({ mode: 'classic' });
    fireEvent.change(feld, { target: { value: '21' } });
    fireEvent.blur(feld);
    expect(screen.getByRole('alert').textContent).toContain('settings.forfeitScoreRangeError');
    expect(onUpdate).not.toHaveBeenCalledWith('forfeitScore', expect.anything());
  }, 30_000);

  it('@W2A-078 mit einem als Nichtantritt gewerteten Spiel ist das Feld auch im Wizard gesperrt, mit Grund', () => {
    const { feld, onUpdate } = zeige({ mode: 'classic', forfeitScore: { winner: 2, loser: 0 }, matches: [gewertetesSpiel] });
    expect(feld).toBeDisabled();
    expect(screen.getByTestId('settings-forfeit-score-locked')).toHaveTextContent('settings.forfeitScoreLocked');
    fireEvent.change(feld, { target: { value: '3' } });
    fireEvent.blur(feld);
    expect(onUpdate).not.toHaveBeenCalledWith('forfeitScore', expect.anything());
  }, 30_000);
});
