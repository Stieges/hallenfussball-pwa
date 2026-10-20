/**
 * Paket TB-B, TB-6b (@W2A-059): `GroupTables` zeigt Hinweis und Marke nur in der App-Ansicht (`tieDisplay="app"`); in der
 * Ansicht für Zuschauer und Monitor (Vorgabe `public`) nie – auch dann nicht, wenn Aufrufer die Teile mitgeben. Die
 * Platzziffer mit Sprung (3, 3, 5) steht in beiden.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupTables } from '../GroupTables';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { nikolaus } from '../../../core/standings/__tests__/decisionTestKit';

vi.mock('../../ui/TeamAvatar', () => ({ TeamAvatar: () => null }));

const t = nikolaus();
const standings = calculateStandingsPerGroup(t);
const hint = () => <p data-testid="tie-hint-probe">Hinweis</p>;
const marker = (teamId: string) => (teamId === t.teams[2].id ? <i data-testid="tie-marker-probe">Marke</i> : null);

describe('GroupTables tieDisplay (@W2A-059)', () => {
  it('app: Hinweis über der Tabelle und Marke unter dem Teamnamen', () => {
    render(<GroupTables standings={standings} teams={t.teams} tieDisplay="app" renderTieHint={hint} renderTieMarker={marker} />);
    expect(screen.getByTestId('tie-hint-probe')).toBeInTheDocument();
    expect(screen.getAllByTestId('tie-marker-probe').length).toBeGreaterThan(0);
  });

  it('Handy (Review TB-6 A2): die Marke steht in einer eigenen Zeile über die volle Breite, nicht in der schmalen Teamspalte; Zeilen ohne Marke bekommen keine', () => {
    const { container } = render(<GroupTables standings={standings} teams={t.teams} tieDisplay="app" renderTieHint={hint} renderTieMarker={marker} />);
    const mobil = container.querySelector<HTMLElement>('.mobile-view')!;
    const zeilen = mobil.querySelectorAll('[data-testid="tie-marker-row"]');
    expect(zeilen).toHaveLength(1); // nur das Team mit Marke
    expect(zeilen[0].querySelector('td')?.getAttribute('colspan')).toBe('5');
    expect(zeilen[0].querySelector('[data-testid="tie-marker-probe"]')).not.toBeNull();
    // Gegenbeispiel: die Teamspalte (2. Zelle der Datenzeilen) trägt die Marke nicht
    const teamZellen = Array.from(mobil.querySelectorAll('tbody tr:not([data-testid="tie-marker-row"]) td:nth-child(2)'));
    expect(teamZellen.some((z) => z.querySelector('[data-testid="tie-marker-probe"]') !== null)).toBe(false);
  });

  it('Gegenbeispiel public (Vorgabe): selbst mit mitgegebenen Teilen erscheint nichts, die Platzziffern bleiben 3, 3, 5', () => {
    render(<GroupTables standings={standings} teams={t.teams} renderTieHint={hint} renderTieMarker={marker} />);
    expect(screen.queryByTestId('tie-hint-probe')).toBeNull();
    expect(screen.queryByTestId('tie-marker-probe')).toBeNull();
    const plaetze = screen.getAllByRole('row').map((r) => r.querySelector('td')?.textContent).filter(Boolean);
    expect(plaetze).toEqual(expect.arrayContaining(['3', '5']));
  });
});
