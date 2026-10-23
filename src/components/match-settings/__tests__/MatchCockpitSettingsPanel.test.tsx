/**
 * MatchCockpitSettingsPanel — Verhalten der in B-03 geänderten Datei.
 *
 * B-03 hat die Platzhalter „Netto-Zeit-Warnung“, „Verzögerung“ und
 * „Bildschirm an lassen“ ausgeblendet. Hier ist gesichert, dass die
 * verbleibenden Einstellungen weiterhin wirken (Umschalten ruft onChange
 * mit dem neuen Wert auf).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MatchCockpitSettingsPanel } from '../MatchCockpitSettingsPanel';

type Settings = ComponentProps<typeof MatchCockpitSettingsPanel>['settings'];

function renderPanel(onChange = vi.fn()) {
  const view = render(
    <MatchCockpitSettingsPanel
      settings={{ hapticEnabled: false, timerDirection: 'elapsed' } as Settings}
      onChange={onChange}
      tournamentId="t1"
    />
  );
  return { ...view, onChange };
}

describe('MatchCockpitSettingsPanel — verbleibende Einstellungen wirken', () => {
  it('Vibration umschalten ruft onChange mit hapticEnabled=true auf', () => {
    const { onChange } = renderPanel();
    const toggle = screen.getByRole('switch', { name: /enableVibration/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hapticEnabled: true }));
  });

  it('Zeitrichtung wechseln ruft onChange mit dem gewählten Wert auf', () => {
    const { onChange, container } = renderPanel();
    const select = Array.from(container.querySelectorAll('select')).find((candidate) =>
      Array.from(candidate.options).some((option) => option.value === 'countdown')
    );
    expect(select).toBeTruthy();

    fireEvent.change(select!, { target: { value: 'countdown' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timerDirection: 'countdown' }));
  });

  it('@SL-005 @SL-009 Einstellung „Spiel automatisch beenden“ wird nicht angeboten, Ton und Vibration stehen weiter da', () => {
    const { container } = renderPanel();
    expect(screen.queryByRole('switch', { name: /enableAutoEnd|automatisch beenden|Auto-Beenden/i })).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/autoEnd|afterMatch|Auto-Beenden|automatisch beenden|Nach Spielende/i);
    expect(screen.getByRole('switch', { name: /enableVibration/ })).toBeInTheDocument();
  });
});
