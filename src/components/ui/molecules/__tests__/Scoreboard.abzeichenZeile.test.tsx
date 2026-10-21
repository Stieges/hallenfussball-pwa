/**
 * Scoreboard: „Ton aus“ und „N Einträge warten“ stehen gleichzeitig in der Abzeichenzeile, ohne sie zu brechen
 * (Befund C-TAFEL-TON-UND-WARTEND-BRECHEN-ZEILE, @SL-061 „Tafel springt nicht“, @OB-066 jedes Abzeichen trägt ein Wort).
 * Mit dem Ton-Abzeichen steht der Wartezähler kurz (Symbol und Zahl), der volle Wortlaut bleibt für Bildschirmleser;
 * ohne Ton-Abzeichen steht der volle Wortlaut sichtbar wie bisher. Die Höhe selbst misst der E2E-Fall in cockpit-laptop.spec.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scoreboard, type ScoreboardModel } from '../Scoreboard';

const model: ScoreboardModel = {
  badge: { kind: 'badge', state: 'live' }, links: { name: 'FC Nord', tore: 1 }, rechts: { name: 'SV Süd', tore: 0 },
  uhr: { rest: '2:48', gespielt: '3:12', label: 'Restzeit', unterzeile: 'Spielzeit 3:12', hervorgehoben: false, steht: false, schlussphase: false },
  abschnittText: '1. Halbzeit', hinweise: [],
  eintraegeWartenText: '3 Einträge warten', eintraegeWartenKurz: '3', helferAnfragenText: null, ariaStand: 'FC Nord 1, SV Süd 0',
};
const ton = { label: 'Ton für das Spielende ist aus – antippen zum Einschalten', kurz: 'Ton aus', onAntippen: vi.fn() };

describe('Scoreboard: Abzeichenzeile mit „Ton aus“ und wartenden Einträgen', () => {
  it('@SL-061 mit „Ton aus“ steht der Wartezähler kurz (Zahl), der volle Wortlaut steht nur für Bildschirmleser', () => {
    render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" tonHinweis={ton} />);
    const warten = screen.getByTestId('scoreboard-eintraege-warten');
    expect(warten.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent('3');
    expect(warten).toHaveTextContent('3 Einträge warten');
    expect(screen.getByRole('button', { name: ton.label })).toHaveTextContent('Ton aus');
  });

  it('@SL-061 Gegenbeispiel: ohne „Ton aus“ steht „3 Einträge warten“ sichtbar im vollen Wortlaut', () => {
    render(<Scoreboard model={model} size="compact" meldezeile={null} testId="scoreboard" />);
    const warten = screen.getByTestId('scoreboard-eintraege-warten');
    expect(warten.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
    expect(warten).toHaveTextContent('3 Einträge warten');
  });

  it('@SL-061 Gegenbeispiel: ohne Kurzform im Modell bleibt der volle Wortlaut auch mit „Ton aus“ sichtbar', () => {
    render(<Scoreboard model={{ ...model, eintraegeWartenKurz: null }} size="compact" meldezeile={null} testId="scoreboard" tonHinweis={ton} />);
    expect(screen.getByTestId('scoreboard-eintraege-warten').querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
  });
});
