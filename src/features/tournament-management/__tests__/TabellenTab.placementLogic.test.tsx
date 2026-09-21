/**
 * Regressionstest: leere Platzierungskriterien in der Gesamtplatzierung
 * (Abschluss-Review feat/terminologie-zentral, Befund 1).
 *
 * Deckt beide Richtungen ab:
 * 1. Kriterium ohne `label` (neues/importiertes Turnier) → übersetzte
 *    Beschriftung erscheint (nicht leer, nicht der rohe i18n-Key).
 * 2. Kriterium mit gespeichertem `label`, dessen `id` keinen i18n-Schlüssel
 *    hat (Altdaten/Import) → das gespeicherte Label bleibt sichtbar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import {
  buildTestTournament,
  buildScheduleAndStandings,
  createRealI18nWrapper,
} from './placementLogicTestHelpers';

// Siehe placementLogicTestHelpers.tsx: der globale Passthrough-Mock aus
// src/test/setup.ts ignoriert `defaultValue` und würde den "ohne label"-Fall
// vakuum-grün machen. Deshalb echte i18next-Instanz statt Mock.
vi.unmock('i18next');
vi.unmock('react-i18next');

async function renderRankingView(placementLogic: Parameters<typeof buildTestTournament>[0]) {
  const tournament = buildTestTournament(placementLogic);
  const { schedule, standings } = buildScheduleAndStandings(tournament);
  const Wrapper = await createRealI18nWrapper();

  render(
    <Wrapper>
      <TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} />
    </Wrapper>
  );

  // TabellenTab startet in der Gruppen-Ansicht — zur Gesamtplatzierung wechseln,
  // wo die Platzierungslogik-Zeile gerendert wird.
  await userEvent.click(screen.getByRole('button', { name: 'Gesamtplatzierung' }));
}

describe('TabellenTab: Platzierungskriterien-Beschriftung (Gesamtplatzierung)', () => {
  it('löst ein Kriterium ohne `label` über wizard.json auf (neues/importiertes Turnier)', async () => {
    await renderRankingView([{ id: 'goalDifference', enabled: true }]);

    // wizard.json: placementLogic.criteria.goalDifference = "Tordifferenz"
    // `selector: 'strong'` vermeidet die doppelte Fundstelle span > strong,
    // die denselben Text tragen (span umschließt nur das strong, kein Pfeil
    // bei einem einzelnen Kriterium).
    expect(screen.getByText('1. Tordifferenz', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/^1\.\s*$/, { selector: 'strong' })).not.toBeInTheDocument();
    expect(screen.queryByText(/goalDifference/)).not.toBeInTheDocument();
  });

  it('fällt für ein Kriterium mit gespeichertem `label` ohne passenden Schlüssel auf das Label zurück (Altdaten/Import)', async () => {
    await renderRankingView([
      { id: 'legacyCriterionOhneSchluessel', label: 'Alte Bezeichnung', enabled: true },
    ]);

    expect(screen.getByText('1. Alte Bezeichnung', { selector: 'strong' })).toBeInTheDocument();
  });
});
