/**
 * H4-10 „Dieses Gerät“ b – große Zustände am Gerät, Regler, Rückfrage beim Anhören (@HT-011, @HT-013, @HT-014, @HT-023, @HT-033 Zeile 8, @HT-037,
 * @HT-039 „Lautstärke 0 %“, @HT-017 Rückfrage bei laufendem Spiel): Erwartungen aus dem Gherkin, nicht am Code abgelesen. Die Hooks sind Doppel;
 * Texte aus den echten deutschen Sprachdateien. Der Stand am Server zeigt ein anderes Gerät als Lautsprecher, wo dieses Gerät keiner ist.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import tournamentDe from '../../../../i18n/locales/de/tournament.json';
import type { HallStatusAntwort, HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { lautsprecherLage, type LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import type { FeldZustand } from '../../runtime/laufzeitZustand';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'tournament' ? tournamentDe : de;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

const doppel = vi.hoisted(() => ({
  darf: true, abgeschlossen: false,
  status: null as unknown as HallStatus,
  lautsprecher: null as unknown as HallLautsprecher,
  laufend: new Map<number, number>(),
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => doppel.abgeschlossen }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
vi.mock('../../useAngepfiffeneFelder', () => ({ useAngepfiffeneFelder: () => new Set<number>() }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => doppel.laufend }));
vi.mock('../../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(null) }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 13, 14, 2, 30).getTime();

function voll(felder: ReadonlyArray<{ feld: number; name: string; state: string }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: felder.map((f) => ({
      field: f.feld, deviceName: f.name, isThisDevice: false, state: f.state as never, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null,
    })),
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
const testtonAnfordern = vi.fn(() => Promise.resolve({ ok: true as const, status: 'requested' as const, testId: 'test-1' }));
const setzeServer = (antwort: HallStatusVoll): void => {
  doppel.status = { stand: 'aktuell', antwort, felder: lageAus(antwort), lautsprecherBekannt: antwort.speakers.length > 0, testtonAnfordern, gehoert: vi.fn() } as unknown as HallStatus;
};

const VOLL = { abpfiff: 100, halbzeit: 100, tor: 100 };
function lautsprecherDoppel(teil: Partial<HallLautsprecher> = {}): HallLautsprecher {
  return {
    rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null,
    tonAktivieren: vi.fn(() => Promise.resolve(true)), abgeloestVerstanden: vi.fn(), angehaltenBestaetigen: vi.fn(),
    hierAnhoeren: vi.fn(() => Promise.resolve(true)), lautstaerke: VOLL, stumm: false, setzeLautstaerke: vi.fn(), setzeStumm: vi.fn(),
    ...teil,
  } as unknown as HallLautsprecher;
}
/** Dieses Gerät ist Lautsprecher für Feld 1 (im Server-Stand steht es mit, damit die Karte stimmt). */
function eigenerLautsprecher(zustand: FeldZustand, rolle: 'toent' | 'wartet' | 'andererTab' = zustand === 'ready' ? 'toent' : 'wartet', teil: Partial<HallLautsprecher> = {}, warAngehalten = false): HallLautsprecher {
  return lautsprecherDoppel({
    rolle: 'diesesTurnier', felder: [1], name: 'Laptop Turnierleitung',
    laufzeit: { rolle, zustandJeFeld: { 'field-1': zustand }, warAngehalten } as never,
    ...teil,
  });
}

const seite = () => <HallentonSeite tournamentId="t-sued" felderAnzahl={2} />;
const zustandsBanner = (): HTMLElement => document.querySelector<HTMLElement>('[data-zustand][data-ton]')!;
const klick = async (testId: string): Promise<void> => { await act(async () => { fireEvent.click(screen.getByTestId(testId)); await Promise.resolve(); }); };

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false;
  doppel.lautsprecher = lautsprecherDoppel();
  doppel.laufend = new Map();
  testtonAnfordern.mockClear();
  setzeServer(voll([]));
  window.localStorage.clear();
});
afterEach(() => { Reflect.deleteProperty(navigator, 'locks'); vi.restoreAllMocks(); });

