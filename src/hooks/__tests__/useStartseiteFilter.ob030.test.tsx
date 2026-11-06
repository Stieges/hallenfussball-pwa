/**
 * @OB-030 Neu laden oder ein geteilter Link behält die Auswahl: die Startseite mit der Suche „F1“ und dem Filter „Läuft“
 * (docs/anforderungen/2026-10-02_oberflaeche.md, Grundriss „Neu laden oder ein geteilter Link behält Seite und Auswahl“).
 * Befund C-FILTER-AKTIV-UNSICHTBAR (Suche und Filter gingen beim Neuladen verloren). Die Auswahl steht in der Adresse (`?q=`, `?s=`).
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useStartseiteFilter } from '../useStartseiteFilter';

const wrapper = (eintrag: string) => ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={[eintrag]}>{children}</MemoryRouter>
);
function mitAdresse(eintrag: string) {
  return renderHook(() => ({ filter: useStartseiteFilter(), ort: useLocation(), navigate: useNavigate() }), { wrapper: wrapper(eintrag) });
}

describe('@OB-030 Suche und Filter der Startseite stehen in der Adresse', () => {
  it('ein geteilter Link /?q=F1&s=running setzt Suche „F1“ und Filter „Läuft“', () => {
    const { result } = mitAdresse('/?q=F1&s=running');
    expect(result.current.filter.searchQuery).toBe('F1');
    expect(result.current.filter.activeFilters).toEqual(['running']);
  });

  it('Tippen schreibt die Suche in die Adresse, Leeren nimmt sie wieder heraus', () => {
    const { result } = mitAdresse('/');
    act(() => result.current.filter.setSearchQuery('F1'));
    expect(result.current.ort.search).toBe('?q=F1');
    expect(result.current.filter.searchQuery).toBe('F1');
    act(() => result.current.filter.setSearchQuery(''));
    expect(result.current.ort.search).toBe('');
  });

  it('ein Filter lässt sich setzen und wieder lösen; mehrere stehen kommagetrennt, Suche bleibt dabei erhalten', () => {
    const { result } = mitAdresse('/?q=F1');
    act(() => result.current.filter.toggleFilter('running'));
    act(() => result.current.filter.toggleFilter('draft'));
    expect(result.current.ort.search).toBe('?q=F1&s=running%2Cdraft');
    expect(result.current.filter.activeFilters).toEqual(['running', 'draft']);
    act(() => result.current.filter.toggleFilter('running'));
    expect(result.current.filter.activeFilters).toEqual(['draft']);
    act(() => result.current.filter.toggleFilter('draft'));
    expect(result.current.ort.search).toBe('?q=F1');
  });

  it('Gegenbeispiel: der alte Link mit dem entfernten Filter „finished“ setzt keinen Filter', () => {
    const { result } = mitAdresse('/?s=finished');
    expect(result.current.filter.activeFilters).toEqual([]);
  });

  it('@OB-031 Zurück geht einen Filter zurück; Tippen in der Suche ist kein eigener Schritt', () => {
    const { result } = mitAdresse('/');
    act(() => result.current.filter.toggleFilter('running'));
    act(() => result.current.filter.toggleFilter('draft'));
    act(() => result.current.filter.setSearchQuery('F'));
    act(() => result.current.filter.setSearchQuery('F1'));
    expect(result.current.ort.search).toBe('?s=running%2Cdraft&q=F1');
    // ein Schritt zurück: die Suche (ersetzt) ist kein Schritt, der letzte Filter schon
    act(() => { void result.current.navigate(-1); });
    expect(result.current.filter.activeFilters).toEqual(['running']);
    act(() => { void result.current.navigate(-1); });
    expect(result.current.filter.activeFilters).toEqual([]);
    expect(result.current.ort.search).toBe('');
  });
});
