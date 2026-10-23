/**
 * Match-Cockpit-Einstellungen: jedes Bedienelement hat einen Namen und seine Mindestgröße
 * (C-MATCHCOCKPIT-EINSTELLUNGEN-HART).
 * @OB-022: Jede Taste und jedes andere Bedienelement ist mindestens 44 Bildpunkte groß, jedes Eingabefeld hat
 * mindestens 16 Bildpunkte Schriftgröße. Dazu die Regel „barrierefrei nach Stufe AA“ (Zone C in
 * docs/anforderungen/2026-10-02_oberflaeche.md): ein Auswahl- oder Eingabefeld ohne Namen ist ein Verstoß.
 * jsdom misst keine Pixel; geprüft werden hier die gesetzten Größen (Token oder Pixelwert) und die Namen.
 * Die echte Messung ist `npm run visual:metrics` (Ansicht admin-match-cockpit-regeln).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { MatchCockpitSettingsPanel } from '../MatchCockpitSettingsPanel';

type Settings = ComponentProps<typeof MatchCockpitSettingsPanel>['settings'];

const EINSTELLUNGEN = {
  hapticEnabled: false, timerDirection: 'countdown', soundEnabled: true, soundId: 'horn-1', soundVolume: 50,
  hasCustomSound: true, timePenaltyDurationSeconds: 120, penaltyShootersPerTeam: 3,
} as Settings;

function zeige(onTestSound = vi.fn()) {
  const view = render(
    <MatchCockpitSettingsPanel settings={EINSTELLUNGEN} onChange={vi.fn()} tournamentId="t1" onTestSound={onTestSound} />
  );
  return { ...view, onTestSound };
}

/** Gesetzte Größe: Token (`var(--touch-target-…)`, `var(--input-height-md|lg)`) oder Pixelwert ab 44. */
function istMindestens44(el: HTMLElement, eigenschaft: 'height' | 'minHeight'): boolean {
  const wert = el.style[eigenschaft];
  if (/^var\(--(touch-target-(minimum|comfortable|primary)|input-height-(md|lg))\)$/.test(wert)) { return true; }
  return /^\d+(\.\d+)?px$/.test(wert) && parseFloat(wert) >= 44;
}

function istMindestens16(el: HTMLElement): boolean {
  const wert = el.style.fontSize;
  return /^var\(--font-size-(lg|xl|xxl|xxxl)\)$/.test(wert) || (/^\d+(\.\d+)?px$/.test(wert) && parseFloat(wert) >= 16);
}

describe('Match-Cockpit-Einstellungen: Namen und Mindestgrößen (C-MATCHCOCKPIT-EINSTELLUNGEN-HART)', () => {
  it('@OB-022 jede Auswahl und jedes Eingabefeld hat einen Namen', () => {
    zeige();
    expect(screen.getByRole('combobox', { name: /Zeitanzeige|Timer/i })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Dauer.*Zeitstrafe|Zeitstrafe/i })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Sound/i })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: /Sch(ü|ue)tzen/i })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Lautst/i })).toBeTruthy();
  });

  it('@OB-022 Auswahlfelder sind mindestens 44 hoch und haben mindestens 16 Schriftgröße', () => {
    const { container } = zeige();
    const auswahl = Array.from(container.querySelectorAll('select'));
    expect(auswahl.length).toBeGreaterThanOrEqual(3);
    for (const feld of auswahl) {
      expect(istMindestens44(feld, 'height'), `Höhe ${feld.style.height}`).toBe(true);
      expect(istMindestens16(feld), `Schrift ${feld.style.fontSize}`).toBe(true);
    }
  });

  it('@OB-021 schmale Anzeige: Auswahlfelder und Bedienbereich laufen nie über die Karte hinaus', () => {
    const { container } = zeige();
    for (const feld of Array.from(container.querySelectorAll('select'))) {
      expect(feld.style.maxWidth).toBe('100%');
      expect(feld.style.minWidth).toMatch(/^min\(\d+px, 100%\)$/);
      expect((feld.parentElement!).style.flexWrap, 'Zeile mit Auswahl und Taste darf umbrechen').not.toBe('nowrap');
    }
    for (const bereich of Array.from(container.querySelectorAll<HTMLElement>('select')).map((f) => f.closest<HTMLElement>('div[style*="flex-shrink"]')!)) {
      expect(bereich.style.maxWidth).toBe('100%');
    }
  });

  it('@OB-022 Tasten, Schieberegler und Schalter sind mindestens 44 hoch', () => {
    const { container } = zeige();
    const bedienelemente = [
      ...Array.from(container.querySelectorAll('button')),
      ...Array.from(container.querySelectorAll<HTMLElement>('input[type="range"]')),
    ];
    // Schalter Vibration, Test (▶), Stummschalten, Test, Hochladen, Löschen
    expect(bedienelemente.length).toBeGreaterThanOrEqual(6);
    for (const element of bedienelemente) {
      const ok = istMindestens44(element, 'height') || istMindestens44(element, 'minHeight');
      expect(ok, `${element.outerHTML.slice(0, 80)} -> Höhe ${element.style.height} / min ${element.style.minHeight}`).toBe(true);
    }
  });

  it('@OB-022 Eingabefelder (Schieberegler, Schützenzahl) haben mindestens 16 Schriftgröße', () => {
    const { container } = zeige();
    for (const feld of Array.from(container.querySelectorAll<HTMLElement>('input:not([type="file"])'))) {
      expect(istMindestens16(feld), `${feld.getAttribute('type')} Schrift ${feld.style.fontSize}`).toBe(true);
    }
  });

  it('@OB-022 Gegenbeispiel: die Tasten wirken weiter (Test spielt den Ton, Hochladen öffnet die Dateiauswahl, Stumm setzt 0)', () => {
    const onChange = vi.fn();
    const onTestSound = vi.fn();
    const klick = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<MatchCockpitSettingsPanel settings={EINSTELLUNGEN} onChange={onChange} tournamentId="t1" onTestSound={onTestSound} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(onTestSound).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Hochladen|Upload/i }));
    expect(klick).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Stumm|Ton aus|Mute/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ soundVolume: 0 }));
    klick.mockRestore();
  });
});