describe('@HT-001 großer Zustand „bereit“ (ersetzt den kleinen Banner)', () => {
  it('bereit → groß „Lautsprecher bereit“ mit Feld und Gerätenamen, Ton ok; Gegenbeispiel: keine Warnung und keine Fußleiste', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'bereit');
    expect(zustandsBanner()).toHaveAttribute('data-ton', 'ok');
    expect(zustandsBanner()).toHaveTextContent('Lautsprecher bereit');
    expect(zustandsBanner()).toHaveTextContent('Feld 1 · Laptop Turnierleitung');
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
    expect(screen.queryByTestId('geraet-banner-angehalten')).toBeNull();
  });
  it('„Nächster Ton“ steht nicht da (geparkt, MVP+)', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', { laufzeit: { rolle: 'toent', zustandJeFeld: { 'field-1': 'ready' }, warAngehalten: false, naechsterTon: { at: 1, art: 'abpfiff', felder: ['field-1'], spiele: ['m11'] } } as never });
    render(seite());
    expect(screen.queryByText(/Nächster Ton/)).toBeNull();
  });
});

describe('@HT-011 ohne Verbindung zeigt der Rechner groß „Keine Verbindung – kein Hallenton“', () => {
  it('Zustand „keine Verbindung“ am eigenen Gerät → großes Wort, Warnton; die Verwaltung sagt „nicht bereit – keine Verbindung“', () => {
    doppel.lautsprecher = eigenerLautsprecher('keineVerbindung', 'toent');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'keineVerbindung');
    expect(zustandsBanner()).toHaveAttribute('data-ton', 'warn');
    expect(zustandsBanner()).toHaveTextContent('Keine Verbindung – kein Hallenton');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('nicht bereit – keine Verbindung');
  });
  it('Gegenbeispiel: mit Verbindung steht nirgends „Keine Verbindung“', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready');
    render(seite());
    expect(screen.queryByText(/Keine Verbindung/)).toBeNull();
  });
});

describe('@HT-013 nach dem Neuladen braucht der Lautsprecher wieder „Ton aktivieren“', () => {
  it('Ton nicht aktiviert → groß „Lautsprecher nicht bereit“ mit „Grund: Ton nicht aktiviert“, Karte „nicht bereit – Ton nicht aktiviert“, Fußleiste', async () => {
    doppel.lautsprecher = eigenerLautsprecher('not_activated');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'tonNichtAktiv');
    expect(zustandsBanner()).toHaveTextContent('Lautsprecher nicht bereit');
    expect(zustandsBanner()).toHaveTextContent('Grund: Ton nicht aktiviert');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('nicht bereit – Ton nicht aktiviert');
    expect(within(screen.getByTestId('hallenton-fussleiste')).getByTestId('ton-aktivieren')).toBeInTheDocument();
    await klick('ton-aktivieren');
    expect(doppel.lautsprecher.tonAktivieren).toHaveBeenCalledTimes(1);
  });
  it('nach „Ton aktivieren“ ist der Lautsprecher wieder bereit (Gegenbeispiel: dann keine Fußleiste mehr)', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'bereit');
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
  });
});

describe('@HT-037 hat der Browser den Lautsprecher schlafen gelegt, sagt der Rechner das', () => {
  it('schlafen gelegt → groß „Lautsprecher schlafen gelegt“ und „Der Browser hat den Lautsprecher schlafen gelegt“, Karte „nicht bereit – schlafen gelegt“, bis „Ton aktivieren“', () => {
    doppel.lautsprecher = eigenerLautsprecher('slept');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'schlafenGelegt');
    expect(zustandsBanner()).toHaveTextContent('Lautsprecher schlafen gelegt');
    expect(zustandsBanner()).toHaveTextContent('Der Browser hat den Lautsprecher schlafen gelegt');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('nicht bereit – schlafen gelegt');
    expect(screen.getByTestId('ton-aktivieren')).toBeInTheDocument();
  });
  it('Gegenbeispiel: selbst neu geladen (Ton nicht aktiviert) → kein Hinweis auf das Schlafenlegen', () => {
    doppel.lautsprecher = eigenerLautsprecher('not_activated');
    render(seite());
    expect(screen.queryByTestId('geraet-banner-schlafenGelegt')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).not.toHaveTextContent('schlafen gelegt');
  });
});

