/**
 * @ZP-109 / @ZM-195 Die gemeinsame Karte „läuft / als Nächstes“: Zuschauer und Turnierleitung teilen den Aufbau, unterscheiden sich in
 * Rahmen (`frame`) und in den Kästen beim nächsten Spiel (`showPlannedZero`). Der Zuschauer-Rahmen bleibt `borderActive`, die Turnierleitung
 * trägt beim laufenden Spiel den Live-Rahmen; Zuschauer sehen beim nächsten Spiel 0 : 0 (@ZM-195), die Turnierleitung leere Kästen (Mockup Runde 4).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';
import { cssVars } from '../../../design-tokens';
import { buildTournamentView } from '../../../core/view';
import { generateFullSchedule } from '../../../core/generators';
import { fPAUSE, fZEIT } from '../../../core/view/__fixtures__/hallencupNord';
import { CurrentMatchCard } from '../CurrentMatchCard';
import { buildSideContext } from '../matchSides';
import { kastenOf } from '../currentBlockOf';
import type { Tournament } from '../../../types/tournament';

await initRealDeI18n();

function karte(tournament: Tournament, which: 'live' | 'next', options: { frame: 'active' | 'live'; showPlannedZero: boolean }) {
  const schedule = generateFullSchedule(tournament);
  const view = buildTournamentView(tournament, { audience: 'organizer', medium: 'app', locale: 'de' });
  const match = which === 'live' ? view.current.live[0] : view.current.next;
  if (match === undefined) { throw new Error('Fixture ohne Spiel'); }
  const scheduled = schedule.allMatches.find((m) => m.id === match.id);
  if (scheduled === undefined) { throw new Error('Spiel fehlt im Spielplan'); }
  const sides = buildSideContext({ teams: tournament.teams, groups: tournament.groups, matches: schedule.allMatches, view, locale: 'de' }, schedule.allMatches);
  render(
    <CurrentMatchCard
      match={match} scheduled={scheduled} sides={sides} clock={null} kasten={kastenOf(match, view)} head={<span>Kopf</span>} headVariant="plain"
      frame={options.frame} showPlannedZero={options.showPlannedZero} testIdPrefix="t" kind={which}
    />,
  );
  return match;
}

describe('@ZP-109 CurrentMatchCard', () => {
  it('@ZM-195 Zuschauer-Karte (showPlannedZero) zeigt beim nächsten Spiel Kästen mit 0', async () => {
    const { tournament } = await fZEIT();
    const m = karte(tournament, 'next', { frame: 'active', showPlannedZero: true });
    expect(screen.getByTestId(`match-box-kopf-${m.id}-home`)).toHaveTextContent('0');
    expect(screen.getByTestId(`match-box-kopf-${m.id}-away`)).toHaveTextContent('0');
  });

  it('@ZP-109 Gegenbeispiel: die Turnierleitung zeigt beim nächsten Spiel leere Kästen', async () => {
    const { tournament } = await fZEIT();
    const m = karte(tournament, 'next', { frame: 'live', showPlannedZero: false });
    expect(screen.getByTestId(`match-box-kopf-${m.id}-home`).textContent).not.toMatch(/\d/);
    expect(screen.getByTestId(`match-box-kopf-${m.id}-away`).textContent).not.toMatch(/\d/);
  });

  it('@ZP-109 Gegenbeispiel: ein laufendes Spiel zeigt den Stand, auch ohne showPlannedZero', async () => {
    const { tournament } = await fPAUSE();
    const m = karte(tournament, 'live', { frame: 'live', showPlannedZero: false });
    expect(screen.getByTestId(`match-box-kopf-${m.id}-home`).textContent).toMatch(/\d/);
  });

  it('@ZM-141 Zuschauer-Rahmen beim laufenden Spiel bleibt borderActive; die Turnierleitung trägt den Live-Rahmen', async () => {
    const { tournament } = await fPAUSE();
    const m = karte(tournament, 'live', { frame: 'active', showPlannedZero: true });
    const rahmen = screen.getByTestId(`t-card-${m.id}`).style.border;
    expect(rahmen).toContain(cssVars.colors.borderActive);
    expect(rahmen).not.toContain(cssVars.colors.statusLive);
  });

  it('@ZP-109 Turnierleitung: Live-Rahmen (status-live, kräftig) beim laufenden Spiel', async () => {
    const { tournament } = await fPAUSE();
    const m = karte(tournament, 'live', { frame: 'live', showPlannedZero: false });
    const rahmen = screen.getByTestId(`t-card-${m.id}`).style.border;
    expect(rahmen).toContain(cssVars.colors.statusLive);
    expect(rahmen).toContain(cssVars.borderWidth.medium);
  });

  it('@ZP-109 Gegenbeispiel: das nächste Spiel trägt in beiden Fällen den dünnen Standardrahmen', async () => {
    const { tournament } = await fZEIT();
    const m = karte(tournament, 'next', { frame: 'live', showPlannedZero: false });
    const rahmen = screen.getByTestId(`t-card-${m.id}`).style.border;
    expect(rahmen).toContain(cssVars.borderWidth.thin);
    expect(rahmen).toContain(cssVars.colors.border);
  });
});
