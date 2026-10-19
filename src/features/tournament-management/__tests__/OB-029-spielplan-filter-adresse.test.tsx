/**
 * @OB-029 "Jede Seite lässt sich über ihren Link direkt öffnen" -- Teil Spielplan der Turnierleitung:
 * Gruppe, Phase und Feld stehen in der Adresse (`?g=B`, `?p=`, `?f=`), der Filter liest und
 * schreibt sie über useSearchParams. @OB-030: Neu laden behält die Auswahl (die Adresse trägt sie).
 * Verlauf: Zurück stellt den vorigen Filter wieder her (jede Änderung ist ein Verlaufseintrag; das Szenario
 * @OB-031 über besuchte Seiten prüft tests/e2e/flows/adresse-je-seite.spec.ts).
 * Echte Filterleiste (Desktop) + echter Hook + echte Filterfunktion; nur die Liste ist ein Platzhalter.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { Match, Team } from '../../../types/tournament';
import { getFilterOptions, useScheduleFilters } from '../hooks/useScheduleFilters';
import { ScheduleFilterBarDesktop } from '../components/schedule-filter/ScheduleFilterBarDesktop';

const m = (id: string, group: string | undefined, field: number, isFinal = false): Match =>
  ({ id, group, field, isFinal, phase: isFinal ? 'final' : 'groupStage', matchStatus: 'scheduled' }) as unknown as Match;

const MATCHES: Match[] = [
  m('a1', 'A', 1),
  m('a2', 'A', 2),
  m('b1', 'B', 1),
  m('b2', 'B', 2),
  m('fin', undefined, 1, true),
];
const TEAMS: Team[] = [];
const OPTIONS = getFilterOptions({ matches: MATCHES } as never);

function Harness() {
  const { filters, updateFilters, resetFilters, activeFilterCount, getFilteredMatches } = useScheduleFilters({
    filterOptions: OPTIONS,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const shown = getFilteredMatches(MATCHES, TEAMS).map((x) => x.id).join(',');
  return (
    <div>
      <ScheduleFilterBarDesktop
        filters={filters}
        onFilterChange={updateFilters}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
        filterOptions={OPTIONS}
      />
      <output data-testid="shown">{shown}</output>
      <output data-testid="search">{location.search}</output>
      <button type="button" data-testid="history-back" onClick={() => void navigate(-1)}>zurück</button>
    </div>
  );
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Harness />
    </MemoryRouter>
  );
const shown = () => screen.getByTestId('shown').textContent;
const search = () => new URLSearchParams(screen.getByTestId('search').textContent);
const pick = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('@OB-029 Spielplan der Turnierleitung: Filter in der Adresse', () => {
  it('@OB-029 Aufruf mit ?g=B zeigt nur Gruppe B (Finale ohne Gruppe bleibt, wie bisher)', () => {
    renderAt('/schedule?g=B');
    expect(screen.getByTestId('filter-group')).toHaveValue('B');
    expect(shown()).toBe('b1,b2,fin');
  });

  it('@OB-029 Aufruf mit ?p=finals&f=1 liest Phase und Feld', () => {
    renderAt('/schedule?p=finals&f=1');
    expect(screen.getByTestId('filter-phase')).toHaveValue('finals');
    expect(screen.getByTestId('filter-field')).toHaveValue('1');
    expect(shown()).toBe('fin');
  });

  it('@OB-029 Gruppe wählen schreibt ?g= in die Adresse', () => {
    renderAt('/schedule');
    pick('filter-group', 'B');
    expect(search().get('g')).toBe('B');
  });

  it('@OB-029 Phase und Feld wählen schreiben ?p= und ?f=; Gruppe bleibt erhalten', () => {
    renderAt('/schedule?g=B');
    pick('filter-field', '2');
    pick('filter-phase', 'groupStage');
    expect(search().get('g')).toBe('B');
    expect(search().get('f')).toBe('2');
    expect(search().get('p')).toBe('groupStage');
    expect(shown()).toBe('b2');
  });

  it('@OB-029 Zurücksetzen entfernt die Filter aus der Adresse', () => {
    renderAt('/schedule?g=B&f=2');
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(screen.getByTestId('search').textContent).toBe('');
    expect(shown()).toBe('a1,a2,b1,b2,fin');
  });

  it('Zurück-Taste stellt den vorigen Filter wieder her (Verlauf der Filter)', () => {
    renderAt('/schedule');
    pick('filter-group', 'B');
    pick('filter-field', '2');
    expect(shown()).toBe('b2');
    fireEvent.click(screen.getByTestId('history-back'));
    expect(screen.getByTestId('filter-group')).toHaveValue('B');
    expect(screen.getByTestId('filter-field')).toHaveValue('');
    expect(shown()).toBe('b1,b2,fin');
    fireEvent.click(screen.getByTestId('history-back'));
    expect(screen.getByTestId('filter-group')).toHaveValue('');
    expect(shown()).toBe('a1,a2,b1,b2,fin');
  });

  it('@OB-029 Gegenbeispiel: unbekannte Gruppe wird ignoriert, alles bleibt sichtbar, kein Absturz', () => {
    renderAt('/schedule?g=ZZ');
    expect(screen.getByTestId('filter-group')).toHaveValue('');
    expect(shown()).toBe('a1,a2,b1,b2,fin');
  });

  it('@OB-029 Gegenbeispiel: unbekannte Phase und Feld (kein Zahlenwert, nicht vorhanden) werden ignoriert', () => {
    renderAt('/schedule?p=halbfinale&f=abc');
    expect(screen.getByTestId('filter-phase')).toHaveValue('');
    expect(screen.getByTestId('filter-field')).toHaveValue('');
    expect(shown()).toBe('a1,a2,b1,b2,fin');
  });

  it('@OB-029 Gegenbeispiel: ein Feld, das es im Turnier nicht gibt (?f=9), wird ignoriert', () => {
    renderAt('/schedule?f=9');
    expect(screen.getByTestId('filter-field')).toHaveValue('');
    expect(shown()).toBe('a1,a2,b1,b2,fin');
  });
});
