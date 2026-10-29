/**
 * R5 PR 3, @W3-039: Im Assistenten (Schritt 4) steht je Team ein beschrifteter Knopf „Farbe & Logo“; nach der Wahl von
 * Schwarz zeigt die Team-Zeile einen schwarzen Farbpunkt. Der Knopf trägt `aria-expanded` und ist mindestens 44 px hoch.
 * Gegenprobe: ohne Farbe kein Punkt. Mutation: Farbe nicht an den Knopf geben → Punkt-Test rot; Beschriftung entfernen → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Team, Tournament } from '../../../types/tournament';
import { Step4_Teams } from '../Step4_Teams';
import { TeamDetailsToggle } from '../../../components/ui/molecules/TeamDetailsToggle';
import de from '../../../i18n/locales/de/wizard.json';

const formData = (teams: Team[]): Tournament => ({ teams, numberOfTeams: 2, numberOfGroups: 1, groupSystem: 'roundRobin' }) as unknown as Tournament;
const noop = vi.fn();
const zeige = (teams: Team[]) => render(
  <Step4_Teams formData={formData(teams)} onUpdate={noop} onAddTeam={noop} onRemoveTeam={noop} onUpdateTeam={noop} />,
);

describe('@W3-039 Wizard Schritt 4: Farbe & Logo', () => {
  it('Wortlaut des Knopfes: „Farbe & Logo“', () => {
    expect(de.step4.expandLabel).toBe('Farbe & Logo');
  });

  it('je Team ein beschrifteter Knopf mit sichtbarem Text, aria-expanded klappt auf', () => {
    zeige([{ id: 't1', name: 'SV Süd' }, { id: 't2', name: 'TSV West' }]);
    const knopf = screen.getByTestId('wizard-team-details-t1');
    expect(knopf).toHaveTextContent('step4.expandLabel');
    expect(screen.getByTestId('wizard-team-details-t2')).toHaveTextContent('step4.expandLabel');
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(knopf);
    expect(knopf).toHaveAttribute('aria-expanded', 'true');
  });

  it('nach Schwarz zeigt die Team-Zeile einen schwarzen Farbpunkt, ohne Farbe keinen', () => {
    zeige([{ id: 't1', name: 'SV Süd', colors: { primary: '#000000' } }, { id: 't2', name: 'TSV West' }]);
    expect(screen.getByTestId('wizard-team-details-t1-dot')).toHaveStyle({ backgroundColor: '#000000' });
    expect(screen.queryByTestId('wizard-team-details-t2-dot')).toBeNull();
  });
});

describe('TeamDetailsToggle (Molekül)', () => {
  it('Tippfläche mindestens 44 px (Token) und Zustand über aria-expanded', () => {
    render(<TeamDetailsToggle label="Farbe & Logo" expanded onToggle={noop} color="#ff0000" data-testid="x" />);
    expect(screen.getByTestId('x').style.minHeight).toContain('touch-target-minimum');
    expect(screen.getByTestId('x')).toHaveAttribute('aria-expanded', 'true');
  });
});
