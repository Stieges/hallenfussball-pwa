/**
 * H4-11b Verwaltungsseite von @HT-057: „Meldet die Turnierleitung das Gerät ab, sagt der Rechner das“ – hier die Seite von Olli (Unterpunkt „Hallenton“, „Lautsprecher je Feld“):
 * Wenn Olli auf einem anderen Gerät im Unterpunkt „Hallenton“ den Lautsprecher für Feld 1 abmeldet, steht Feld 1 danach bei „kein Hallen-Lautsprecher“ (@HT-016).
 * Erwartungen aus dem Gherkin (@HT-057, @HT-015 als Gegenstück, @HT-016, @HT-022, @HT-046, @HT-041, @HT-017), nicht am Code abgelesen. Die Hooks sind Doppel; der Server-Aufruf ist
 * `meldeLautsprecherAb`; Texte aus den echten deutschen Sprachdateien. Die Seite des abgemeldeten Geräts steht in `runtime/__tests__/abmelden.geraet.h4-11b.test.ts`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { HallFehlerGrund, HallStatusAntwort, HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { lautsprecherLage, type LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
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
  abmelden: vi.fn(),
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => doppel.abgeschlossen }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => doppel.laufend }));
vi.mock('../../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(null) }));
vi.mock('../../hallAbmelden', () => ({ meldeLautsprecherAb: (...a: unknown[]) => doppel.abmelden(...a) }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 15, 14, 2, 30).getTime();
const GERAET = 'Rechner der Turnierleitung';

function voll(felder: ReadonlyArray<{ feld: number; name: string; state?: string; ich?: boolean }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: felder.map((f) => ({
      field: f.feld, deviceName: f.name, isThisDevice: f.ich === true, state: (f.state ?? 'ready') as never, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null,
    })),
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
const setzeServer = (antwort: HallStatusVoll | null, stand: HallStatus['stand'] = 'aktuell'): void => {
  doppel.status = {
    stand, antwort: stand === 'aktuell' ? antwort : null, felder: stand === 'aktuell' && antwort ? lageAus(antwort) : {},
    lautsprecherBekannt: stand === 'unbekannt' || (antwort !== null && antwort.speakers.length > 0), testtonAnfordern: vi.fn(), gehoert: vi.fn(),
  };
};
function lautsprecherDoppel(teil: Partial<HallLautsprecher> = {}): HallLautsprecher {
  return {
    rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null,
    feldAbmelden: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] })),
    ausschalten: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] })),
    tonAktivieren: vi.fn(() => Promise.resolve(true)), abgeloestVerstanden: vi.fn(), angehaltenBestaetigen: vi.fn(),
    hierAnhoeren: vi.fn(() => Promise.resolve(true)), lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 }, setzeLautstaerke: vi.fn(),
    ...teil,
  } as unknown as HallLautsprecher;
}

const seite = () => <HallentonSeite tournamentId="t-sued" felderAnzahl={2} />;
const klick = async (testId: string): Promise<void> => { await act(async () => { fireEvent.click(screen.getByTestId(testId)); await Promise.resolve(); }); };
const dialogKnopf = async (id: 'confirm-dialog-confirm' | 'confirm-dialog-cancel'): Promise<void> => { await klick(id); };
const aufrufe = (): unknown[][] => doppel.abmelden.mock.calls as unknown[][];
const erfolg = () => Promise.resolve({ ok: true as const, status: 'unassigned' as const, fields: [1] });

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false;
  doppel.laufend = new Map();
  doppel.lautsprecher = lautsprecherDoppel();
  doppel.abmelden = vi.fn(erfolg);
  setzeServer(voll([{ feld: 1, name: GERAET }]));
});

describe('@HT-057 Olli meldet den Lautsprecher für Feld 1 auf einem anderen Gerät ab', () => {
  it('Feld 1 hat einen Hallen-Lautsprecher, Feld 2 nicht → nur bei Feld 1 steht „Abmelden“ (@HT-016: Feld ohne Lautsprecher hat keine Aktion)', () => {
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-abmelden')).toHaveTextContent('Abmelden');
    expect(screen.queryByTestId('lautsprecher-feld-2-abmelden')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-2-zustand')).toHaveTextContent('kein Hallen-Lautsprecher');
  });

  it('Tipp auf „Abmelden“ → Rückfrage mit Feld, Gerätename und Folge; noch nichts ist abgemeldet', async () => {
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    expect(screen.getByText('Hallen-Lautsprecher abmelden?')).toBeInTheDocument();
    expect(screen.getByText(/Soll „Rechner der Turnierleitung“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden\?/)).toBeInTheDocument();
    expect(screen.getByText(/Für Feld 1 ertönt danach kein Hallenton, bis ein Gerät wieder eingeschaltet wird\./)).toBeInTheDocument();
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
  });

  it('Gegenbeispiel: Abbrechen der Rückfrage ändert nichts – kein Aufruf, die Karte bleibt „bereit“ mit dem Gerät', async () => {
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-cancel');
    expect(screen.queryByText('Hallen-Lautsprecher abmelden?')).toBeNull();
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent(GERAET);
  });

  it('Bestätigen → der Server wird für genau dieses Turnier und Feld 1 gefragt (nie mit einer Geräte-Kennung); danach zeigt die Karte „kein Hallen-Lautsprecher“ ohne weiteres Warten', async () => {
    doppel.abmelden = vi.fn(() => { setzeServer(voll([])); return erfolg(); }); // der Aufruf liest den Stand sofort neu: Feld 1 hat keinen Lautsprecher mehr
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
    rerender(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('kein Hallen-Lautsprecher');
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden')).toBeNull();
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-fehler')).toBeNull();
  });

  it('auch ein Gerät, das sich nicht meldet („meldet sich nicht“, verlorenes Tablet), lässt sich abmelden', async () => {
    const stumm = voll([{ feld: 1, name: 'Tablet Halle' }]);
    stumm.speakers[0] = { ...stumm.speakers[0], ageMs: 60_000 };
    setzeServer(stumm);
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('meldet sich nicht');
    await klick('lautsprecher-feld-1-abmelden');
    expect(screen.getByText(/Soll „Tablet Halle“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden\?/)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('Gerätenamen stehen nur im Text der Rückfrage, nie in einem Attribut (die Attribute landen in Fehler-Brotkrumen)', async () => {
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    const funde = Array.from(document.querySelectorAll('*')).flatMap((el) => Array.from(el.attributes).filter((a) => a.value.includes(GERAET)).map((a) => `${a.name}=${a.value}`));
    expect(funde).toEqual([]);
  });
});

describe('@HT-017-Muster: läuft auf dem Feld ein Spiel, kommt eine zusätzliche Rückfrage', () => {
  it('Spiel 11 läuft auf Feld 1 → erst „Abmelden?“, dann „Auf Feld 1 läuft Spiel 11. … Trotzdem abmelden? Danach ertönt für dieses Feld kein Abpfiff.“; erst das zweite Ja ruft den Server', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText('Abmelden, obwohl ein Spiel läuft')).toBeInTheDocument();
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 11\. Trotzdem abmelden\? Danach ertönt für dieses Feld kein Abpfiff\./)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('Gegenbeispiel: Abbrechen der zweiten Rückfrage → nichts wird abgemeldet', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    await dialogKnopf('confirm-dialog-cancel');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
  });

  it('Gegenbeispiel: ein Spiel läuft nur auf Feld 2, Feld 1 ohne Spiel → keine zweite Rückfrage', async () => {
    doppel.laufend = new Map([[2, 12]]);
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.queryByText('Abmelden, obwohl ein Spiel läuft')).toBeNull();
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });
});

describe('@HT-022 @HT-046 Rechte und Turnierende', () => {
  it('ohne manageScreens ist keine Aktion sichtbar', () => {
    doppel.darf = false;
    render(seite());
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit'); // lesen bleibt möglich
  });

  it('nach dem Turnierende (abgeschlossen: das Recht gilt „ohne Ausnahme“ nicht mehr) ist die Aktion gesperrt, die Karte bleibt lesbar', () => {
    doppel.darf = false;
    doppel.abgeschlossen = true;
    render(seite());
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent(GERAET);
  });
});

describe('@HT-041 ohne Netz und Fehler vom Server: kein stiller Fehlschlag, der Zustand bleibt', () => {
  it('Verwaltung ohne Netz („Status unbekannt“) → Tipp zeigt „Nicht abgemeldet: kein Netz“ mit „Erneut versuchen“, keine Rückfrage, kein Aufruf', async () => {
    const { rerender } = render(seite());
    setzeServer(null, 'unbekannt');
    rerender(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('Status unbekannt');
    await klick('lautsprecher-feld-1-abmelden');
    expect(screen.queryByText('Hallen-Lautsprecher abmelden?')).toBeNull();
    expect(aufrufe()).toHaveLength(0);
    const hinweis = screen.getByTestId('lautsprecher-feld-1-abmelden-fehler');
    expect(hinweis).toHaveTextContent('Nicht abgemeldet: kein Netz. Der Lautsprecher für Feld 1 ist unverändert.');
    expect(within(hinweis).getByTestId('lautsprecher-feld-1-abmelden-nochmal')).toHaveTextContent('Erneut versuchen');
  });

  it('wieder Netz → „Erneut versuchen“ fragt nicht noch einmal, sondern meldet ab; der Hinweis verschwindet', async () => {
    const { rerender } = render(seite());
    setzeServer(null, 'unbekannt');
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden');
    setzeServer(voll([{ feld: 1, name: GERAET }]));
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden-nochmal');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-fehler')).toBeNull();
  });

  it.each([
    ['kein_recht', 'Nicht abgemeldet: dafür fehlt dir das Recht.', false],
    ['turnier_beendet', 'Nicht abgemeldet: das Turnier ist beendet.', false],
    ['ungueltig', 'Nicht abgemeldet: Feld 1 wurde nicht gefunden.', false],
    ['netz', 'Nicht abgemeldet: kein Netz. Der Lautsprecher für Feld 1 ist unverändert.', true],
    ['antwort_unbekannt', 'Nicht abgemeldet: das hat nicht geklappt. Der Lautsprecher für Feld 1 ist unverändert.', true],
  ] as ReadonlyArray<readonly [HallFehlerGrund, string, boolean]>)('Serverfehler %s → verständlicher Text, die Karte bleibt „bereit“ mit dem Gerät; „Erneut versuchen“ nur, wo es hilft', async (grund, text, nochmal) => {
    doppel.abmelden = vi.fn(() => Promise.resolve({ ok: false as const, grund }));
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toHaveTextContent(text);
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-nochmal') !== null).toBe(nochmal);
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent(GERAET);
  });
});

describe('@HT-057 ist der Lautsprecher DIESES Gerät: der bestehende Weg des Schalters, kein zweiter Weg', () => {
  const eigener = (felder: number[]): HallLautsprecher => lautsprecherDoppel({
    rolle: 'diesesTurnier', felder, name: GERAET,
    laufzeit: { rolle: 'toent', zustandJeFeld: Object.fromEntries(felder.map((f) => [`field-${f}`, 'ready'])), warAngehalten: false } as never,
  });
  const eigenerServer = (felder: number[]): HallStatusVoll => voll(felder.map((feld) => ({ feld, name: GERAET, ich: true })));

  it('zwei Felder, Feld 1 abmelden → `feldAbmelden(1)` des Schalters; der Server-Aufruf für fremde Geräte wird nicht benutzt; die Rückfrage nennt „Das ist dieses Gerät“', async () => {
    doppel.lautsprecher = eigener([1, 2]);
    setzeServer(eigenerServer([1, 2]));
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    expect(screen.getByText(/Das ist dieses Gerät\. Für Feld 1 ertönt danach kein Hallenton, bis du es wieder einschaltest\./)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(doppel.lautsprecher.feldAbmelden).toHaveBeenCalledWith(1);
    expect(doppel.lautsprecher.ausschalten).not.toHaveBeenCalled();
    expect(aufrufe()).toHaveLength(0);
  });

  it('das letzte Feld → `ausschalten()` wie der Schalter „Aus“', async () => {
    doppel.lautsprecher = eigener([1]);
    setzeServer(eigenerServer([1]));
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(doppel.lautsprecher.ausschalten).toHaveBeenCalledTimes(1);
    expect(doppel.lautsprecher.feldAbmelden).not.toHaveBeenCalled();
    expect(aufrufe()).toHaveLength(0);
  });

  it('ohne Netz: dieses Gerät meldet sich lokal sofort ab, die Abmeldung holt es nach (@HT-038) – kein Fehlerhinweis, die Rückfrage kommt auch ohne Netz', async () => {
    doppel.lautsprecher = eigener([1]);
    doppel.lautsprecher = { ...doppel.lautsprecher, ausschalten: vi.fn(() => Promise.resolve({ ok: false as const, grund: 'netz' as const })) };
    setzeServer(null, 'unbekannt');
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(doppel.lautsprecher.ausschalten).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-fehler')).toBeNull();
  });
});
