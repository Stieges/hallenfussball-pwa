/**
 * B-04c Fixrunde 2 – @W2A-039: Platzierungsspiele haben eine eigene Entscheidungsregel,
 * vorbelegt wie die K.-o.-Spiele.
 *
 * Pflichttest (Szenario wörtlich):
 *   - Finale auf „Verlängerung, dann Strafstoßschießen" → Zeile „Platzierungsspiele"
 *     sichtbar, vorbelegt mit „Verlängerung, dann Strafstoßschießen" (Rückfall Finale-Regel)
 *   - Zeile umstellen auf „Strafstoßschießen" → gespeichertes Turnier trägt placement
 *   - Engine-Weg (seit ZA-3 regulär, A-08d1): initializeMatch Spiel um Platz 3 → 'shootout';
 *     Finale → 'overtime-then-shootout'
 * Gegenbeispiele:
 *   - Modus ohne Platzierungsspiele ('final-only') zeigt die Zeile nicht (Wizard, grün)
 *   - Ohne eigene Änderung bleibt placement ungespeichert, Anzeige zeigt den Rückfall (Wizard, grün);
 *     Engine-Weg (seit ZA-3 regulär): Platz 3 folgt dem Finale
 *   - Halbfinale bleibt bei seiner Regel: Wizard und resolveTiebreakMode (grün); Engine-Weg (seit ZA-3 regulär)
 * Mutation:
 *   - Wizard-Zeile speichert placement nicht → rot (grüner Wizard-Test)
 *   - Rückfall in der Zeilenvorbelegung auf die Finale-Regel entfernen → rot (grüner Wizard-Test)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { resolveTiebreakMode } from '../../../core/match/tiebreakDecision';
import { startEngineSpiel, type RegelSpiel } from '../../../test/engineSpielFixture';
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

/** Cockpit-Seite auf dem Engine-Weg (A-08d1): Regel des Engine-Stands. */
async function cockpitLive(tournament: Tournament, match: RegelSpiel): Promise<{ tiebreakerMode: TiebreakerMode | undefined }> {
  const spiel = await startEngineSpiel(tournament, match);
  return { tiebreakerMode: spiel.tiebreakerMode };
}

function wert(select: HTMLElement): string {
  return (select as HTMLSelectElement).value;
}

/** Wizard: Finale „Verlängerung, dann Strafstoßschießen", Zeile Platzierungsspiele vorbelegt und umgestellt. */
function entwurfPlatzierungUmgestellt(): Tournament {
  return entwurfPerUi(() => {
    fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
      target: { value: 'overtime-then-shootout' },
    });
    // Eigene Zeile „Platzierungsspiele", vorbelegt mit der Finale-Regel
    const zeile = screen.getByTestId('tiebreaker-round-placement');
    expect(wert(zeile)).toBe('overtime-then-shootout');
    fireEvent.change(zeile, { target: { value: 'shootout' } });
  });
}

/** Wizard: Finale gesetzt, Platzierungszeile ohne eigene Änderung. */
function entwurfOhneEigeneAenderung(): Tournament {
  return entwurfPerUi(() => {
    fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
      target: { value: 'overtime-then-shootout' },
    });
    expect(wert(screen.getByTestId('tiebreaker-round-placement'))).toBe('overtime-then-shootout');
  });
}

