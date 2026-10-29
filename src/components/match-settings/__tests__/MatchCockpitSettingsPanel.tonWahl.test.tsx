/**
 * MatchCockpitSettingsPanel — Wahl des Tons fürs Spielende (@HT-030, @HT-025).
 * Befund C-TON-AUS-ZU-HUPE-VERSCHLUCKT: Wechsel von „Ton aus“ auf eine Hupe
 * darf den Ton nicht aus lassen. Der Test bindet das Panel wie die Einbinder
 * ein (kontrolliert: onChange ersetzt die Einstellungen).
 */
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MatchCockpitSettingsPanel } from '../MatchCockpitSettingsPanel';

type Settings = ComponentProps<typeof MatchCockpitSettingsPanel>['settings'];

let aktuell: Settings;

function Einbindung({ start }: { start: Partial<Settings> }) {
  const [settings, setSettings] = useState<Settings>({
    hapticEnabled: false,
    timerDirection: 'elapsed',
    ...start,
  } as Settings);
  return (
    <MatchCockpitSettingsPanel
      settings={settings}
      onChange={(neu) => {
        aktuell = neu;
        setSettings(neu);
      }}
      tournamentId="t1"
    />
  );
}

function tonSelect(container: HTMLElement): HTMLSelectElement {
  const select = Array.from(container.querySelectorAll('select')).find((s) =>
    Array.from(s.options).some((o) => o.value === 'horn-2')
  );
  if (!select) {throw new Error('Ton-Auswahl nicht gefunden');}
  return select;
}

describe('@HT-030 Ton fürs Spielende wählen', () => {
  it('„Ton aus“ → „Hupe 2“: Ton ist an und Hupe 2 gewählt', () => {
    const { container } = render(<Einbindung start={{ soundEnabled: false, soundId: null }} />);
    fireEvent.change(tonSelect(container), { target: { value: 'horn-2' } });
    expect(aktuell.soundEnabled).toBe(true);
    expect(aktuell.soundId).toBe('horn-2');
  });

  it('Gegenbeispiel: „Hupe 2“ → „Ton aus“: Ton ist aus', () => {
    const { container } = render(<Einbindung start={{ soundEnabled: true, soundId: 'horn-2' }} />);
    fireEvent.change(tonSelect(container), { target: { value: 'none' } });
    expect(aktuell.soundEnabled).toBe(false);
    expect(aktuell.soundId).toBeNull();
  });
});
