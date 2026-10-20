/**
 * NextMatchArea (Plan LT-3): Zeile „Nächstes“ mit Trikotfarben, Leibchen-Zeichen und Vorwarnung ab 3:00, echte deutsche Texte.
 * Szenarien: @SL-160, @SL-161, @SL-155, @SL-156, Befunde C-COCKPIT-NAECHSTES-WIE-FEHLER, C-COCKPIT-VORWARNUNG-VERLOREN.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { NextMatchArea } from '../areas/NextMatchArea';
import type { MatchSummary } from '../types';
import type { CockpitPhase, CockpitZustand } from '../model/cockpitPhase';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

afterEach(() => { vi.unstubAllGlobals(); });

const phase = (zustand: CockpitZustand = 'laeuft'): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 2, abschnitte: 2, letzterAbschnitt: true });
const spiel = (home: string | null, away: string | null, id = 'm13'): MatchSummary => ({
  id, number: 13, phaseLabel: 'Gruppe', scheduledKickoff: '15:15', fieldId: 'field-1', homeTeam: { id: 'w', name: 'TSV West' }, awayTeam: { id: 'm', name: 'SG Mitte' },
  farben: { home, away },
});
const zeige = (naechstes: MatchSummary | null, rest: number | null = 300_000, z: CockpitZustand = 'laeuft') =>
  render(<NextMatchArea naechstes={naechstes} phase={phase(z)} restSpielMs={rest} />);
const zeile = () => screen.getByTestId('cockpit-naechstes');

describe('NextMatchArea – Farben und Leibchen', () => {
  it('@SL-160 Rot #C62828 / Weiß #FFFFFF → zwei Farbpunkte, kein Leibchen-Zeichen (Abstand 50,8)', () => {
    zeige(spiel('#C62828', '#FFFFFF'));
    expect(zeile()).toHaveTextContent('Nächstes: Spiel 13 · TSV West – SG Mitte · Anstoß 15:15');
    expect(screen.getByTestId('cockpit-naechstes-punkt-0')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-naechstes-punkt-1')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-naechstes-leibchen')).toBeNull();
  });

  it('@SL-160 Blau #1565C0 / Navy #0D1B4C → Leibchen-Zeichen ohne Text (Abstand 26,8, unter 30)', () => {
    zeige(spiel('#1565C0', '#0D1B4C'));
    expect(screen.getByRole('img', { name: 'Leibchen nötig, die Farben sind zu ähnlich' })).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-naechstes-leibchen')).toHaveTextContent('');
  });

  it('@SL-161 Rot / keine Farbe → ein Farbpunkt, der Name von SG Mitte steht da, kein Leibchen-Zeichen', () => {
    zeige(spiel('#C62828', null));
    expect(screen.getByTestId('cockpit-naechstes-punkt-0')).toBeInTheDocument();
    expect(screen.queryByTestId('cockpit-naechstes-punkt-1')).toBeNull();
    expect(zeile()).toHaveTextContent('SG Mitte');
    expect(screen.queryByTestId('cockpit-naechstes-leibchen')).toBeNull();
  });

  it('Gegenbeispiel: ohne nächstes Spiel keine Zeile', () => {
    zeige(null);
    expect(screen.queryByTestId('cockpit-naechstes')).toBeNull();
  });

  it('C-COCKPIT-NAECHSTES-WIE-FEHLER die Zeile trägt keine Fehlerfarbe', () => {
    zeige(spiel('#C62828', '#FFFFFF'));
    expect(zeile().getAttribute('style') ?? '').not.toContain('--color-error');
  });
});

describe('NextMatchArea – Vorwarnung ab 3:00', () => {
  it('@SL-155 bei 3:00 ist der Rahmen hervorgehoben und blinkt einmal, ohne zusätzlichen Hinweistext', () => {
    const vor = zeige(spiel('#C62828', '#FFFFFF'), 300_000);
    const textVorher = zeile().textContent;
    expect(zeile()).toHaveAttribute('data-modus', 'normal');
    vor.rerender(<NextMatchArea naechstes={spiel('#C62828', '#FFFFFF')} phase={phase()} restSpielMs={180_000} />);
    expect(zeile()).toHaveAttribute('data-modus', 'vorwarnung');
    expect(zeile()).toHaveAttribute('data-blinken', 'true');
    expect(zeile().textContent).toBe(textVorher);
  });

  it('@SL-155 die Hervorhebung bleibt danach stehen (Restzeit 2:30), das Blinken wird nicht erneut ausgelöst', () => {
    const m = spiel('#C62828', '#FFFFFF');
    const vor = zeige(m, 180_000);
    expect(zeile()).toHaveAttribute('data-blinken', 'true');
    vor.rerender(<NextMatchArea naechstes={m} phase={phase()} restSpielMs={150_000} />);
    expect(zeile()).toHaveAttribute('data-modus', 'vorwarnung');
  });

  it('@SL-156 bei 3:01 ist die Zeile nicht hervorgehoben', () => {
    zeige(spiel('#C62828', '#FFFFFF'), 181_000);
    expect(zeile()).toHaveAttribute('data-modus', 'normal');
    expect(zeile()).not.toHaveAttribute('data-blinken');
  });

  it('@SL-156 „Bewegung reduzieren“: ab 3:00 hervorgehoben, ohne zu blinken', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    zeige(spiel('#C62828', '#FFFFFF'), 170_000);
    expect(zeile()).toHaveAttribute('data-modus', 'vorwarnung');
    expect(zeile()).not.toHaveAttribute('data-blinken');
  });

  it('Gegenbeispiel: in der Halbzeitpause ist die Zeile nicht hervorgehoben, auch bei kleiner Restzeit', () => {
    zeige(spiel('#C62828', '#FFFFFF'), 100_000, 'halbzeitpause');
    expect(zeile()).toHaveAttribute('data-modus', 'normal');
  });

  it('@SL-155 ein neues nächstes Spiel blinkt beim Aktivwerden wieder (je Spiel einmal)', () => {
    const vor = zeige(spiel('#C62828', '#FFFFFF', 'a'), 170_000);
    expect(zeile()).toHaveAttribute('data-blinken', 'true');
    vor.rerender(<NextMatchArea naechstes={spiel('#C62828', '#FFFFFF', 'b')} phase={phase()} restSpielMs={170_000} />);
    expect(zeile()).toHaveAttribute('data-blinken', 'true');
  });
});
