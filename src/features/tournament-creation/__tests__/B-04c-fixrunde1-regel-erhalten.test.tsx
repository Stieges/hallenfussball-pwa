/**
 * B-04c Fixrunde 1 – Fix 3 (MiMo 4/7, E3): Regel geht nicht verloren, gleicher Rückfall wie der Server.
 *
 * Pflichttest:
 *   - UI-Weg: Golden Goal einstellen → Gruppensystem roundRobin → groupsAndFinals
 *     → Entwurf behält tiebreaker === 'goldenGoal' (kein Zurücksetzen beim Wechsel)
 *   - Import eines JSON mit tiebreakerByRound.semifinal = 'shootout' → gespeichert
 *   - K.-o.-Spiel ohne Regel → Cockpit-Banner mit Strafstoßschießen (Rückfall wie der Server, S14)
 * Gegenbeispiel:
 *   - Erstwechsel auf groupsAndFinals ohne vorherige Regel → Sport-Vorgabe wird gesetzt
 *   - Gruppenspiel ohne Regel → undefined (keine Entscheidung, kein Banner)
 * Mutation:
 *   - Reset-Zeile in useTournamentWizard (tiebreaker/tiebreakerDuration beim Wechsel
 *     auf groupsAndFinals wieder überschreiben) wieder rein → rot
 *   - Rückfall ?? 'shootout' in resolveTiebreakMode entfernen → rot
 */
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { startEngineSpiel } from '../../../test/engineSpielFixture';
import { TiebreakerBanner } from '../../../components/match-cockpit/TiebreakerBanner';
import { validateAndParseTournamentImport } from '../../../utils/tournamentImporter';
import { getSportConfig, DEFAULT_SPORT_ID } from '../../../config/sports';
import type { Tournament, FinalsPreset } from '../../../types/tournament';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

type WizardApi = ReturnType<typeof useTournamentWizard>;
type BannerMatch = ComponentProps<typeof TiebreakerBanner>['match'];

function Harness({ onDraft }: { onDraft: (t: Tournament) => void }) {
  const api: WizardApi = useTournamentWizard();
  return (
    <>
      <FinalsConfiguration formData={api.formData} onUpdate={api.updateForm} />
      <button
        type="button"
        data-testid="setz-ohne-regel"
        onClick={() => {
          api.updateForm('finalsConfig', { preset: 'none' });
        }}
      >
        Ohne Regel
      </button>
      <button
        type="button"
        data-testid="setz-roundRobin"
        onClick={() => {
          api.updateForm('groupSystem', 'roundRobin');
        }}
      >
        roundRobin
      </button>
      <button
        type="button"
        data-testid="setz-groupsAndFinals"
        onClick={() => {
          api.updateForm('groupSystem', 'groupsAndFinals');
        }}
      >
        groupsAndFinals
      </button>
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

/** Cockpit-Seite auf dem Engine-Weg (A-08d1): Regel und Überlaufzeit aus dem Engine-Stand. */
async function cockpitLive(tournament: Tournament, phase: string) {
  const spiel = await startEngineSpiel(tournament, phase);
  return { tiebreakerMode: spiel.tiebreakerMode, overtimeDurationSeconds: spiel.rules.overtimeSeconds };
}

describe('B-04c Fixrunde 1 – Regel geht nicht verloren, Rückfall wie der Server', () => {
  it('Pflichttest: Golden Goal überlebt roundRobin → groupsAndFinals im Entwurf', () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-preset-top-4'));
      fireEvent.click(screen.getByTestId('tiebreaker-goldenGoal'));
      fireEvent.click(screen.getByTestId('setz-roundRobin'));
      fireEvent.click(screen.getByTestId('setz-groupsAndFinals'));
    });

    expect(entwurf.finalsConfig?.tiebreaker).toBe('goldenGoal');
  });

  it('Pflichttest: Import übernimmt tiebreaker/tiebreakerDuration/tiebreakerByRound', () => {
    const ergebnis = validateAndParseTournamentImport(
      JSON.stringify({
        title: 'Import-Test',
        teams: [{ id: 'a', name: 'Alpha' }],
        finalsConfig: {
          preset: 'top-4',
          tiebreaker: 'goldenGoal',
          tiebreakerDuration: 5,
          tiebreakerByRound: { semifinal: 'shootout' },
        },
      }),
      'json',
    );

    expect(ergebnis.isValid).toBe(true);
    expect(ergebnis.tournament?.finalsConfig?.tiebreaker).toBe('goldenGoal');
    expect(ergebnis.tournament?.finalsConfig?.tiebreakerDuration).toBe(5);
    expect(ergebnis.tournament?.finalsConfig?.tiebreakerByRound?.semifinal).toBe('shootout');
  });

  it('Pflichttest: K.-o.-Spiel ohne Regel zeigt im Cockpit den Banner mit Strafstoßschießen', async () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('finals-preset-top-4'));
    });
    const turnier: Tournament = {
      ...entwurf,
      finalsConfig: { preset: 'top-4' as FinalsPreset },
    };

    const live = await cockpitLive(turnier, 'final');
    expect(live.tiebreakerMode).toBe('shootout');

    const onStartOvertime = vi.fn();
    const onStartGoldenGoal = vi.fn();
    const onStartPenaltyShootout = vi.fn();
    const onForceFinish = vi.fn();
    const banner = render(
      <TiebreakerBanner
        match={
          {
            id: 'm-final',
            homeTeam: { name: 'Alpha' },
            awayTeam: { name: 'Beta' },
            homeScore: 2,
            awayScore: 2,
            overtimeScoreA: 0,
            overtimeScoreB: 0,
            tiebreakerMode: live.tiebreakerMode,
            overtimeDurationSeconds: live.overtimeDurationSeconds,
          } as unknown as BannerMatch
        }
        onStartOvertime={onStartOvertime}
        onStartGoldenGoal={onStartGoldenGoal}
        onStartPenaltyShootout={onStartPenaltyShootout}
        onForceFinish={onForceFinish}
      />,
    );

    const knoepfe = within(banner.container).getAllByRole('button');
    expect(knoepfe).toHaveLength(2);
    fireEvent.click(knoepfe[0]);
    expect(onStartPenaltyShootout).toHaveBeenCalledWith('m-final');
    fireEvent.click(knoepfe[1]);
    expect(onForceFinish).toHaveBeenCalledWith('m-final');
    expect(onStartOvertime).not.toHaveBeenCalled();
    expect(onStartGoldenGoal).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Erstwechsel auf groupsAndFinals ohne Regel setzt die Sport-Vorgabe', () => {
    const sportConfig = getSportConfig(DEFAULT_SPORT_ID);
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('setz-ohne-regel'));
      fireEvent.click(screen.getByTestId('setz-groupsAndFinals'));
    });

    expect(entwurf.finalsConfig?.tiebreaker).toBeDefined();
    expect(entwurf.finalsConfig?.tiebreaker).toBe(sportConfig.rules.defaultTiebreaker);
    expect(entwurf.finalsConfig?.tiebreakerDuration).toBe(
      sportConfig.rules.defaultTiebreakerDuration,
    );
  });

  it('Gegenbeispiel: Gruppenspiel ohne Regel → keine Entscheidung', async () => {
    const entwurf = entwurfPerUi(() => {
      fireEvent.click(screen.getByTestId('setz-ohne-regel'));
    });
    const turnier: Tournament = {
      ...entwurf,
      finalsConfig: { preset: 'top-4' as FinalsPreset },
    };

    const live = await cockpitLive(turnier, 'groupStage');
    expect(live.tiebreakerMode).toBeUndefined();
  });
});
