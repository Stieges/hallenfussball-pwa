/**
 * StatusZeile (G6, @HT-045): Ordnen und Kürzen, fachfrei. Die Einträge sind hier nachgebaut; das Zusammenfassen mehrerer Felder
 * („Feld 1, 2 nicht bereit“) macht der Gastgeber (H4-5), nicht die Zeile. Die Breite wird über `matchMedia` simuliert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusZeile, type StatusEintrag, type StatusRang } from '../StatusZeile';
import { Icons } from '../../Icons';

const original = window.matchMedia;
function setzeBreite(px: number): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const m = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: m !== null && px <= Number(m[1]), media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    };
  });
}
beforeEach(() => setzeBreite(1280));
afterEach(() => { window.matchMedia = original; });

const e = (id: string, rang: StatusRang, text: string, extra: Partial<StatusEintrag> = {}): StatusEintrag => ({
  id, rang, text, ton: rang === 'stoerung' ? 'warn' : rang === 'probe' ? 'info' : 'ok', symbol: <Icons.Check size={16} />,
  aktion: { art: 'navigiere', ziel: `/ziel/${id}` }, ...extra,
});
const weitereText = (n: number) => `+${n} weitere`;
const zeige = (eintraege: StatusEintrag[], onNavigiere = vi.fn()) =>
  render(<StatusZeile eintraege={eintraege} weitereText={weitereText} onNavigiere={onNavigiere} label="Status" />);
const sichtbar = () => screen.getAllByRole('button').map((b) => b.textContent);

const BEREIT = e('f1', 'bereit', 'Lautsprecher Feld 1 bereit', { kurz: 'Feld 1 bereit', reihe: 1 });
const NICHT = e('f1', 'stoerung', 'Lautsprecher Feld 1 nicht bereit', { kurz: 'Feld 1 nicht bereit', reihe: 1 });
const PROBE = e('probe', 'probe', 'Probe läuft', { rand: 'gestrichelt' });

describe('StatusZeile', () => {
  describe('@HT-045 Beispielzeilen', () => {
    it('@HT-045 Feld 1 bereit, 1280: ein Eintrag „Lautsprecher Feld 1 bereit“', () => {
      zeige([BEREIT]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 bereit']);
    });

    it('@HT-045 Feld 1 bereit und Probe, 360: „Probe läuft“, dann „Feld 1 bereit“ nebeneinander (Kurzform, eine Zeile)', () => {
      setzeBreite(360);
      zeige([BEREIT, PROBE]);
      expect(sichtbar()).toEqual(['Probe läuft', 'Feld 1 bereit']);
      // nebeneinander = Geschwister derselben umbrechenden Flex-Zeile, nicht untereinander gestapelt
      const zeile = screen.getByTestId('status-zeile');
      expect(zeile.style.display).toBe('flex');
      expect(zeile.style.flexWrap).toBe('wrap');
      expect(zeile.style.flexDirection).toBe('');
    });

    it('@HT-045 Feld 1 nicht bereit und Probe, 1280: erst die Störung, dann „Probe läuft“', () => {
      zeige([PROBE, NICHT]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft']);
    });

    it('@HT-045 Feld 1 und 2 nicht bereit und Probe, 1280: ein Eintrag des Gastgebers „Lautsprecher Feld 1, 2 nicht bereit“, dann Probe', () => {
      zeige([PROBE, e('f12', 'stoerung', 'Lautsprecher Feld 1, 2 nicht bereit', { reihe: 1 })]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1, 2 nicht bereit', 'Probe läuft']);
    });

    it('@HT-045 kein Eintrag, 360: nichts, die Zeile fehlt ganz', () => {
      setzeBreite(360);
      const { container } = zeige([]);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('status-zeile')).toBeNull();
    });

    it('@HT-045 bereit mit „🔈? Prüfen“ und Probe, 1280: „Probe läuft“, dann „bereit“ mit der Pille „Prüfen“ unmittelbar daneben', () => {
      const pruefen = e('pruefen', 'hinweis', 'Prüfen', { ton: 'info', rand: 'gestrichelt' });
      zeige([{ ...BEREIT, daneben: pruefen }, PROBE]);
      expect(sichtbar()).toEqual(['Probe läuft', 'Lautsprecher Feld 1 bereit', 'Prüfen']);
      const gruppe = screen.getByTestId('status-zeile-f1').parentElement!;
      expect(within(gruppe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lautsprecher Feld 1 bereit', 'Prüfen']);
    });
  });

  describe('Reihenfolge', () => {
    it('Störung → Probe → Hinweis → bereit, unabhängig von der Reihenfolge der Eingabe', async () => {
      zeige([e('b', 'bereit', 'bereit'), e('h', 'hinweis', 'Hinweis'), PROBE, NICHT]);
      await userEvent.setup().click(screen.getByTestId('status-zeile-weitere'));
      expect(sichtbar().slice(0, 4)).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft', 'Hinweis', 'bereit']);
    });

    it('innerhalb eines Rangs nach `reihe` (Feldnummer), nicht nach Eingabe', () => {
      zeige([e('f2', 'stoerung', 'Feld 2 aus', { reihe: 2 }), e('f1', 'stoerung', 'Feld 1 aus', { reihe: 1 })]);
      expect(sichtbar()).toEqual(['Feld 1 aus', 'Feld 2 aus']);
    });
  });

  describe('„+n weitere“', () => {
    it('@HT-045 bis zu zwei Einträge: alle sichtbar, keine Sammelpille', () => {
      zeige([PROBE, BEREIT]);
      expect(screen.queryByTestId('status-zeile-weitere')).toBeNull();
    });

    it('@HT-045 ab drei Einträgen: Störung und Probe bleiben, die übrigen werden zu „+2 weitere“', () => {
      zeige([e('h', 'hinweis', 'Hinweis'), BEREIT, PROBE, NICHT]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft', '+2 weitere']);
    });

    it('Störung und Probe bleiben auch dann sichtbar, wenn es nur davon mehr als zwei gibt (dann keine Sammelpille)', () => {
      zeige([e('s1', 'stoerung', 'Störung 1', { reihe: 1 }), e('s2', 'stoerung', 'Störung 2', { reihe: 2 }), PROBE]);
      expect(sichtbar()).toEqual(['Störung 1', 'Störung 2', 'Probe läuft']);
    });

    it('die Sammelpille klappt die Liste auf und wieder zu', async () => {
      const user = userEvent.setup();
      zeige([BEREIT, PROBE, NICHT]);
      const weitere = screen.getByTestId('status-zeile-weitere');
      expect(weitere).toHaveAttribute('aria-expanded', 'false');
      await user.click(weitere);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft', 'Lautsprecher Feld 1 bereit', '+1 weitere']);
      expect(screen.getByTestId('status-zeile-weitere')).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByTestId('status-zeile-weitere'));
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft', '+1 weitere']);
    });

    it('die Pille „daneben“ zählt nicht als eigener Eintrag', () => {
      const pruefen = e('pruefen', 'hinweis', 'Prüfen');
      zeige([{ ...BEREIT, daneben: pruefen }, PROBE]);
      expect(screen.queryByTestId('status-zeile-weitere')).toBeNull();
    });
  });

  describe('Kurzform unter 480 px', () => {
    it('@HT-045 bei zwei Einträgen und 360 px gilt `kurz`', () => {
      setzeBreite(360);
      zeige([NICHT, PROBE]);
      expect(sichtbar()).toEqual(['Feld 1 nicht bereit', 'Probe läuft']);
    });

    it('Gegenbeispiel: bei einem Eintrag bleibt die Langform, auch bei 360 px', () => {
      setzeBreite(360);
      zeige([BEREIT]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 bereit']);
    });

    it('Gegenbeispiel: ab 480 px gilt die Langform, auch bei zwei Einträgen', () => {
      setzeBreite(480);
      zeige([NICHT, PROBE]);
      expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft']);
    });

    it('479 px ist die Grenze nach unten: gerade noch Kurzform', () => {
      setzeBreite(479);
      zeige([NICHT, PROBE]);
      expect(sichtbar()).toEqual(['Feld 1 nicht bereit', 'Probe läuft']);
    });

    it('ohne `kurz` bleibt der Text, und der Lesetext trägt den ausgeschriebenen Namen', () => {
      setzeBreite(360);
      zeige([{ ...BEREIT, lesetext: 'Lautsprecher Feld 1 bereit' }, e('x', 'hinweis', 'Ohne Kurzform')]);
      expect(screen.getByRole('button', { name: 'Lautsprecher Feld 1 bereit' })).toHaveTextContent('Feld 1 bereit');
      expect(sichtbar()).toContain('Ohne Kurzform');
    });
  });

  it('Eintrag mit „navigiere“ meldet das Ziel; „ausloesen“ ruft seinen eigenen Handler', async () => {
    const user = userEvent.setup();
    const onNavigiere = vi.fn();
    const onClick = vi.fn();
    zeige([NICHT, e('probe', 'probe', 'Probe läuft', { aktion: { art: 'ausloesen', onClick } })], onNavigiere);
    await user.click(screen.getByText('Lautsprecher Feld 1 nicht bereit'));
    await user.click(screen.getByText('Probe läuft'));
    expect(onNavigiere).toHaveBeenCalledExactlyOnceWith('/ziel/f1');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Befund 1: ohne `onNavigiere` kompiliert die Zeile nicht (Pflicht, damit eine antippbare Pille nie still nichts tut)', () => {
    // @ts-expect-error – onNavigiere fehlt
    const ohne = <StatusZeile eintraege={[]} weitereText={weitereText} label="Status" />;
    expect(ohne).toBeTruthy();
  });

  it('Befund 4: die Zeile ist ein benannter Bereich, keine Live-Region (kein Vorlesen bei jedem Abgleich)', () => {
    zeige([BEREIT]);
    expect(screen.getByRole('region', { name: 'Status' })).toBe(screen.getByTestId('status-zeile'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Befund 5: schrumpft die Liste auf zwei Einträge und wächst wieder, steht sie nicht aufgeklappt da', async () => {
    const user = userEvent.setup();
    const vier = [{ ...BEREIT, id: 'f2' }, PROBE, NICHT, e('h', 'hinweis', 'Hinweis')];
    const { rerender } = zeige(vier);
    await user.click(screen.getByTestId('status-zeile-weitere'));
    expect(sichtbar()).toHaveLength(5);
    rerender(<StatusZeile eintraege={[{ ...BEREIT, id: 'f2' }, PROBE]} weitereText={weitereText} onNavigiere={vi.fn()} label="Status" />);
    expect(screen.queryByTestId('status-zeile-weitere')).toBeNull();
    rerender(<StatusZeile eintraege={vier} weitereText={weitereText} onNavigiere={vi.fn()} label="Status" />);
    expect(screen.getByTestId('status-zeile-weitere')).toHaveAttribute('aria-expanded', 'false');
    expect(sichtbar()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft', '+2 weitere']);
  });
});
