/**
 * LautsprecherFeldKarte (H4-4): Wortlaut je Zustand (@HT-039, @HT-016, @HT-041), Symbol + Wort + Randart.
 * Die Texte kommen hier aus der echten deutschen Sprachdatei, nicht aus dem Passthrough der Testumgebung.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import de from '../../../../i18n/locales/de/hallenton.json';
import { Icons } from '../../../../components/ui/Icons';
import { LautsprecherFeldKarte, type FeldZustand } from '../LautsprecherFeldKarte';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

const zeige = (zustand: FeldZustand, extra: Partial<React.ComponentProps<typeof LautsprecherFeldKarte>> = {}) =>
  render(<LautsprecherFeldKarte feld={1} zustand={zustand} {...extra} />);
const zustandsMarke = () => screen.getByTestId('lautsprecher-feld-1-zustand');

describe('LautsprecherFeldKarte', () => {
  it('zeigt Feldname und Gerät', () => {
    zeige({ art: 'bereit' }, { geraet: { name: 'Laptop Turnierleitung', art: 'laptop' } });
    expect(screen.getByRole('heading', { name: 'Feld 1' })).toBeInTheDocument();
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent('Hallen-Lautsprecher: Laptop Turnierleitung');
  });

  it('@HT-039 nicht bereit mit Grund: „nicht bereit – Ton nicht aktiviert“, mit Symbol und durchgezogenem Rand', () => {
    zeige({ art: 'nichtBereit', grund: 'tonNichtAktiviert' });
    expect(zustandsMarke()).toHaveTextContent('nicht bereit – Ton nicht aktiviert');
    expect(zustandsMarke().querySelector('svg')).not.toBeNull();
    expect(zustandsMarke()).toHaveAttribute('data-ton', 'warn');
    expect(zustandsMarke()).toHaveAttribute('data-rand', 'fest');
  });

  it.each([
    ['ausgangVerloren', 'nicht bereit – Ausgang verloren'],
    ['ausgangBestaetigen', 'nicht bereit – Ausgang bestätigen'],
    ['lautstaerkeNull', 'nicht bereit – Lautstärke 0 %'],
    ['schlafenGelegt', 'nicht bereit – schlafen gelegt'],
    ['hintergrund', 'nicht bereit – Hintergrund'],
    ['keineVerbindung', 'nicht bereit – keine Verbindung'],
  ] as const)('@HT-039 Grund %s', (grund, erwartet) => {
    zeige({ art: 'nichtBereit', grund });
    expect(zustandsMarke()).toHaveTextContent(erwartet);
  });

  it('@HT-039 @HT-042 meldet sich nicht: „meldet sich nicht (zuletzt 14:02)“', () => {
    zeige({ art: 'meldetSichNicht', zuletzt: '14:02' });
    expect(zustandsMarke()).toHaveTextContent('meldet sich nicht (zuletzt 14:02)');
  });

  it('@HT-039 Zustand unbekannt (Server kennt einen neueren Zustand): nur „nicht bereit“, ohne Grund', () => {
    zeige({ art: 'zustandUnbekannt' });
    expect(zustandsMarke().textContent).toBe('nicht bereit');
  });

  it('@HT-041 Status unbekannt (Verwaltung ohne Netz): Wort, Symbol und gestrichelter Rand, kein Alarmton', () => {
    zeige({ art: 'statusUnbekannt' });
    expect(zustandsMarke()).toHaveTextContent('Status unbekannt');
    expect(zustandsMarke()).toHaveAttribute('data-rand', 'gestrichelt');
    expect(zustandsMarke()).toHaveAttribute('data-ton', 'neutral');
    expect(zustandsMarke().querySelector('svg')).not.toBeNull();
  });

  it('@HT-016 kein Hallen-Lautsprecher: neutral, mit Hinweis, dass das Anpfeifen möglich bleibt', () => {
    zeige({ art: 'keinLautsprecher' });
    expect(zustandsMarke()).toHaveTextContent('kein Hallen-Lautsprecher');
    expect(zustandsMarke()).toHaveAttribute('data-ton', 'neutral');
    expect(screen.getByText(/Das Anpfeifen bleibt möglich/)).toBeInTheDocument();
  });

  it('@HT-047 eine Pille neben dem Zustand erscheint in der Karte; ohne Pille nichts', () => {
    const { unmount } = zeige({ art: 'bereit' }, { pille: <span data-testid="pille"><Icons.Check size={16} />Prüfen</span> });
    expect(screen.getByTestId('pille')).toHaveTextContent('Prüfen');
    unmount();
    zeige({ art: 'bereit' });
    expect(screen.queryByTestId('pille')).toBeNull();
  });

  it('Befund 6: der Gerätename steht fett, das Wort davor nicht', () => {
    zeige({ art: 'bereit' }, { geraet: { name: 'Laptop Turnierleitung', art: 'laptop' } });
    expect(screen.getByText('Laptop Turnierleitung').tagName).toBe('STRONG');
  });

  it('Befund 2: „übernommen“ und „abgemeldet“ sind keine Zustände eines Felds (Zustände des eigenen Geräts, H4-6)', () => {
    // @ts-expect-error – kein Feld-Zustand
    const a: FeldZustand = { art: 'uebernommen' };
    // @ts-expect-error – kein Feld-Zustand
    const b: FeldZustand = { art: 'abgemeldet' };
    expect([a.art, b.art]).toEqual(['uebernommen', 'abgemeldet']);
  });

  it('ohne Gerät keine Geräte-Zeile; Monitor bekommt den Zusatz „(Monitor)“', () => {
    const { unmount } = zeige({ art: 'bereit' });
    expect(screen.queryByTestId('lautsprecher-feld-1-geraet')).toBeNull();
    unmount();
    zeige({ art: 'bereit' }, { geraet: { name: 'Hallenmonitor Halle', art: 'monitor' } });
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent('Hallen-Lautsprecher: Hallenmonitor Halle (Monitor)');
  });
});
