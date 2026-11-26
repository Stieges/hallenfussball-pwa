/**
 * @W3-042 Eine eingetragene Trikotfarbe lässt sich wieder auf „Unbekannt“ stellen – im Reiter „Teams“ des laufenden Turniers und im Wizard,
 * Schritt „Teams“. @W3-043 Die Standardfarben Heim und Gast bieten kein „Unbekannt“ an.
 * Hallencup Nord, SV Süd mit Schwarz. „Keine Farbe“ ist der Zustand wie bei einem Team, dem nie eine Farbe gegeben wurde (`colors` fehlt).
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('react-colorful', () => ({
  HexColorPicker: ({ onChange }: { onChange: (c: string) => void }) => (
    <button type="button" data-testid="ziehen" onClick={() => { for (const c of ['#112233', '#223344', '#4FC3F7']) { onChange(c); } }}>ziehen</button>
  ),
}));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamsTab } from '../TeamsTab';
import { Step4_Teams } from '../../tournament-creation/Step4_Teams';
import { SpectatorDisplaySection } from '../../tournament-admin/categories/Visibility/SpectatorDisplaySection';
import { buildTournament } from '../../monitor-display/__tests__/monitorFixture';
import { TeamSchema } from '../../../core/models/schemas/TournamentSchema';

await initRealDeI18n();

const SUED = '00000000-0000-4000-8000-000000000002';
const SCHWARZ = '#000000';
const MIT_FARBE = { id: SUED, name: 'SV Süd', colors: { primary: SCHWARZ } } as Team;
const turnier = (teams: Team[]) => ({ id: 't', title: 'Hallencup Nord', status: 'published', teams, matches: [] }) as unknown as Tournament;

/** Hält das Turnier wie die Verwaltung: `onTournamentUpdate` ersetzt es; `gespeichert` ist der Stand, den das Repository bekäme. */
function Host({ initial, onSave }: { initial: Tournament; onSave: (t: Tournament) => void }) {
  const [t, setT] = useState(initial);
  return <TeamsTab tournament={t} onTournamentUpdate={(n) => { setT(n); onSave(n); }} />;
}

function waehleUnbekannt() {
  fireEvent.click(screen.getByRole('option', { name: 'Trikotfarbe unbekannt' }));
}

