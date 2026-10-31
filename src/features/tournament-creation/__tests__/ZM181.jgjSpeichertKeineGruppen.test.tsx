/**
 * @ZM-181 / @ZM-177 / @ZM-170 (Befund C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN, Ursache N1): Der Assistent speichert bei „Jeder gegen jeden“
 * keine Standardgruppen A und B mehr; die Teams haben keine Gruppe, also darf es auch keine Gruppen im Turnier geben.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGroupsAndFieldsState } from '../hooks/useGroupsAndFieldsState';
import { createDefaultGroups } from '../../../utils/displayNames';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({ save: () => Promise.resolve(), get: () => Promise.resolve(null) }),
}));

import { useTournamentWizard } from '../../../hooks/useTournamentWizard';

const gruppenAufrufe = (onUpdate: ReturnType<typeof vi.fn>) => onUpdate.mock.calls.filter((call) => call[0] === 'groups').map((call) => call[1]);

describe('@ZM-181 Assistent: Jeder gegen jeden speichert keine Gruppen', () => {
  it('Schritt „Gruppen und Felder“ schreibt bei Jeder gegen jeden keine Gruppen ins Formular', () => {
    const onUpdate = vi.fn();
    renderHook(() => useGroupsAndFieldsState({ formData: { groupSystem: 'roundRobin', numberOfGroups: 2 } , onUpdate }));
    const aufrufe = gruppenAufrufe(onUpdate);
    expect(aufrufe.length).toBeGreaterThan(0);
    expect(aufrufe.every((wert) => wert === undefined)).toBe(true);
  });

  it('Gegenbeispiel: bei Gruppen + Finalrunde schreibt der Schritt die Gruppen A und B', () => {
    const onUpdate = vi.fn();
    renderHook(() => useGroupsAndFieldsState({ formData: { groupSystem: 'groupsAndFinals', numberOfGroups: 2 } , onUpdate }));
    expect(gruppenAufrufe(onUpdate).at(-1)).toEqual(createDefaultGroups(2));
  });

  it('Wechsel auf Jeder gegen jeden nimmt Gruppen und Gruppen der Teams aus dem Formular', () => {
    const { result } = renderHook(() => useTournamentWizard(undefined, () => Promise.resolve(false)));
    act(() => {
      result.current.updateForm('groupSystem', 'groupsAndFinals');
      result.current.updateForm('groups', createDefaultGroups(2));
      result.current.updateForm('teams', [{ id: 't1', name: 'FC Nord', group: 'A' }, { id: 't2', name: 'SV Süd', group: 'B' }]);
    });
    expect(result.current.formData.groups).toHaveLength(2);
    act(() => { result.current.updateForm('groupSystem', 'roundRobin'); });
    expect(result.current.formData.groups).toBeUndefined();
    expect(result.current.formData.teams?.every((team) => team.group === undefined)).toBe(true);
  });

  it('Gegenbeispiel: der Wechsel zurück auf Gruppen + Finalrunde ändert die Gruppen nicht selbst', () => {
    const { result } = renderHook(() => useTournamentWizard(undefined, () => Promise.resolve(false)));
    act(() => { result.current.updateForm('groupSystem', 'groupsAndFinals'); });
    expect(result.current.formData.groups).toBeUndefined();
  });
});
