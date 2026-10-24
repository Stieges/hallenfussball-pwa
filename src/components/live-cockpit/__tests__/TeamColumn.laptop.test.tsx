/**
 * TeamColumn am Laptop (Plan Cockpit v2 B1–B3): @SL-186 (Strafen stehen als Karten rechts, nicht noch einmal als Marke unter den Tasten),
 * @SL-187 (Tor, Foul-Reihe und Kopf nehmen ihre Mindesthöhe aus der Stufe der Fensterhöhe), @SL-099/@SL-102 (Foul „n/Grenze“, ohne Grenze „Foul · n“,
 * Bildschirmleser ohne Trennpunkt), @SL-182 (lange Namen in der Leiste brechen um, nie „…“).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamColumn, type TeamColumnProps } from '../areas/TeamColumn';
import { NAME_50 } from './cockpitFixtures';
import type { TeamColumnModel } from '../model/toTeamColumnModel';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ALLE_ARTEN = { yellow: true, yellowRed: true, red: true, timePenalty: true };
const model = (m: Partial<TeamColumnModel> = {}): TeamColumnModel => ({
  seite: 'away', teamId: 'sv-sued', name: 'SV Süd', kasten: { fill: { kind: 'solid', color: '#C62828' }, bib: false }, fouls: { zaehlt: 3, grenze: 5 }, strafen: [], unterzahl: null,
  darfErgaenzen: false, gesperrt: [], zeitstrafeMinuten: 2, kartenArten: ALLE_ARTEN, ...m,
});
const props = (m: Partial<TeamColumnModel> = {}, p: Partial<TeamColumnProps> = {}): TeamColumnProps => ({
  model: model(m), knoepfe: { tor: true, foul: true, zeitstrafe: true, karte: true }, onTor: vi.fn(), onFoul: vi.fn(), onZeitstrafe: vi.fn(), onKarte: vi.fn(), breit: true, ...p,
});

describe('TeamColumn am Laptop', () => {
  it('@SL-186 laufende Strafen stehen nicht als Marke unter den Tasten (sie stehen als Karte in der rechten Spalte)', () => {
    render(<TeamColumn {...props({ strafen: [{ id: 'p1', rest: '1:12', nummer: 5, steht: false }] })} />);
    expect(screen.queryByTestId('team-penalty-p1')).toBeNull();
  });

  it('Gegenprobe: am Handy (nicht breit) steht die Marke weiter unter den Tasten', () => {
    render(<TeamColumn {...props({ strafen: [{ id: 'p1', rest: '1:12', nummer: 5, steht: false }] }, { breit: false, kompakt: true })} />);
    expect(screen.getByTestId('team-penalty-p1')).toHaveTextContent('Nr. 5 · 1:12');
  });

  it('@SL-187 Tor und Foul-Reihe nehmen die Mindesthöhe aus der Stufe (`--cockpit-tor`, `--cockpit-fuss`), der Kopf aus `--cockpit-kopf`', () => {
    render(<TeamColumn {...props()} />);
    expect(screen.getByTestId('goal-button-away').style.minHeight).toContain('--cockpit-tor');
    expect(screen.getByTestId('foul-button-away').style.minHeight).toContain('--cockpit-fuss');
    expect(screen.getByTestId('team-head-away').style.minHeight).toContain('--cockpit-kopf');
  });

  it('@SL-099 mit Grenze: „Foul 3/5“; @SL-102 ohne Grenze „Foul · 5“, der Bildschirmleser sagt „Foul 5“ ohne Punkt', () => {
    const { unmount } = render(<TeamColumn {...props()} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent(/^Foul 3\/5$/);
    unmount();
    render(<TeamColumn {...props({ fouls: { zaehlt: 5, grenze: null } })} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent(/^Foul · 5$/);
    expect(screen.getByRole('button', { name: 'Foul SV Süd, Foul 5' })).toBeInTheDocument();
  });

  it('@SL-182 ein 50-Zeichen-Name steht in der Leiste vollständig neben „Heim“/„Gast“, bricht um und endet nie mit „…“', () => {
    render(<TeamColumn {...props({ name: NAME_50 })} />);
    const kopf = screen.getByTestId('team-head-away');
    expect(screen.getByTestId('team-name-away')).toHaveTextContent(NAME_50);
    expect(kopf).not.toHaveAttribute('data-gestapelt'); // am Laptop bleibt die Seite neben dem Namen (Mockup `lang-haupt-720`)
    expect(kopf).toHaveTextContent('Gast');
    expect(kopf.textContent).not.toContain('…');
  });
});