describe('@W3-042 Reiter „Teams“: Schwarz → „Unbekannt“', () => {
  it('speichert keine Farbe; der Farbpunkt zeigt das Muster und wird als „Trikotfarbe unbekannt“ vorgelesen', () => {
    const save = vi.fn<(t: Tournament) => void>();
    render(<Host initial={turnier([MIT_FARBE])} onSave={save} />);
    fireEvent.click(screen.getByTestId(`team-expand-toggle-${SUED}`));
    expect(screen.getByTestId(`team-color-dot-${SUED}`)).toHaveAttribute('data-accent', SCHWARZ);

    fireEvent.click(within(screen.getByTestId(`team-card-${SUED}`)).getByRole('button', { name: /#000000/i }));
    const optionen = screen.getAllByRole('option');
    expect(optionen[0], 'Unbekannt ist das erste Feld').toHaveAccessibleName('Trikotfarbe unbekannt');
    waehleUnbekannt();

    const gespeichert = save.mock.calls.at(-1)![0];
    expect(gespeichert.teams[0].colors).toBeUndefined();
    // „nach dem Neuladen / zweites Gerät“: der gespeicherte Stand, durch die Prüfung gelesen, hat keine Farbe
    const geladen = TeamSchema.parse(JSON.parse(JSON.stringify(gespeichert.teams[0])));
    expect(geladen.colors).toBeUndefined();

    const punkt = screen.getByTestId(`team-color-dot-${SUED}`);
    expect(punkt).toHaveAttribute('data-shirt-unknown', 'true');
    expect(punkt).toHaveAccessibleName('Trikotfarbe unbekannt');
    expect(punkt.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(within(screen.getByTestId(`team-card-${SUED}`)).getByRole('button', { name: 'Trikotfarbe unbekannt' })).toHaveTextContent('Unbekannt');
  });

  it('Gegenprobe: ein Team ohne Farbe wählt Schwarz wieder wie gewohnt', () => {
    const save = vi.fn<(t: Tournament) => void>();
    render(<Host initial={turnier([{ id: SUED, name: 'SV Süd' }])} onSave={save} />);
    fireEvent.click(screen.getByTestId(`team-expand-toggle-${SUED}`));
    fireEvent.click(within(screen.getByTestId(`team-card-${SUED}`)).getByRole('button', { name: /unbekannt/i }));
    expect(screen.getByRole('option', { name: 'Trikotfarbe unbekannt' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('option', { name: 'Schwarz' }));
    expect(save.mock.calls.at(-1)![0].teams[0].colors?.primary).toBe(SCHWARZ);
  });
});

describe('@W3-042 Ziehfarbe bleibt nie stehen', () => {
  it('Team ohne Farbe: eigene Farbe ziehen, dann „Unbekannt“ – am Ende ist keine Farbe gespeichert', () => {
    vi.useFakeTimers();
    try {
      const save = vi.fn<(t: Tournament) => void>();
      render(<Host initial={turnier([{ id: SUED, name: 'SV Süd' }])} onSave={save} />);
      fireEvent.click(screen.getByTestId(`team-expand-toggle-${SUED}`));
      fireEvent.click(within(screen.getByTestId(`team-card-${SUED}`)).getByRole('button', { name: /unbekannt/i }));
      fireEvent.pointerDown(screen.getByTestId('ziehen'));
      fireEvent.click(screen.getByTestId('ziehen')); // Ziehbewegungen, noch nicht gespeichert
      expect(save).not.toHaveBeenCalled();
      waehleUnbekannt();
      act(() => { vi.advanceTimersByTime(2000); });
      fireEvent.pointerUp(document.body);
      expect(save).toHaveBeenCalled();
      expect(save.mock.calls.every(([t]) => t.teams[0].colors === undefined), 'nie wurde eine Ziehfarbe gespeichert').toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

describe('@W3-042 Wizard, Schritt „Teams“: Schwarz → „Unbekannt“', () => {
  it('ruft die Aktualisierung des Teams ohne Farbe auf; Unbekannt ist das erste Feld', () => {
    const onUpdateTeam = vi.fn();
    const noop = vi.fn();
    const formData = { teams: [MIT_FARBE], numberOfTeams: 1, numberOfGroups: 1, groupSystem: 'roundRobin' } as unknown as Tournament;
    render(<Step4_Teams formData={formData} onUpdate={noop} onAddTeam={noop} onRemoveTeam={noop} onUpdateTeam={onUpdateTeam} />);
    fireEvent.click(screen.getByTestId(`wizard-team-details-${SUED}`));
    fireEvent.click(screen.getByRole('button', { name: /#000000/i }));
    expect(screen.getAllByRole('option')[0]).toHaveAccessibleName('Trikotfarbe unbekannt');
    waehleUnbekannt();
    expect(onUpdateTeam).toHaveBeenCalledWith(SUED, { colors: undefined });
  });

  it('ohne Farbe zeigt der Auslöser „Unbekannt“ mit Muster statt eines Hex-Werts', () => {
    const noop = vi.fn();
    const ohne = { teams: [{ id: SUED, name: 'SV Süd' }], numberOfTeams: 1, numberOfGroups: 1, groupSystem: 'roundRobin' } as unknown as Tournament;
    render(<Step4_Teams formData={ohne} onUpdate={noop} onAddTeam={noop} onRemoveTeam={noop} onUpdateTeam={noop} />);
    fireEvent.click(screen.getByTestId(`wizard-team-details-${SUED}`));
    const punkt = screen.getByTestId('color-picker-unknown-dot');
    expect(punkt.parentElement).toHaveAttribute('aria-hidden', 'true'); // nicht doppelt vorgelesen
    expect(screen.getByRole('button', { name: 'Trikotfarbe unbekannt' })).toHaveAttribute('aria-haspopup', 'true'); // Auslöser liest es einmal
    expect(punkt.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(screen.queryByText(/#[0-9a-f]{6}/i)).toBeNull();
  });
});

describe('@W3-043 Standardfarben Heim und Gast', () => {
  it('die Farbauswahl „Standardfarbe Heim“ hat kein Feld „Unbekannt“', () => {
    render(<SpectatorDisplaySection tournament={buildTournament()} canEdit onTournamentUpdate={vi.fn()} />);
    fireEvent.click(within(screen.getByTestId('spectator-display-home-color')).getAllByRole('button')[0]);
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
    expect(screen.queryByRole('option', { name: /unbekannt/i })).toBeNull();
    expect(screen.queryByTestId('color-unknown-option')).toBeNull();
  });
});