describe('@HT-014 „App war angehalten – Töne können gefehlt haben“, bis Olli es bestätigt', () => {
  it('die angehaltene App kommt wieder nach vorn → wieder „bereit“ und der Hinweis mit „Bestätigen“; Bestätigen meldet es', async () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', {}, true);
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'bereit');
    const hinweis = screen.getByTestId('geraet-banner-angehalten');
    expect(hinweis).toHaveTextContent('App war angehalten – Töne können gefehlt haben');
    await klick('geraet-angehalten-bestaetigen');
    expect(doppel.lautsprecher.angehaltenBestaetigen).toHaveBeenCalledTimes(1);
  });
  it('Gegenbeispiel: war die App nicht angehalten, steht kein Hinweis da', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready');
    render(seite());
    expect(screen.queryByTestId('geraet-banner-angehalten')).toBeNull();
    expect(screen.queryByText(/App war angehalten/)).toBeNull();
  });
});

describe('@HT-033 Zeile 8 das zweite Fenster zeigt „Lautsprecher läuft schon in einem anderen Fenster“', () => {
  it('ein anderes Fenster tönt → ruhig, ohne Warnfarbe, ohne Klick und ohne „Ton aktivieren“', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'andererTab');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'anderesFenster');
    expect(zustandsBanner()).toHaveAttribute('data-ton', 'info');
    expect(zustandsBanner()).toHaveTextContent('Lautsprecher läuft schon in einem anderen Fenster');
    expect(within(zustandsBanner()).queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
  });
  it('auch auf „Ton nicht aktiv“ (Sperre bei einem anderen Fenster) zeigt es sofort den ruhigen Hinweis statt der Aufforderung', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { query: () => Promise.resolve({ held: [{ name: 'hallenton' }] }) } });
    doppel.lautsprecher = eigenerLautsprecher('not_activated');
    render(seite());
    await act(async () => { await Promise.resolve(); });
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'anderesFenster');
    expect(screen.queryByTestId('ton-aktivieren')).toBeNull();
  });
  it('Gegenbeispiel: tönt dieses Fenster selbst, steht dort „bereit“, nicht „anderes Fenster“', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent');
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'bereit');
  });
});

