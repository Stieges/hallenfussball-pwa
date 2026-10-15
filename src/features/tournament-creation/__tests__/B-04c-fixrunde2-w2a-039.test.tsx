/**
 * B-04c Fixrunde 2 – @W2A-039: Platzierungsspiele haben eine eigene Entscheidungsregel,
 * vorbelegt wie die K.-o.-Spiele.
 *
 * Pflichttest (Szenario wörtlich):
 *   - Finale auf „Verlängerung, dann Strafstoßschießen“ → Zeile „Platzierungsspiele“
 *     sichtbar, vorbelegt mit „Verlängerung, dann Strafstoßschießen“ (Rückfall Finale-Regel)
 *   - Zeile umstellen auf „Strafstoßschießen“ → gespeichertes Turnier trägt placement
 *   - initializeMatch Spiel um Platz 3 (finalType 'thirdPlace') → 'shootout';
 *     Finale (finalType 'final') → 'overtime-then-shootout'
 * Gegenbeispiel:
 *   - Modus ohne Platzierungsspiele ('final-only') zeigt die Zeile nicht
 *   - Ohne eigene Änderung bleibt placement ungespeichert (Anzeige des Rückfalls)
 *   - Halbfinale unverändert
 * Mutation:
 *   - Wizard-Zeile speichert placement nicht → rot
 *   - Rückfall in der Zeilenvorbelegung auf die Finale-Regel entfernen → rot
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { startEngineSpiel } from '../../../test/engineSpielFixture';
import { resolveTiebreakMode } from '../../../core/match/tiebreakDecision';
import type { Tournament, TiebreakerMode } from '../../../types/tournament';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

type WizardApi = ReturnType<typeof useTournamentWizard>;

function Harness({ onDraft }: { onDraft: (t: Tournament) => void }) {
  const api: WizardApi = useTournamentWizard();
  return (
    <>
      <FinalsConfiguration formData={api.formData} onUpdate={api.updateForm} />
      <button
        type="button"
        data-testid="probe-create-draft"
        onClick={() => {
          onDraft(api.createDraftTournament());
        }}
      >
        Entwurf erzeugen
      </button>
    </>
  );
}

function entwurfPerUi(schritte: () => void): Tournament {
  const entwuerfe: Tournament[] = [];
  render(<Harness onDraft={(t) => entwuerfe.push(t)} />);
  schritte();
  fireEvent.click(screen.getByTestId('probe-create-draft'));
  const entwurf = entwuerfe[0];
  if (!entwurf) {
    throw new Error('Entwurf wurde nicht erzeugt');
  }
  return entwurf;
}

/**
 * Cockpit-Seite auf dem Engine-Weg (A-08d1). Die Engine kennt nur `finalsConfig.tiebreaker`,
 * nicht `tiebreakerByRound` und nicht `finalType` (Befund C-KO-RUNDENREGEL-SERVER, A-27):
 * `finalType` kann hier darum nicht wirken und bleibt nur als Beschreibung der Testfälle.
 */
async function cockpitLive(tournament: Tournament, phase: string, _finalType?: string) {
  const spiel = await startEngineSpiel(tournament, phase);
  return { tiebreakerMode: spiel.tiebreakerMode };
}

function wert(select: HTMLElement): string {
  return (select as HTMLSelectElement).value;
}

describe('B-04c Fixrunde 2 – @W2A-039 Platzierungsspiele eigene Entscheidungsregel (Wizard)', () => {
  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  it.fails('Pflichttest: Szenario – Zeile vorbelegt wie Finale, Umstellen wirkt nur auf Platz 3', async () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-preset-top-4'));
      fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
        target: { value: 'overtime-then-shootout' },
      });
      // Eigene Zeile „Platzierungsspiele“, vorbelegt mit der Finale-Regel
      const zeile = screen.getByTestId('tiebreaker-round-placement');
      expect(wert(zeile)).toBe('overtime-then-shootout');
      fireEvent.change(zeile, { target: { value: 'shootout' } });
    });

    expect(entwurf.finalsConfig?.tiebreakerByRound?.placement).toBe('shootout');
    expect(entwurf.finalsConfig?.tiebreakerByRound?.final).toBe('overtime-then-shootout');

    const platz3 = await cockpitLive(entwurf, 'final', 'thirdPlace');
    expect(platz3.tiebreakerMode).toBe('shootout');
    const finale = await cockpitLive(entwurf, 'final', 'final');
    expect(finale.tiebreakerMode).toBe('overtime-then-shootout');
  });

  it('Gegenbeispiel: Modus ohne Platzierungsspiele zeigt die Zeile nicht', () => {
    entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-advanced-options-toggle'));
      fireEvent.click(screen.getByTestId('finals-preset-final-only'));
      fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
        target: { value: 'overtime-then-shootout' },
      });
      expect(screen.queryByTestId('tiebreaker-round-placement')).toBeNull();
    });
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  it.fails('Gegenbeispiel: ohne eigene Änderung bleibt placement ungespeichert, Anzeige zeigt den Rückfall', async () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-preset-top-4'));
      fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
        target: { value: 'overtime-then-shootout' },
      });
      expect(wert(screen.getByTestId('tiebreaker-round-placement'))).toBe('overtime-then-shootout');
    });

    expect(entwurf.finalsConfig?.tiebreakerByRound?.placement).toBeUndefined();
    // Rückfall auf die Finale-Regel greift auch ohne gespeicherte Platzierungs-Regel:
    const platz3 = await cockpitLive(entwurf, 'final', 'thirdPlace');
    expect(platz3.tiebreakerMode).toBe('overtime-then-shootout');
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  it.fails('Gegenbeispiel: Halbfinale bleibt bei seiner Regel, wenn Platzierungsspiele umgestellt sind', async () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-preset-top-4'));
      fireEvent.change(screen.getByTestId('tiebreaker-round-semifinal'), {
        target: { value: 'goldenGoal' },
      });
      fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
        target: { value: 'overtime-then-shootout' },
      });
      fireEvent.change(screen.getByTestId('tiebreaker-round-placement'), {
        target: { value: 'shootout' },
      });
    });

    const halbfinale = await cockpitLive(entwurf, 'semifinal');
    expect(halbfinale.tiebreakerMode).toBe('goldenGoal');
    expect(
      resolveTiebreakMode(entwurf.finalsConfig, 'semifinal') satisfies TiebreakerMode | undefined,
    ).toBe('goldenGoal');
  });
});
