/**
 * MS1 / K6 – Zweig „nächstes Spiel“ der Live-Folie (kein laufendes Spiel auf dem Feld) kürzt wie am Monitor
 * (@ZM-087, @ZM-149). Gegenbeispiel: ein Name ohne Listenwort bleibt voll.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings } from '../../../types/monitor';
import { buildTournament, slide } from './monitorFixture';
import { withView } from './monitorViewHelper';

const performanceSettings = {} as PerformanceSettings;
const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const OHNE_LISTENWORT = 'Eintracht Oberweiler-Niederstetten 1919';

describe('@ZM-087 Live-Folie, nächstes Spiel (kein laufendes Spiel auf Feld 2)', () => {
  it('Listenwort wird gekürzt: „SG FF Nordheim-Süd 1921“ in der Namenszelle, kein voller Name, kein „…“', () => {
    // Spiel 8 (Feld 2, geplant): DJK Berg (team-berg) – TuS Mitte (team-mitte)
    const basis = buildTournament();
    const tournament = {
      ...basis,
      teams: basis.teams.map(t => {
        if (t.id === 'team-berg') { return { ...t, name: VOLL }; }
        if (t.id === 'team-mitte') { return { ...t, name: OHNE_LISTENWORT }; }
        return t;
      }),
    };
    const { container } = render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-2' })}
        {...withView(tournament)}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText('SG FF Nordheim-Süd 1921')).toBeInTheDocument();
    expect(container.textContent).not.toContain(VOLL);
    expect(container.textContent).not.toContain('…');
  });

  it('Gegenbeispiel: „Eintracht Oberweiler-Niederstetten 1919“ bleibt voll in der Namenszelle', () => {
    const basis = buildTournament();
    const tournament = {
      ...basis,
      teams: basis.teams.map(t => (t.id === 'team-mitte' ? { ...t, name: OHNE_LISTENWORT } : t)),
    };
    render(
      <LiveSlide
        slide={slide('live', { fieldId: 'field-2' })}
        {...withView(tournament)}
        performanceSettings={performanceSettings}
        theme="dark"
        style={{}}
      />,
    );
    expect(screen.getByText(OHNE_LISTENWORT)).toBeInTheDocument();
  });
});