describe('@HT-023 die Lautstärke ist je Lautsprecher-Gerät einstellbar', () => {
  it('drei Regler – Abpfiff-Ton, Halbzeit-Ton, Torhymne – mit Wert in Prozent; Regler stellen die eigene Lautstärke ein', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', { lautstaerke: { abpfiff: 80, halbzeit: 50, tor: 40 } });
    render(seite());
    const regler = screen.getByTestId('geraet-lautstaerke');
    expect(within(regler).getByText('Abpfiff')).toBeInTheDocument();
    expect(within(regler).getByText('Halbzeit')).toBeInTheDocument();
    expect(within(regler).getByText('Torhymne')).toBeInTheDocument();
    expect(screen.getByTestId('regler-abpfiff-wert')).toHaveTextContent('80 %');
    expect(screen.getByTestId('regler-halbzeit-wert')).toHaveTextContent('50 %');
    expect(screen.getByTestId('regler-tor-wert')).toHaveTextContent('40 %');
    expect(document.querySelectorAll('[data-testid^="regler-"][data-testid$="-schieber"]')).toHaveLength(3);
    fireEvent.change(screen.getByTestId('regler-halbzeit-schieber'), { target: { value: '30' } });
    expect(doppel.lautsprecher.setzeLautstaerke).toHaveBeenCalledWith('halbzeit', 30);
    fireEvent.change(screen.getByTestId('regler-tor-schieber'), { target: { value: '60' } });
    expect(doppel.lautsprecher.setzeLautstaerke).toHaveBeenCalledWith('tor', 60);
  });
  it('neben jedem Regler spielt „Anhören“ seinen Ton, auch den Halbzeit-Ton und die Torhymne', async () => {
    doppel.lautsprecher = eigenerLautsprecher('ready');
    render(seite());
    await klick('regler-abpfiff-anhoeren');
    await klick('regler-halbzeit-anhoeren');
    await klick('regler-tor-anhoeren');
    expect((doppel.lautsprecher.hierAnhoeren as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual(['abpfiff', 'halbzeit', 'tor']);
  });
  it('Gegenbeispiel: ein Gerät, das kein Hallen-Lautsprecher ist, hat keine Regler (Gegenstück: @HT-023 „Gegeben … ist Hallen-Lautsprecher“)', () => {
    doppel.lautsprecher = lautsprecherDoppel();
    render(seite());
    expect(screen.queryByTestId('geraet-lautstaerke')).toBeNull();
  });
  it('Stumm schaltet dieses Gerät stumm; der Zustand sagt es ruhig dazu', async () => {
    doppel.lautsprecher = eigenerLautsprecher('volume_zero', 'toent', { stumm: true });
    render(seite());
    expect(zustandsBanner()).toHaveTextContent('Dieses Gerät ist stumm');
    expect(screen.getByTestId('regler-stumm')).toHaveAttribute('aria-checked', 'true');
    await klick('regler-stumm');
    expect(doppel.lautsprecher.setzeStumm).toHaveBeenCalledWith(false);
  });
  it('nach dem Turnierende: Werte lesbar, nichts änderbar', () => {
    doppel.darf = false; doppel.abgeschlossen = true;
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', { lautstaerke: { abpfiff: 80, halbzeit: 50, tor: 40 } });
    render(seite());
    expect(screen.getByTestId('regler-abpfiff-wert')).toHaveTextContent('80 %');
    expect(screen.getByTestId('regler-abpfiff-schieber')).toBeDisabled();
    expect(screen.getByTestId('regler-halbzeit-anhoeren')).toBeDisabled();
    expect(screen.getByTestId('regler-stumm')).toBeDisabled();
  });
});

describe('@HT-039 Lautstärke 0 % ist „nicht bereit – Lautstärke 0 %“', () => {
  it('Abpfiff-Regler auf 0 % → groß „Lautstärke steht auf 0 %“, Karte „nicht bereit – Lautstärke 0 %“, nicht „bereit“', () => {
    doppel.lautsprecher = eigenerLautsprecher('volume_zero', 'toent', { lautstaerke: { abpfiff: 0, halbzeit: 50, tor: 100 } });
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'lautstaerkeNull');
    expect(zustandsBanner()).toHaveTextContent('Lautstärke steht auf 0 %');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('nicht bereit – Lautstärke 0 %');
    expect(screen.queryByText('Lautsprecher bereit')).toBeNull();
  });
  it('Gegenbeispiel: Halbzeit-Ton auf 0 % ändert die Bereitschaft nicht', () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', { lautstaerke: { abpfiff: 80, halbzeit: 0, tor: 100 } });
    render(seite());
    expect(zustandsBanner()).toHaveAttribute('data-zustand', 'bereit');
  });
  it('„Anhören“ bei 0 % spielt nichts und sagt es ruhig', async () => {
    doppel.lautsprecher = eigenerLautsprecher('volume_zero', 'toent', { lautstaerke: { abpfiff: 0, halbzeit: 50, tor: 100 }, hierAnhoeren: vi.fn(() => Promise.resolve(false)) });
    render(seite());
    await klick('regler-abpfiff-anhoeren');
    expect(screen.getByTestId('regler-abpfiff-hinweis')).toHaveTextContent('Bei 0 % ist nichts zu hören.');
  });
  it('läuft gerade ein echter Ton, sagt „Anhören“ das und lässt ihn weiterlaufen', async () => {
    doppel.lautsprecher = eigenerLautsprecher('ready', 'toent', { hierAnhoeren: vi.fn(() => Promise.resolve('belegt' as const)) });
    render(seite());
    await klick('regler-halbzeit-anhoeren');
    expect(screen.getByTestId('regler-halbzeit-hinweis')).toHaveTextContent('Gerade klingt ein echter Ton');
  });
});