/** Wizard: Halbfinale goldenGoal, Finale und Platzierung anders. */
function entwurfHalbfinale(): Tournament {
  return entwurfPerUi(() => {
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
}

describe('B-04c Fixrunde 2 – @W2A-039 Platzierungsspiele eigene Entscheidungsregel (Wizard)', () => {
  it('(Wizard) @W2A-039: Zeile vorbelegt wie Finale, Umstellen wird als placement gespeichert, Finale bleibt', () => {
    const entwurf = entwurfPlatzierungUmgestellt();

    expect(entwurf.finalsConfig?.tiebreakerByRound?.placement).toBe('shootout');
    expect(entwurf.finalsConfig?.tiebreakerByRound?.final).toBe('overtime-then-shootout');
  });

  // ZA-3 (D1): Befund C-KO-RUNDENREGEL-SERVER behoben – Engine-Regeln lesen Runde und finalType, Markierung entfernt
  // Engine-Weg: serverRules kennt weder tiebreakerByRound noch finalType; Finale bekommt den globalen Rückfall 'shootout'.
  // Aussagekräftig nach A-27: Platz 3 = 'shootout' UND Finale = 'overtime-then-shootout' (zwei verschiedene Werte).
  it('Pflichttest (Cockpit) @W2A-039: Platz 3 zeigt die Platzierungsregel, das Finale seine Finale-Regel', async () => {
    const entwurf = entwurfPlatzierungUmgestellt();

    expect((await cockpitLive(entwurf, { phase: 'final', finalType: 'thirdPlace' })).tiebreakerMode).toBe('shootout');
    expect((await cockpitLive(entwurf, { phase: 'final', finalType: 'final' })).tiebreakerMode).toBe('overtime-then-shootout');
  });

  it('Gegenbeispiel (Wizard) @W2A-039: Modus ohne Platzierungsspiele zeigt die Zeile nicht', () => {
    entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-advanced-options-toggle'));
      fireEvent.click(screen.getByTestId('finals-preset-final-only'));
      fireEvent.change(screen.getByTestId('tiebreaker-round-final'), {
        target: { value: 'overtime-then-shootout' },
      });
      expect(screen.queryByTestId('tiebreaker-round-placement')).toBeNull();
    });
  });

  it('Gegenbeispiel (Wizard) @W2A-039: ohne eigene Änderung bleibt placement ungespeichert, Anzeige zeigt den Rückfall', () => {
    const entwurf = entwurfOhneEigeneAenderung();

    expect(entwurf.finalsConfig?.tiebreakerByRound?.placement).toBeUndefined();
  });

  // ZA-3 (D1): Befund C-KO-RUNDENREGEL-SERVER behoben – Engine-Regeln lesen Runde und finalType, Markierung entfernt
  // Engine-Weg: Platz 3 bekommt den globalen Rückfall, nicht die Finale-Regel des Entwurfs.
  // Aussagekräftig nach A-27: Platz 3 ohne Platzierungsregel = Finale-Regel ('overtime-then-shootout' ≠ Rückfall 'shootout').
  it('Gegenbeispiel (Cockpit) @W2A-039: ohne Platzierungsregel folgt Platz 3 im Cockpit dem Finale', async () => {
    const entwurf = entwurfOhneEigeneAenderung();

    expect((await cockpitLive(entwurf, { phase: 'final', finalType: 'thirdPlace' })).tiebreakerMode).toBe(
      'overtime-then-shootout',
    );
  });

  it('Gegenbeispiel (Wizard + Entscheidungsfunktion) @W2A-039: das Halbfinale behält seine Regel', () => {
    const entwurf = entwurfHalbfinale();

    expect(entwurf.finalsConfig?.tiebreakerByRound?.semifinal).toBe('goldenGoal');
    expect(resolveTiebreakMode(entwurf.finalsConfig, 'semifinal')).toBe('goldenGoal');
  });

  // ZA-3 (D1): Befund C-KO-RUNDENREGEL-SERVER behoben – Engine-Regeln lesen Runde und finalType, Markierung entfernt
  // Engine-Weg: das Halbfinale bekommt den globalen Rückfall 'shootout' statt goldenGoal.
  // Aussagekräftig nach A-27: Halbfinale 'goldenGoal' ≠ Finale 'overtime-then-shootout' ≠ Platz 3 'shootout'.
  it('Gegenbeispiel (Cockpit) @W2A-039: das Halbfinale behält seine Regel im Cockpit', async () => {
    const entwurf = entwurfHalbfinale();

    expect((await cockpitLive(entwurf, { phase: 'semifinal' })).tiebreakerMode).toBe('goldenGoal');
  });
});
