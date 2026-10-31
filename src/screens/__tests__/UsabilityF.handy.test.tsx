/**
 * Usability F (Handy, Prüfbericht 2026-10-30): Maße und Umbruch an den Stellen F-01, F-02, F-03, F-06.
 * Szenarien: @OB-022 (Tippflächen ≥ 44, Haupttaste ≥ 56, Eingabeschrift ≥ 16, nichts verdeckt), @OB-025 (Namen nie mit „…“).
 * jsdom misst keine Pixel; geprüft werden die gesetzten Token-Stile, die echte Messung ist `npm run visual:metrics` (Handy-Profile).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { cssVars, touchTargets, layoutHeights } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';

vi.mock('../../features/auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => null }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
vi.mock('../../features/klaerungsliste/KlaerungslisteEinstieg', () => ({ KlaerungslisteEinstieg: () => null }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

const { ManagementHeader } = await import('../ManagementChrome');
const { Footer } = await import('../../components/layout/Footer');
const { SearchFilterBar } = await import('../../components/dashboard/SearchFilterBar');
const { ProgressBar } = await import('../../components/ProgressBar');

const LANGER_NAME = 'Hallencup der Jugendabteilungen Süd';
const tournament = { id: 'cup', title: LANGER_NAME, ageClass: 'E', date: '2026-11-28', teams: [], matches: [] } as unknown as Tournament;

describe('Token-Grundlage', () => {
  it('Tippfläche minimum = 44 px, Haupttaste = 56 px, untere Leiste = 56 px', () => {
    expect(touchTargets.minimum).toBe('44px');
    expect(touchTargets.primary).toBe('56px');
    expect(layoutHeights.bottomNav).toBe('56px');
  });
});

describe('F-01 Kopf der Turnierseite', () => {
  const kopf = () => render(
    <MemoryRouter>
      <ManagementHeader tournament={tournament} isMobile activeTab="schedule" isSettingsDirty={false} onTabChange={vi.fn()}
        onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
    </MemoryRouter>,
  );

  it('@OB-025 der Turniername wird nicht mit „…“ gekürzt, sondern bricht um', () => {
    kopf();
    const titel = screen.getByText(LANGER_NAME);
    expect(titel.style.textOverflow).not.toBe('ellipsis');
    expect(titel.style.whiteSpace).not.toBe('nowrap');
    expect(titel.style.hyphens).toBe('manual');
  });

  it('@OB-025 die Schrift des Titels wird stufenweise kleiner (clamp zwischen zwei Token-Stufen)', () => {
    kopf();
    const titel = screen.getByText(LANGER_NAME);
    expect(titel.style.fontSize).toContain('clamp(');
    expect(titel.style.fontSize).toContain(cssVars.fontSizes.lg);
    expect(titel.style.fontSize).toContain(cssVars.fontSizes.xxl);
  });

  it('@OB-025 reicht die Breite nicht, bricht der Kopf in eine zweite Zeile um, statt den Titel zu zerhacken', () => {
    kopf();
    const kopfzeile = screen.getByText(LANGER_NAME).closest('header')!;
    expect(kopfzeile.style.flexWrap).toBe('wrap');
    expect(screen.getByText(LANGER_NAME).parentElement!.style.flex).toBe('1 1 50%');
  });

  it('@OB-022 das Zahnrad ist mindestens 44 × 44 groß', () => {
    kopf();
    const zahnrad = screen.getByTitle('Admin Center öffnen');
    expect(zahnrad.style.minHeight).toBe(cssVars.touchTargets.minimum);
    expect(zahnrad.style.minWidth).toBe(cssVars.touchTargets.minimum);
  });
});

describe('F-02 Fußzeile und untere Leiste', () => {
  const fuss = (untereLeiste: boolean) => render(
    <MemoryRouter><Footer untereLeiste={untereLeiste} /></MemoryRouter>,
  ).container.querySelector('footer')!;

  it('@OB-022 mit unterer Leiste reserviert die Fußzeile Leistenhöhe plus Safe-Area unter den Rechtslinks', () => {
    const f = fuss(true);
    expect(f.style.paddingBottom).toContain(layoutHeights.bottomNav);
    expect(f.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(f.style.paddingBottom).toContain('--schedule-action-bar-h'); // schwebende Leiste „Teilen · Als PDF“ verdeckt die Links nicht
  });

  it('@OB-022 Gegenbeispiel: ohne untere Leiste bleibt der normale Abstand', () => {
    const f = fuss(false);
    expect(f.style.paddingBottom).not.toContain('safe-area-inset-bottom');
  });
});

describe('F-03 Suchfeld und Filter-Chips', () => {
  const leiste = () => render(
    <SearchFilterBar searchQuery="" onSearchChange={vi.fn()} activeFilters={[]} onFilterToggle={vi.fn()} />,
  );

  it('@OB-022 Suchfeld: Schrift mindestens 16 px und Höhe mindestens 44', () => {
    leiste();
    const feld = screen.getByTestId('search-input');
    expect(feld.style.fontSize).toBe(cssVars.fontSizes.lg);
    expect(feld.style.minHeight).toBe(cssVars.touchTargets.minimum);
  });

  it('@OB-022 jede Filter-Chip ist mindestens 44 hoch', () => {
    leiste();
    const chips = screen.getAllByTestId(/^filter-chip-/);
    expect(chips.length).toBeGreaterThan(2);
    for (const chip of chips) { expect(chip.style.minHeight).toBe(cssVars.touchTargets.minimum); }
  });
});

describe('F-06 Fußleiste des Assistenten am Handy', () => {
  it('@OB-022 Quelltext: die Leiste „Zurück · Weiter“ bleibt am Handy am unteren Fensterrand stehen (Haupttaste ohne Scrollen)', async () => {
    const { readFileSync } = await import('node:fs');
    const q = readFileSync(`${process.cwd()}/src/screens/TournamentCreationScreen.tsx`, 'utf8');
    const i = q.indexOf('data-testid="wizard-footer-bar"');
    const block = q.slice(q.lastIndexOf('style={isMobile ? {', i), i);
    expect(block).toContain("position: 'sticky'");
    expect(block).toContain('bottom: 0');
  });
});

describe('F-06 Schritt-Punkte des Assistenten', () => {
  it('@OB-022 jeder Schritt ist mindestens 44 × 44 groß, Schrift nicht unter 12 px', () => {
    render(<ProgressBar currentStep={2} totalSteps={6} stepLabels={['Stammdaten', 'Sportart', 'Modus', 'Gruppen & Felder', 'Teams', 'Übersicht']} />);
    const schritte = screen.getAllByRole('tab');
    expect(schritte).toHaveLength(6);
    for (const s of schritte) {
      expect(s.style.minHeight).toBe(cssVars.touchTargets.minimum);
      expect(s.style.minWidth).toBe(cssVars.touchTargets.minimum);
      expect(s.style.fontSize).toBe(cssVars.fontSizes.sm);
    }
  });

  it('die Reiter liegen in einer Reiterleiste (axe aria-required-parent)', () => {
    const { container } = render(<ProgressBar currentStep={1} totalSteps={6} stepLabels={['a', 'b', 'c', 'd', 'e', 'f']} />);
    expect(container.querySelector('[role="tablist"] [role="tab"]')).not.toBeNull();
  });
});