describe('@HT-017 Rückfrage bei „Anhören“ am Lautsprecher-Gerät, wenn auf dem Feld ein Spiel läuft', () => {
  const hierAnhoeren = (): ReturnType<typeof vi.fn> => doppel.lautsprecher.hierAnhoeren as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => { doppel.lautsprecher = eigenerLautsprecher('ready'); });

  it('läuft Spiel 11 auf Feld 1 → „Auf Feld 1 läuft Spiel 11. Trotzdem anhören?“, ohne Bestätigen spielt nichts', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('regler-abpfiff-anhoeren');
    expect(screen.getByText('Auf Feld 1 läuft Spiel 11. Trotzdem anhören?')).toBeInTheDocument();
    expect(hierAnhoeren()).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByText(/Trotzdem anhören/)).toBeNull();
    expect(hierAnhoeren()).not.toHaveBeenCalled();
  });
  it('Bestätigen spielt den Ton einmal', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('regler-halbzeit-anhoeren');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anhören' })); await Promise.resolve(); });
    expect(hierAnhoeren()).toHaveBeenCalledTimes(1);
    expect(hierAnhoeren()).toHaveBeenCalledWith('halbzeit');
    expect(screen.queryByText(/Trotzdem anhören/)).toBeNull();
  });
  it('Gegenbeispiel: ohne angepfiffenes Spiel keine Rückfrage, es spielt sofort', async () => {
    render(seite());
    await klick('regler-abpfiff-anhoeren');
    expect(screen.queryByText(/Trotzdem anhören/)).toBeNull();
    expect(hierAnhoeren()).toHaveBeenCalledWith('abpfiff');
  });
  it('Gegenbeispiel: ein Spiel auf einem Feld, für das dieses Gerät nicht tönt (Feld 2) → keine Rückfrage', async () => {
    doppel.laufend = new Map([[2, 12]]);
    render(seite());
    await klick('regler-abpfiff-anhoeren');
    expect(screen.queryByText(/Trotzdem anhören/)).toBeNull();
    expect(hierAnhoeren()).toHaveBeenCalledTimes(1);
  });
  it('Gegenbeispiel: „Hier anhören“ auf Ollis Handy (kein Lautsprecher) bleibt ohne Rückfrage, auch wenn Spiel 11 läuft (Zeile 1)', async () => {
    doppel.lautsprecher = lautsprecherDoppel();
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('testton-hier-anhoeren');
    expect(screen.queryByText(/Trotzdem anhören/)).toBeNull();
    expect(hierAnhoeren()).toHaveBeenCalledWith('abpfiff');
  });
  it('„Hier anhören“ am Lautsprecher-Gerät fragt ebenfalls (es klingt in der Halle)', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('testton-hier-anhoeren');
    expect(screen.getByText('Auf Feld 1 läuft Spiel 11. Trotzdem anhören?')).toBeInTheDocument();
    expect(hierAnhoeren()).not.toHaveBeenCalled();
  });
});

describe('@HT-017 Rückfrage bei „Testton in der Halle“, wenn auf dem Feld ein Spiel läuft', () => {
  beforeEach(() => { setzeServer(voll([{ feld: 1, name: 'Hallenmonitor Halle', state: 'ready' }])); });

  it('bereit, und auf Feld 1 läuft Spiel 11 → „Auf Feld 1 läuft Spiel 11. Testton trotzdem in der Halle spielen?“, ohne Bestätigen kein Auftrag', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('testton-halle-1');
    expect(screen.getByText('Auf Feld 1 läuft Spiel 11. Testton trotzdem in der Halle spielen?')).toBeInTheDocument();
    expect(testtonAnfordern).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(testtonAnfordern).not.toHaveBeenCalled();
    expect(screen.queryByText(/Testton trotzdem/)).toBeNull();
  });
  it('Bestätigen löst den Testton aus', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('testton-halle-1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Testton spielen' })); await Promise.resolve(); });
    expect(testtonAnfordern).toHaveBeenCalledWith(1);
  });
  it('Gegenbeispiel: ohne laufendes Spiel (oder auf einem anderen Feld) fragt nichts, der Testton geht sofort raus', async () => {
    doppel.laufend = new Map([[2, 12]]);
    render(seite());
    await klick('testton-halle-1');
    expect(screen.queryByText(/Testton trotzdem/)).toBeNull();
    expect(testtonAnfordern).toHaveBeenCalledWith(1);
  });
  it('Gegenbeispiel: nicht bereit → keine Rückfrage, sondern der Grund (nichts wird gespielt)', async () => {
    setzeServer(voll([{ feld: 1, name: 'Hallenmonitor Halle', state: 'not_activated' }]));
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('testton-halle-1');
    expect(screen.queryByText(/Testton trotzdem/)).toBeNull();
    expect(testtonAnfordern).not.toHaveBeenCalled();
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht bereit – Ton nicht aktiviert');
  });
});
