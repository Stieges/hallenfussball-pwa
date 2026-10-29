/**
 * R5 PR 3, @HT-030: Im Assistenten (Schritt 2, Bereich Cockpit) lässt sich der gewählte Ton anhören.
 * Wie im Admin-Cockpit: „Anhören“ ruft `testPlay` des Ton-Bausteins. Es gibt zwei Knöpfe (am Ton und an der Lautstärke).
 * Gegenprobe: ohne Ton („Ton aus“) gibt es nur den Knopf am Ton-Auswahlfeld und keine Lautstärke.
 * Mutation: `onTestSound` aus Step2_ModeAndSystem entfernen → alle Knopf-Tests rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { ToastProvider } from '../../../components/ui/Toast';
import { Step2_ModeAndSystem } from '../Step2_ModeAndSystem';

const testPlay = vi.fn(() => Promise.resolve());
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: vi.fn(() => ({ testPlay, play: vi.fn(), stop: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, activate: vi.fn(), error: null })),
}));

function schritt2(soundEnabled: boolean) {
  const formData: Partial<Tournament> = {
    mode: 'classic',
    groupSystem: 'roundRobin',
    matchCockpitSettings: { soundEnabled, soundId: 'horn-2', soundVolume: 80 },
  } as Partial<Tournament>;
  render(
    <ToastProvider>
      <Step2_ModeAndSystem formData={formData} onUpdate={vi.fn()} onMovePlacementLogic={vi.fn()} onTogglePlacementLogic={vi.fn()} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText(/step2\.cockpitSection/));
}

describe('@HT-030 Wizard Schritt 2: Ton anhören', () => {
  beforeEach(() => testPlay.mockClear());

  it('zwei „Anhören“-Knöpfe, Klick spielt den gewählten Ton einmal', () => {
    schritt2(true);
    const knoepfe = [screen.getByTestId('settings-end-sound-listen'), screen.getByTestId('settings-volume-listen')];
    expect(knoepfe).toHaveLength(2);
    fireEvent.click(knoepfe[0]);
    expect(testPlay).toHaveBeenCalledTimes(1);
    fireEvent.click(knoepfe[1]);
    expect(testPlay).toHaveBeenCalledTimes(2);
  });

  it('Gegenprobe: bei „Ton aus“ bleibt nur der Knopf am Ton-Auswahlfeld', () => {
    schritt2(false);
    expect(screen.getByTestId('settings-end-sound-listen')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-volume-listen')).toBeNull();
  });
});
