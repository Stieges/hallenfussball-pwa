/**
 * TeamColumn (Scheibe 3, Aufgabe 3.3): Szenarien @SL-087, @SL-037, @SL-099, @SL-035, @SL-102, @SL-029, @SL-031, @SL-086, @SL-032,
 * @SL-023, @SL-093, @SL-030, @SL-092, @SL-089, @SL-111, @SL-094, @SL-018, @SL-025, @SL-026, @OB-025.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamColumn, type TeamColumnProps } from '../areas/TeamColumn';
import { NAME_50 } from './cockpitFixtures';
import type { TeamColumnModel } from '../model/toTeamColumnModel';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const ALLE_ARTEN = { yellow: true, yellowRed: true, red: true, timePenalty: true };
const model = (m: Partial<TeamColumnModel> = {}): TeamColumnModel => ({
  seite: 'away', teamId: 'sv-sued', name: 'SV Süd', farbe: null, fouls: { zaehlt: 3, grenze: 5 }, strafen: [], unterzahl: null,
  darfErgaenzen: false, gesperrt: [], zeitstrafeMinuten: 2, kartenArten: ALLE_ARTEN, ...m,
});
const props = (m: Partial<TeamColumnModel> = {}, p: Partial<TeamColumnProps> = {}): TeamColumnProps => ({
  model: model(m), knoepfe: { tor: true, foul: true, zeitstrafe: true, karte: true }, onTor: vi.fn(), onFoul: vi.fn(), onZeitstrafe: vi.fn(), onKarte: vi.fn(), ...p,
});

describe('TeamColumn', () => {
  it('Reihenfolge Tor, Foul, Zeitstrafe, Karte; Tor ≥ 56 px, Rest ≥ 44 px; jeder Name nennt das Team', () => {
    render(<TeamColumn {...props()} />);
    const ids = screen.getAllByRole('button').map((b) => b.getAttribute('data-testid'));
    expect(ids).toEqual(['goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away']);
    expect(screen.getByTestId('goal-button-away').style.minHeight).toBe('var(--touch-target-primary)');
    expect(screen.getByTestId('card-button-away').style.minHeight).toBe('var(--touch-target-minimum)');
    expect(screen.getByRole('button', { name: /Tor.*SV Süd/ })).toBeInTheDocument();
  });

  it('der Kopf nennt „Heim“ bzw. „Gast“ klein, der Name steht unter `team-name-*` (Selektor der E2E-Specs)', () => {
    render(<TeamColumn {...props()} />);
    expect(screen.getByTestId('team-head-away')).toHaveTextContent('Gast');
    expect(screen.getByTestId('team-name-away')).toHaveTextContent(/^SV Süd$/);
  });

  it('@SL-037 kein Wechsel-Knopf und kein Minus-Knopf', () => {
    render(<TeamColumn {...props()} />);
    expect(screen.queryByText(/Wechsel/)).toBeNull();
    expect(screen.queryByRole('button', { name: /−|Minus|Tor zurück/ })).toBeNull();
  });

  it('@SL-099 Foul-Zähler zeigt „Foul 3/5“, ohne Gesamtzahl', () => {
    render(<TeamColumn {...props()} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 3/5');
    expect(screen.queryByText(/gesamt/)).toBeNull();
  });

  it('@SL-035 Gegenbeispiel: ohne Grenze nur die Zahl', () => {
    render(<TeamColumn {...props({ fouls: { zaehlt: 3, grenze: null } })} />);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent(/^Foul 3$/);
  });

  it('@SL-102 ausgeschaltete Foul-Grenze: nur die Zahl 5, ohne Grenze', () => {
    render(<TeamColumn {...props({ fouls: { zaehlt: 5, grenze: null } })} />);
    const zaehler = screen.getByTestId('team-fouls-away');
    expect(zaehler).toHaveTextContent(/^Foul 5$/);
    expect(zaehler).not.toHaveTextContent('/');
  });

  it('@SL-029 Zeitstrafen-Knopf nennt die Dauer aus der Regel (1 Min), nicht fest „2 MIN“', () => {
    render(<TeamColumn {...props({ zeitstrafeMinuten: 1 })} />);
    expect(screen.getByTestId('penalty-button-away')).toHaveTextContent('Zeitstrafe 1 Min');
    expect(screen.queryByText('2 MIN')).toBeNull();
  });

  it('@SL-031 zwei laufende Zeitstrafen stehen beide mit Restzeit da; @SL-086/@SL-032 stehende Restzeit ist markiert', () => {
    render(<TeamColumn {...props({ strafen: [{ id: 'p1', rest: '1:12', nummer: 5, steht: false }, { id: 'p2', rest: '0:40', nummer: 9, steht: true }] })} />);
    expect(screen.getByTestId('team-penalty-p1')).toHaveTextContent('Nr. 5 · 1:12');
    expect(screen.getByTestId('team-penalty-p2')).toHaveTextContent('Nr. 9 · 0:40');
    expect(screen.getByTestId('team-penalty-p2')).toHaveAttribute('data-steht', 'true');
    expect(screen.getByTestId('team-penalty-p1')).toHaveAttribute('data-steht', 'false');
  });

  it('eine Strafe ohne Nummer zeigt „ohne Nr. · Restzeit“', () => {
    render(<TeamColumn {...props({ strafen: [{ id: 'p1', rest: '2:00', nummer: null, steht: false }] })} />);
    expect(screen.getByTestId('team-penalty-p1')).toHaveTextContent('ohne Nr. · 2:00');
  });

  it.each([
    ['@SL-023 @SL-093 Unterzahl nach Rot mit Restzeit', { unterzahl: { rest: '1:30' } }, 'Unterzahl · 1:30'],
    ['@SL-030 @SL-092 nach Gegentor „darf sich ergänzen“', { darfErgaenzen: true }, 'darf sich ergänzen'],
    ['@SL-089 Sperr-Hinweis in der Spalte', { gesperrt: [7] }, 'Nr. 7 gesperrt'],
  ])('%s', (_n, m, text) => {
    render(<TeamColumn {...props(m)} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('@SL-111 @SL-094 Gegenbeispiel: ohne Unterzahl/Sperre/Ergänzen keine stehenden Zeilen', () => {
    render(<TeamColumn {...props()} />);
    expect(screen.queryByText(/Unterzahl|darf sich ergänzen|gesperrt/)).toBeNull();
  });

  it('@SL-061 Tor-Knopf: volle Fläche in der Primärfarbe, Schrift in „auf Primär“, kein Verlauf, als Haupttaste markiert (VISUAL-DESIGN § 5/§ 6)', () => {
    render(<TeamColumn {...props()} />);
    const tor = screen.getByTestId('goal-button-away');
    expect(tor.style.background).toBe('var(--color-primary)');
    expect(tor.style.background).not.toContain('gradient');
    expect(tor.style.color).toBe('var(--color-on-primary)');
    expect(tor).toHaveAttribute('data-primary');
    expect(screen.getByTestId('foul-button-away')).not.toHaveAttribute('data-primary');
  });

  it('@SL-099 Laptop-Mockup Stand 4: „Foul 3/5“ steht im Foul-Knopf, es gibt keine zweite Zählerzeile', () => {
    render(<TeamColumn {...props()} />);
    const knopf = screen.getByTestId('foul-button-away');
    expect(within(knopf).getByTestId('team-fouls-away')).toHaveTextContent('Foul 3/5');
    expect(knopf).toHaveTextContent(/^Foul 3\/5$/);
    expect(screen.getAllByTestId('team-fouls-away')).toHaveLength(1);
  });

  it('@SL-099 WCAG 2.5.3: der zugängliche Name des Foul-Knopfs enthält den sichtbaren Zähler („Foul SV Süd, Foul 3/5“)', () => {
    render(<TeamColumn {...props()} />);
    const knopf = screen.getByRole('button', { name: 'Foul SV Süd, Foul 3/5' });
    expect(knopf).toBe(screen.getByTestId('foul-button-away'));
    expect(knopf.getAttribute('aria-label')).toContain(screen.getByTestId('team-fouls-away').textContent ?? '');
  });

  it('@SL-102 Gegenbeispiel: ohne Grenze steht die Zahl im Namen („Foul SV Süd, Foul 5“)', () => {
    render(<TeamColumn {...props({ fouls: { zaehlt: 5, grenze: null } })} />);
    expect(screen.getByRole('button', { name: 'Foul SV Süd, Foul 5' })).toBeInTheDocument();
  });

  it('@SL-099 ohne Foul-Knopf (Halbzeitpause, Nur-Lesen) steht der Zähler als eigene Zeile außerhalb eines Knopfs', () => {
    render(<TeamColumn {...props({}, { knoepfe: { tor: false, foul: false, zeitstrafe: true, karte: true } })} />);
    const zaehler = screen.getByTestId('team-fouls-away');
    expect(zaehler).toHaveTextContent('Foul 3/5');
    expect(zaehler.closest('button')).toBeNull();
    expect(screen.getAllByTestId('team-fouls-away')).toHaveLength(1);
  });

  it('@SL-087 in der Halbzeitpause nur Karte und Zeitstrafe', () => {
    render(<TeamColumn {...props({}, { knoepfe: { tor: false, foul: false, zeitstrafe: true, karte: true } })} />);
    expect(screen.queryByTestId('goal-button-away')).toBeNull();
    expect(screen.queryByTestId('foul-button-away')).toBeNull();
    expect(screen.getByTestId('card-button-away')).toBeInTheDocument();
    expect(screen.getByTestId('penalty-button-away')).toBeInTheDocument();
  });

  it('@SL-018 Nur-Lesen: Zähler und Strafen sichtbar, keine Knöpfe', () => {
    render(<TeamColumn {...props({ strafen: [{ id: 'p1', rest: '1:12', nummer: 5, steht: false }] }, { knoepfe: { tor: false, foul: false, zeitstrafe: false, karte: false } })} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('team-fouls-away')).toBeInTheDocument();
    expect(screen.getByTestId('team-penalty-p1')).toBeInTheDocument();
  });

  it('@SL-026 alle Kartenarten aus: kein Karten-Knopf, Tor und Foul bleiben', () => {
    render(<TeamColumn {...props({ kartenArten: { yellow: false, yellowRed: false, red: false, timePenalty: true } })} />);
    expect(screen.queryByTestId('card-button-away')).toBeNull();
    expect(screen.getByTestId('goal-button-away')).toBeInTheDocument();
    expect(screen.getByTestId('foul-button-away')).toBeInTheDocument();
    expect(screen.getByTestId('penalty-button-away')).toBeInTheDocument();
  });

  it('@SL-026 Zeitstrafe aus: kein Zeitstrafen-Knopf, die Karte bleibt', () => {
    render(<TeamColumn {...props({ kartenArten: { ...ALLE_ARTEN, timePenalty: false } })} />);
    expect(screen.queryByTestId('penalty-button-away')).toBeNull();
    expect(screen.getByTestId('card-button-away')).toBeInTheDocument();
  });

  it('@SL-025 gegenbeispiel: nur Gelb-Rot aus → Karten-Knopf bleibt', () => {
    render(<TeamColumn {...props({ kartenArten: { ...ALLE_ARTEN, yellowRed: false } })} />);
    expect(screen.getByTestId('card-button-away')).toBeInTheDocument();
  });

  it('die Tipps rufen die Rückrufe der eigenen Spalte', () => {
    const p = props();
    render(<TeamColumn {...p} />);
    screen.getByTestId('goal-button-away').click();
    screen.getByTestId('foul-button-away').click();
    screen.getByTestId('penalty-button-away').click();
    screen.getByTestId('card-button-away').click();
    expect([p.onTor, p.onFoul, p.onZeitstrafe, p.onKarte].map((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('@OB-025 50-Zeichen-Name steht vollständig im Text, ohne „…“, ohne Silbentrennung und ohne Kürzung', () => {
    render(<TeamColumn {...props({ name: NAME_50 })} />);
    const kopf = screen.getByTestId('team-head-away');
    const name = screen.getByTestId('team-name-away');
    expect(name).toHaveTextContent(NAME_50);
    expect(name.textContent).not.toMatch(/…|\.\.\./);
    expect(name).toHaveAttribute('data-teamname');
    for (const el of [kopf, name]) {
      expect(el.style.textOverflow).not.toBe('ellipsis');
      expect(el.style.whiteSpace).not.toBe('nowrap');
      expect(el.style.getPropertyValue('-webkit-line-clamp')).toBe('');
      expect(el.style.hyphens).not.toBe('auto'); // VISUAL-DESIGN § 2: Teamnamen trennen nie
      expect(el).not.toHaveAttribute('lang');
    }
    expect(name.style.overflowWrap).toBe('anywhere');
  });

  it('@OB-025 die Schrift des Namens ist eine Stufe zwischen mittel und groß (kleiner statt kürzen), nie darunter', () => {
    render(<TeamColumn {...props({ name: NAME_50 })} />);
    const schrift = screen.getByTestId('team-name-away').style.fontSize;
    expect(schrift).toContain('clamp(');
    expect(schrift).toContain('var(--font-size-md)');
    expect(schrift).toContain('var(--font-size-lg)');
  });

  it('@OB-025 beide Köpfe haben dieselbe Mindesthöhe aus dem Token, damit die Tor-Knöpfe auf einer Höhe stehen', () => {
    render(<><TeamColumn {...props({ seite: 'home', name: NAME_50 })} /><TeamColumn {...props({ seite: 'away', name: 'SV Süd' })} /></>);
    expect(screen.getByTestId('team-head-home').style.minHeight).toBe('var(--sizing-spaltenkopf-max)');
    expect(screen.getByTestId('team-head-away').style.minHeight).toBe('var(--sizing-spaltenkopf-max)');
  });

  it('Kopf nach Mockup: umrandet, Streifen und „Heim/Gast“ in einer Zeile, der Name darunter', () => {
    render(<TeamColumn {...props({ farbe: 'var(--color-team-fallback)' })} />);
    const kopf = screen.getByTestId('team-head-away');
    expect(kopf.style.border).not.toBe('');
    const zeile = within(kopf).getByTestId('team-stripe-away').parentElement!;
    expect(zeile).toHaveTextContent('Gast');
    expect(zeile).not.toContainElement(screen.getByTestId('team-name-away'));
    expect(kopf.lastElementChild).toBe(screen.getByTestId('team-name-away'));
  });

  it('Teamfarbe nur als Streifen im Kopf, nie als Schrifthintergrund', () => {
    render(<TeamColumn {...props({ farbe: 'var(--color-team-fallback)' })} />);
    expect(screen.getByTestId('team-head-away').style.backgroundColor).toBe('');
    expect(within(screen.getByTestId('team-head-away')).getByTestId('team-stripe-away')).toBeInTheDocument();
  });
});
