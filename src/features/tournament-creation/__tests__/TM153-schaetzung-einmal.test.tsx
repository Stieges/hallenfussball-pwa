/**
 * @TM-153 / Review #423 N1: Die Schätzung „<n> Spiele · Ende ca.“ erzeugt den ganzen Spielplan. Sie läuft im Schritt
 * „Modus & Spielsystem“ genau einmal je Änderung eines Strukturfelds (für Zusammenfassung und Dauer gemeinsam) und
 * gar nicht bei Feldern, die den Plan nicht bestimmen.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { defaultPlacementLogic } from '../../../core/standings/placementDefaults';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast/ToastContext';
import { i18nWrapper } from '../../tournament-management/standings/__tests__/tieTestKit';
import * as generators from '../../../core/generators';

vi.unmock('i18next');
vi.unmock('react-i18next');

vi.mock('../../../core/generators', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../core/generators')>();
  return { ...original, generateFullSchedule: vi.fn(original.generateFullSchedule) };
});

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

const entwurf = (): Tournament => ({
  id: 'turnier-n1', title: 'Nikolaus-Turnier', date: '2030-12-06', startTime: '16:30', timeSlot: '16:30',
  location: { name: 'Halle' }, numberOfTeams: 6, numberOfGroups: 1, numberOfFields: 1, mode: 'classic',
  placementLogic: defaultPlacementLogic(), groupSystem: 'roundRobin', groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 0, teams: [], matches: [], status: 'draft', lastVisitedStep: 3,
}) as unknown as Tournament;

describe('@TM-153 Plan-Schätzung im Assistenten nur bei Strukturänderung', () => {
  it('@TM-153 je Rundenänderung genau ein erzeugter Plan, bei Titel oder Punkteschema keiner', async () => {
    const spy = vi.mocked(generators.generateFullSchedule);
    const Wrapper = await i18nWrapper('de');
    const wizard = renderHook(() => useTournamentWizard(entwurf(), () => Promise.resolve(false)));
    const props = () => ({
      formData: wizard.result.current.formData,
      onUpdate: wizard.result.current.updateForm,
      onMovePlacementLogic: wizard.result.current.movePlacementLogic,
      onTogglePlacementLogic: wizard.result.current.togglePlacementLogic,
    });
    const view = render(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
    const sync = () => view.rerender(<Wrapper><ToastProvider><Step2_ModeAndSystem {...props()} /></ToastProvider></Wrapper>);
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('15 Spiele · Ende ca. 19:00');

    spy.mockClear();
    fireEvent.click(screen.getByTestId('wizard-round-count-increase'));
    sync();
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('30 Spiele · Ende ca. 21:30');
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    act(() => { wizard.result.current.updateForm('title', 'Nikolaus-Turnier 2030'); });
    sync();
    act(() => { wizard.result.current.updateForm('pointSystem', { win: 2, draw: 1, loss: 0 }); });
    sync();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('wizard-round-summary')).toHaveTextContent('30 Spiele · Ende ca. 21:30');
  });
});
