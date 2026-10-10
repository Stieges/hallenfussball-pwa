/**
 * B-04 Paket d – @W2A-034: Ungültiger Regelwert.
 *
 * Gegeben die Turnierleitung gibt ein Punkteschema mit negativen Punkten
 * oder 0 Schützen (Strafstoßschießen-Schützenzahl) ein
 * Wenn sie die Eingabe verlässt
 * Dann nennt die App am Feld den gültigen Bereich und übernimmt den Wert nicht
 *
 * Echter Bedienweg (blur): Oberfläche → Logik → Speichern.
 * UI-Orte:
 *  - src/features/tournament-creation/components/PointSystemPicker.tsx
 *    (Punkteschema, Felder `point-system-win/-draw/-loss`)
 *  - src/components/match-cockpit/MatchCockpitSettingsPanel.tsx
 *    (Schützenzahl, Feld `settings-penalty-shooters`)
 * Beim Verlassen des Feldes (onBlur) prüft die App den Wert: ungültig →
 * Hinweis mit dem gültigen Bereich am Feld (i18n DE/EN), der Wert wird nicht
 * übernommen. Gegenbeispiel: ein gültiger Wert wird übernommen.
 *
 * Mutation: die Prüfung entfernen → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PointSystemPicker } from '../components/PointSystemPicker';
import { MatchCockpitSettingsPanel } from '../../../components/match-cockpit/MatchCockpitSettingsPanel';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type MatchCockpitSettings,
  type PointSystem,
} from '../../../types/tournament';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';
import deCockpit from '../../../i18n/locales/de/cockpit.json';
import enCockpit from '../../../i18n/locales/en/cockpit.json';

function punkteHarness(onUpdate: (system: PointSystem) => void, start: PointSystem) {
  function Harness() {
    const [punkte, setPunkte] = useState<PointSystem>(start);
    return (
      <PointSystemPicker
        formData={{ pointSystem: punkte }}
        onUpdate={(_field, value) => {
          const system = value as PointSystem;
          setPunkte(system);
          onUpdate(system);
        }}
      />
    );
  }
  return Harness;
}

function settingsHarness(onChange: (settings: MatchCockpitSettings) => void) {
  function Harness() {
    const [settings, setSettings] = useState<MatchCockpitSettings>(DEFAULT_MATCH_COCKPIT_SETTINGS);
    return (
      <MatchCockpitSettingsPanel
        settings={settings}
        tournamentId="t1"
        onChange={(next) => {
          setSettings(next);
          onChange(next);
        }}
      />
    );
  }
  return Harness;
}

describe('B-04d @W2A-034 – Ungültiger Regelwert wird abgelehnt', () => {
  it('Pflichttest: negatives Punkteschema zeigt am Feld den gültigen Bereich und wird nicht übernommen', () => {
    const onUpdate = vi.fn();
    // Individuelles Schema (kein Preset), damit die Eingabefelder sichtbar sind
    const PunkteHarness = punkteHarness(onUpdate, { win: 4, draw: 1, loss: 0 });
    render(<PunkteHarness />);

    const feld = screen.getByTestId('point-system-win');
    fireEvent.change(feld, { target: { value: '-5' } });
    fireEvent.blur(feld);

    expect(screen.getByRole('alert').textContent).toContain('pointSystem.custom.rangeError');
    expect(feld).toHaveAttribute('aria-invalid', 'true');
    // Wert nicht übernommen — das Punkteschema bleibt unverändert
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Pflichttest: 0 Schützen zeigt am Feld den gültigen Bereich und wird nicht übernommen', () => {
    const onChange = vi.fn();
    const SettingsHarness = settingsHarness(onChange);
    render(<SettingsHarness />);

    const feld = screen.getByTestId('settings-penalty-shooters');
    fireEvent.change(feld, { target: { value: '0' } });
    fireEvent.blur(feld);

    expect(screen.getByRole('alert').textContent).toContain('settings.penaltyShootersRangeError');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Pflichttest: 6 Schützen (über der Obergrenze 5) zeigt den Bereich und wird nicht übernommen', () => {
    const onChange = vi.fn();
    const SettingsHarness = settingsHarness(onChange);
    render(<SettingsHarness />);

    const feld = screen.getByTestId('settings-penalty-shooters');
    fireEvent.change(feld, { target: { value: '6' } });
    fireEvent.blur(feld);

    expect(screen.getByRole('alert').textContent).toContain('settings.penaltyShootersRangeError');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Pflichttest: Schützenzahl, die von außen geändert wird, steht im Feld und wird nicht mit dem alten Wert überschrieben', () => {
    const onChange = vi.fn();
    const settingsMit = (schuetzen: number): MatchCockpitSettings => ({
      ...DEFAULT_MATCH_COCKPIT_SETTINGS,
      penaltyShootersPerTeam: schuetzen,
    });
    const { rerender } = render(
      <MatchCockpitSettingsPanel settings={settingsMit(5)} tournamentId="t1" onChange={onChange} />
    );

    rerender(<MatchCockpitSettingsPanel settings={settingsMit(3)} tournamentId="t1" onChange={onChange} />);

    const feld = screen.getByTestId<HTMLInputElement>('settings-penalty-shooters');
    expect(feld.value).toBe('3');
    fireEvent.focus(feld);
    fireEvent.blur(feld);
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ penaltyShootersPerTeam: 5 }));
  });

  it('Gegenbeispiel: gültige Regelwerte werden übernommen', () => {
    const onUpdate = vi.fn();
    const PunkteHarness = punkteHarness(onUpdate, { win: 4, draw: 1, loss: 0 });
    render(<PunkteHarness />);

    const punkteFeld = screen.getByTestId('point-system-win');
    fireEvent.change(punkteFeld, { target: { value: '2.5' } });
    fireEvent.blur(punkteFeld);
    expect(onUpdate).toHaveBeenCalledWith({ win: 2.5, draw: 1, loss: 0 });
    expect(screen.queryByRole('alert')).toBeNull();

    const onChange = vi.fn();
    const SettingsHarness = settingsHarness(onChange);
    render(<SettingsHarness />);
    const schuetzenFeld = screen.getByTestId('settings-penalty-shooters');
    fireEvent.change(schuetzenFeld, { target: { value: '3' } });
    fireEvent.blur(schuetzenFeld);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ penaltyShootersPerTeam: 3 })
    );
    expect(schuetzenFeld).not.toHaveAttribute('aria-invalid');
  });

  it('Gegenbeispiel: 5 Schützen (Obergrenze) wird übernommen', () => {
    const onChange = vi.fn();
    const SettingsHarness = settingsHarness(onChange);
    render(<SettingsHarness />);

    const feld = screen.getByTestId('settings-penalty-shooters');
    fireEvent.change(feld, { target: { value: '5' } });
    fireEvent.blur(feld);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ penaltyShootersPerTeam: 5 }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Die Bereichs-Hinweise nennen die gültigen Grenzen in DE und EN', () => {
    const dePunkte = (deWizard as { pointSystem: { custom: { rangeError: string } } })
      .pointSystem.custom.rangeError;
    const enPunkte = (enWizard as { pointSystem: { custom: { rangeError: string } } })
      .pointSystem.custom.rangeError;
    const deSchuetzen = (deCockpit as { settings: { penaltyShootersRangeError: string } })
      .settings.penaltyShootersRangeError;
    const enSchuetzen = (enCockpit as { settings: { penaltyShootersRangeError: string } })
      .settings.penaltyShootersRangeError;

    for (const meldung of [dePunkte, enPunkte]) {
      expect(meldung).toContain('0');
      expect(meldung).toContain('99');
    }
    for (const meldung of [deSchuetzen, enSchuetzen]) {
      expect(meldung).toContain('1');
      expect(meldung).toContain('5');
      expect(meldung).not.toContain('10');
    }
  });
});
