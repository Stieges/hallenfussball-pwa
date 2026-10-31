/**
 * Usability F (Handy) im Assistenten und in der Verwaltung (Prüfbericht 2026-10-30): F-06, F-07, F-08, F-09, F-10.
 * Szenarien: @OB-022 (Tippflächen ≥ 44, Eingabeschrift ≥ 16, Haupttaste ≥ 56). Jeder Schritt des Assistenten ist eine eigene
 * Instanz (Schritt 1 Stammdaten, 3 Modus mit Smart-Konfiguration und Finalrunde, 5 Teams) und wird einzeln geprüft.
 * jsdom misst keine Pixel; geprüft werden die gesetzten Token-Stile. Die echten Maße (Schritt 3 und 5, 360 und 390) misst
 * tests/e2e/usability-f-handy.spec.ts, dazu `npm run visual:metrics` (Ansichten wizard-neu-1 bis -6).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cssVars } from '../../../design-tokens';
import type { PlacementCriterion } from '../../../types/tournament';
import { FinalsConfiguration } from '../components/FinalsConfiguration';
import { PlacementLogicEditor } from '../components/PlacementLogicEditor';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { LocationForm } from '../../../components/LocationForm';
import { ContactForm } from '../../../components/ContactForm';
import { TournamentFooter } from '../../../components/schedule/TournamentFooter';

vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ tournaments: [] }) }));

const MIN = cssVars.touchTargets.minimum;

describe('F-07 Schritt 5: Gruppenwahl und Teamliste', () => {
  it('@OB-022 Farbauswahl: jede Voreinstellung ist als Taste mindestens 44 × 44', () => {
    render(<ColorPicker label="Trikot" value="#FF0000" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /FF0000/i }));
    const farben = screen.getAllByRole('option');
    expect(farben.length).toBeGreaterThan(4);
    for (const f of farben) {
      expect(f.style.minHeight).toBe(MIN);
      expect(f.style.minWidth).toBe(MIN);
    }
  });
});

describe('F-07 Schritt 1: Erweiterte Adressdaten und Kontaktdaten', () => {
  it('@OB-022 „Erweiterte Adressdaten“ und „Kontaktdaten“ sind mindestens 44 hoch', () => {
    const { container } = render(
      <div>
        <LocationForm value={{ name: '' }} onChange={vi.fn()} />
        <ContactForm value={{}} onChange={vi.fn()} />
      </div>,
    );
    const umschalter = Array.from(container.querySelectorAll('button'));
    expect(umschalter).toHaveLength(2);
    for (const u of umschalter) { expect(u.style.minHeight).toBe(MIN); }
  });
});

describe('F-08 Schritt 3: kleine Bedienelemente', () => {
  const kriterien: PlacementCriterion[] = [
    { id: 'points', enabled: true },
    { id: 'goalDifference', enabled: true },
    { id: 'goalsFor', enabled: false },
  ] as PlacementCriterion[];

  it('@OB-022 Reihenfolge-Pfeile, Griff und „Kriterium deaktivieren“ sind mindestens 44 × 44', () => {
    render(<PlacementLogicEditor placementLogic={kriterien} onMove={vi.fn()} onToggle={vi.fn()} onReorder={vi.fn()} />);
    const knoepfe = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== null);
    expect(knoepfe.length).toBeGreaterThanOrEqual(9);
    for (const k of knoepfe) {
      expect(k.style.minHeight, k.getAttribute('aria-label') ?? '').toBe(MIN);
      expect(k.style.minWidth, k.getAttribute('aria-label') ?? '').toBe(MIN);
    }
  });

  it('@OB-022 Finalrunde: jede Zeile mit Auswahlknopf oder Häkchen ist mindestens 44 hoch, Dauerfeld ≥ 16 px', () => {
    render(
      <FinalsConfiguration
        formData={{ numberOfGroups: 4, numberOfFields: 2, finalsConfig: { preset: 'top-8', tiebreaker: 'goldenGoal' } as never }}
        onUpdate={vi.fn()}
      />,
    );
    const zeilen = Array.from(document.querySelectorAll('label')).filter((l) => l.querySelector('input[type="checkbox"], input[name="tiebreaker"]'));
    expect(zeilen.length).toBeGreaterThanOrEqual(5);
    for (const z of zeilen) { expect(z.style.minHeight).toBe(MIN); }
    const dauer = document.querySelector<HTMLInputElement>('input[type="number"]');
    expect(dauer?.style.fontSize).toBe(cssVars.fontSizes.lg);
    expect(dauer?.style.minHeight).toBe(MIN);
  });
});

describe('F-09 Kontaktlinks der Turnierseite', () => {
  it('@OB-022 Kontaktlinks stehen in einer Liste und sind mindestens 44 hoch', () => {
    render(<TournamentFooter organizer="SV Nord" contactInfo={{ name: 'Olli', email: 'olli@example.org', phone: '0170 1234567', website: 'example.org' }} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const l of links) { expect(l.style.minHeight).toBe(MIN); }
  });
});
