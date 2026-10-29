/**
 * R5 PR 3, @HT-030: Im Assistenten (Schritt 2, Bereich Cockpit) lässt sich der gewählte Ton anhören.
 * Szenario: „Olli wählt für das Spielende ‚Hupe 2‘ und drückt ‚Anhören‘ → das Gerät spielt ‚Hupe 2‘ einmal.“
 * Der Test wählt im Auswahlfeld „horn-2“ (Zustand lebt im Wrapper wie im Assistenten) und prüft, dass der Ton-Baustein
 * danach mit genau diesem Ton geladen ist und „Anhören“ ihn einmal spielt. Gegenprobe: bei „Ton aus“ fehlt die Lautstärke.
 * Mutation: in Step2_ModeAndSystem `useMatchSound('horn-1', …)` fest verdrahten → Test rot; `onTestSound` entfernen → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';
import { useMatchSound } from '../../../hooks/useMatchSound';

const testPlay = vi.fn(() => Promise.resolve());
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: vi.fn(() => ({ testPlay, play: vi.fn(), stop: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, activate: vi.fn(), error: null })),
}));

function Wrapper({ soundEnabled }: { soundEnabled: boolean }) {
  const [formData, setFormData] = useState<Partial<Tournament>>({
    mode: 'classic',
    groupSystem: 'roundRobin',
    matchCockpitSettings: { soundEnabled, soundId: soundEnabled ? 'horn-1' : null, soundVolume: 80 },
  } as Partial<Tournament>);
  return (
    <ToastProvider>
      <Step2_ModeAndSystem
        formData={formData}
        onUpdate={(field, value) => setFormData((previous) => ({ ...previous, [field]: value }))}
        onMovePlacementLogic={vi.fn()}
        onTogglePlacementLogic={vi.fn()}
      />
    </ToastProvider>
  );
}

function schritt2(soundEnabled: boolean) {
  render(<Wrapper soundEnabled={soundEnabled} />);
  fireEvent.click(screen.getByText(/step2\.cockpitSection/));
}

describe('@HT-030 Wizard Schritt 2: Ton anhören', () => {
  beforeEach(() => { testPlay.mockClear(); vi.mocked(useMatchSound).mockClear(); });

  it('Hupe 2 wählen, „Anhören“ drücken: der Ton-Baustein ist auf horn-2 gestellt und spielt einmal', () => {
    schritt2(true);
    fireEvent.change(screen.getByTestId('settings-end-sound-select'), { target: { value: 'horn-2' } });
    const letzter = vi.mocked(useMatchSound).mock.calls.at(-1);
    expect(letzter?.slice(0, 3)).toEqual(['horn-2', 80, true]);
    fireEvent.click(screen.getByTestId('settings-end-sound-listen'));
    expect(testPlay).toHaveBeenCalledTimes(1);
  });

  it('der zweite „Anhören“-Knopf (Lautstärke) spielt ebenfalls', () => {
    schritt2(true);
    fireEvent.click(screen.getByTestId('settings-volume-listen'));
    expect(testPlay).toHaveBeenCalledTimes(1);
  });

  it('Gegenprobe: bei „Ton aus“ gibt es keine Lautstärke-Zeile', () => {
    schritt2(false);
    expect(screen.queryByTestId('settings-volume-listen')).toBeNull();
  });
});
