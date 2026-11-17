/**
 * H4-11b Verwaltungsseite von @HT-057: „Meldet die Turnierleitung das Gerät ab, sagt der Rechner das“ – hier die Seite von Olli (Unterpunkt „Hallenton“, „Lautsprecher je Feld“):
 * Wenn Olli auf einem anderen Gerät im Unterpunkt „Hallenton“ den Lautsprecher für Feld 1 abmeldet, steht Feld 1 danach bei „kein Hallen-Lautsprecher“ (@HT-016).
 * Erwartungen aus dem Gherkin (@HT-057, @HT-015 als Gegenstück, @HT-016, @HT-022, @HT-046, @HT-041, @HT-017), nicht am Code abgelesen. Die Hooks sind Doppel; der Server-Aufruf ist
 * `meldeLautsprecherAb`; Texte aus den echten deutschen Sprachdateien. Die Seite des abgemeldeten Geräts steht in `runtime/__tests__/abmelden.geraet.h4-11b.test.ts`.
 */
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { useLautsprecherAbmelden } from '../useLautsprecherAbmelden';
import { ABMELDEN_SPERRZEIT_MS } from '../AbmeldenDialog';

const SERVER_JETZT = new Date(2026, 10, 15, 14, 2, 30).getTime();
const GERAET = 'Rechner der Turnierleitung';

function voll(felder: ReadonlyArray<{ feld: number; name: string; state?: string; ich?: boolean; seit?: number }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: felder.map((f) => ({
      field: f.feld, deviceName: f.name, isThisDevice: f.ich === true, state: (f.state ?? 'ready') as never, assignedAt: f.seit ?? 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null,
    })),
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
// Wie die geteilte Abfrage: die letzten Lautsprecher bleiben ohne Netz stehen (@HT-041)
let zuletztSprecher: HallStatusVoll['speakers'] = [];
const merkeSprecher = (antwort: HallStatusVoll | null): HallStatusVoll['speakers'] => { if (antwort !== null) { zuletztSprecher = antwort.speakers; } return zuletztSprecher; };
const setzeServer = (antwort: HallStatusVoll | null, stand: HallStatus['stand'] = 'aktuell'): void => {
  doppel.status = {
    stand, antwort: stand === 'aktuell' ? antwort : null, felder: stand === 'aktuell' && antwort ? lageAus(antwort) : {},
    lautsprecherBekannt: stand === 'unbekannt' || (antwort !== null && antwort.speakers.length > 0), letzteSprecher: merkeSprecher(antwort), testtonAnfordern: vi.fn(), gehoert: vi.fn(),
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
/** Die Bestätigung der zweiten Rückfrage nimmt erst nach der Sperrzeit Tipps an (B); die Hilfe wartet sie auf der Fake-Uhr ab. */
const dialogKnopf = async (id: 'confirm-dialog-confirm' | 'confirm-dialog-cancel'): Promise<void> => {
  if (id === 'confirm-dialog-confirm' && screen.getByTestId(id).getAttribute('aria-disabled') === 'true') {
    await act(async () => { vi.advanceTimersByTime(ABMELDEN_SPERRZEIT_MS); await Promise.resolve(); });
  }
  await klick(id);
};
const aufrufe = (): unknown[][] => doppel.abmelden.mock.calls as unknown[][];
const erfolg = () => Promise.resolve({ ok: true as const, status: 'unassigned' as const, fields: [1] });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true }); // die Sperrzeit der zweiten Rückfrage läuft auf der Fake-Uhr
  doppel.darf = true; doppel.abgeschlossen = false;
  doppel.laufend = new Map();
  doppel.lautsprecher = lautsprecherDoppel();
  doppel.abmelden = vi.fn(erfolg);
  setzeServer(voll([{ feld: 1, name: GERAET }]));
});

afterEach(() => { vi.useRealTimers(); });

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
  it('Spiel 11 läuft auf Feld 1 → erst „Abmelden?“, dann die zweite Rückfrage mit Feld, Spiel und Gerätename („… trotzdem als Hallen-Lautsprecher abmelden? Danach ertönt für Feld 1 kein Abpfiff.“); erst das zweite Ja ruft den Server', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText('Abmelden, obwohl ein Spiel läuft')).toBeInTheDocument();
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 11\. „Rechner der Turnierleitung“ trotzdem als Hallen-Lautsprecher abmelden\? Danach ertönt für Feld 1 kein Abpfiff\./)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Trotzdem abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('Durchtippen verhindert (@OB-014): die zweite Rückfrage ist ein Gefahr-Dialog – der Fokus liegt auch nach der Anlaufzeit des Dialogs auf „Abbrechen“, Enter löst nichts aus', async () => {
    doppel.laufend = new Map([[1, 11]]);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    await act(async () => { vi.advanceTimersByTime(ABMELDEN_SPERRZEIT_MS + 200); await Promise.resolve(); }); // der Bestätigen-Dialog würde seinen Knopf nach 50 ms fokussieren
    expect(document.activeElement).toBe(screen.getByTestId('confirm-dialog-cancel'));
    expect(document.activeElement).not.toBe(screen.getByTestId('confirm-dialog-confirm'));
    await user.keyboard('{Enter}');
    expect(aufrufe()).toHaveLength(0);
  });

  it('Doppeltipp am Handy (Fixrunde 2): die Bestätigung der zweiten Rückfrage ist anfangs gesperrt (abgeblendet, aria-disabled): ein Tipp nach 100 ms löst nichts aus, „Abbrechen“ geht sofort, nach der Sperrzeit löst der Tipp aus; Enter löst nie aus', async () => {
    doppel.laufend = new Map([[1, 11]]);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm'); // erste Rückfrage
    const ja = screen.getByTestId('confirm-dialog-confirm');
    expect(ja).toHaveAttribute('aria-disabled', 'true');
    await act(async () => { vi.advanceTimersByTime(100); });
    fireEvent.click(ja); // der zweite Tipp des Doppeltipps
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText('Abmelden, obwohl ein Spiel läuft')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(aufrufe()).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(ABMELDEN_SPERRZEIT_MS); });
    expect(screen.getByTestId('confirm-dialog-confirm')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('„Abbrechen“ der zweiten Rückfrage ist von Anfang an bedienbar (Gegenbeispiel: nur die Bestätigung ist gesperrt)', async () => {
    doppel.laufend = new Map([[1, 11]]);
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.getByTestId('confirm-dialog-cancel')).not.toHaveAttribute('aria-disabled');
    await klick('confirm-dialog-cancel');
    expect(screen.queryByText('Abmelden, obwohl ein Spiel läuft')).toBeNull();
    expect(aufrufe()).toHaveLength(0);
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

  it('Gegenbeispiel: wieder Netz → „Erneut versuchen“ meldet NICHT direkt ab, sondern öffnet wieder die Rückfrage; ohne bestätigte Rückfrage kein Aufruf', async () => {
    const { rerender } = render(seite());
    setzeServer(null, 'unbekannt');
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden');
    setzeServer(voll([{ feld: 1, name: GERAET }]));
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden-nochmal');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText('Hallen-Lautsprecher abmelden?')).toBeInTheDocument();
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-fehler')).toBeNull();
    await dialogKnopf('confirm-dialog-cancel');
    expect(aufrufe()).toHaveLength(0);
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('Gegenbeispiel: nach einem Serverfehler fragt „Erneut versuchen“ wieder – beginnt dazwischen ein Spiel, kommt auch die zweite Rückfrage', async () => {
    doppel.abmelden = vi.fn(() => Promise.resolve({ ok: false as const, grund: 'netz' as const }));
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(1);
    doppel.laufend = new Map([[1, 11]]); // Spiel 11 wird angepfiffen
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden-nochmal');
    expect(aufrufe()).toHaveLength(1); // noch nichts abgesendet
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.getByText('Abmelden, obwohl ein Spiel läuft')).toBeInTheDocument();
    expect(aufrufe()).toHaveLength(1);
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(2);
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

describe('Das richtige Gerät: der Stand der Rückfrage gilt nur, solange er der aktuelle ist (Fixrunde 1)', () => {
  const B = 'Tablet Halle';

  it('Gerät B übernimmt das Feld bei offener ERSTER Rückfrage → das Ja ruft nichts auf, die Rückfrage öffnet sich neu und nennt B; erst deren Ja meldet ab', async () => {
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    expect(screen.getByText(/„Rechner der Turnierleitung“ als Hallen-Lautsprecher/)).toBeInTheDocument();
    setzeServer(voll([{ feld: 1, name: B }]));
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText(/Soll „Tablet Halle“ als Hallen-Lautsprecher für Feld 1 abgemeldet werden\?/)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('dasselbe bei offener ZWEITER Rückfrage (Spiel läuft) → kein Aufruf, die erste Rückfrage kommt mit B wieder, danach wieder die zweite mit B', async () => {
    doppel.laufend = new Map([[1, 11]]);
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 11\. „Rechner der Turnierleitung“/)).toBeInTheDocument();
    setzeServer(voll([{ feld: 1, name: B }]));
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText(/Soll „Tablet Halle“ als Hallen-Lautsprecher/)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 11\. „Tablet Halle“/)).toBeInTheDocument();
    expect(aufrufe()).toHaveLength(0);
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('läuft bei offener zweiter Rückfrage inzwischen ein anderes Spiel, nennt die Rückfrage das neue Spiel und ruft noch nichts auf', async () => {
    doppel.laufend = new Map([[1, 11]]);
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    doppel.laufend = new Map([[1, 12]]);
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 12\./)).toBeInTheDocument();
  });

  it('der Lautsprecher ist inzwischen weg (jemand anderes hat ihn abgemeldet) → das Ja ruft nichts auf, die Rückfrage schließt sich, ein Hinweis sagt es', async () => {
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    setzeServer(voll([]));
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.queryByText('Hallen-Lautsprecher abmelden?')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('kein Hallen-Lautsprecher');
    expect(screen.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toHaveTextContent('Nicht abgemeldet: für Feld 1 gibt es inzwischen keinen Hallen-Lautsprecher mehr.');
    expect(screen.queryByTestId('lautsprecher-feld-1-abmelden-nochmal')).toBeNull();
  });

  it('gleichnamiges Gerät übernimmt bei offener Rückfrage (gleicher Name, neue Zuordnung) → kein Aufruf, die Rückfrage öffnet sich neu; erst deren Ja meldet ab', async () => {
    setzeServer(voll([{ feld: 1, name: 'iPad', seit: 1 }]));
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    setzeServer(voll([{ feld: 1, name: 'iPad', seit: 2 }])); // ein anderes „iPad“ hat das Feld übernommen
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText(/Soll „iPad“ als Hallen-Lautsprecher/)).toBeInTheDocument();
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });

  it('Gegenbeispiel: der Zeitpunkt der Zuordnung steht in keinem Attribut und nirgends im Text', async () => {
    setzeServer(voll([{ feld: 1, name: 'iPad', seit: 1_794_123_456_789 }]));
    render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    expect(document.body.innerHTML).not.toContain('1794123456789');
  });

  it('der Stand ist zwischen Frage und Ja nicht mehr aktuell lesbar (kein Netz) → kein Aufruf, Hinweis „kein Netz“ mit „Erneut versuchen“, das wieder über die Rückfrage führt', async () => {
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    setzeServer(null, 'unbekannt');
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.queryByText('Hallen-Lautsprecher abmelden?')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-abmelden-fehler')).toHaveTextContent('Nicht abgemeldet: kein Netz.');
    setzeServer(voll([{ feld: 1, name: GERAET }]));
    rerender(seite());
    await klick('lautsprecher-feld-1-abmelden-nochmal');
    expect(aufrufe()).toHaveLength(0);
    expect(screen.getByText('Hallen-Lautsprecher abmelden?')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ändert sich nichts (kein zusätzliches Nachfragen)', async () => {
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    rerender(seite());
    await dialogKnopf('confirm-dialog-confirm');
    expect(aufrufe()).toEqual([['t-sued', 1]]);
  });
});

describe('Ergebnis nach dem Abmelden (Fixrunde 1)', () => {
  it('der einzige Lautsprecher wurde abgemeldet → nicht „Noch kein Hallen-Lautsprecher eingerichtet“, sondern die Bestätigung „Feld 1 abgemeldet – kein Hallen-Lautsprecher“ an der Karte', async () => {
    doppel.abmelden = vi.fn(() => { setzeServer(voll([])); return erfolg(); });
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    rerender(seite());
    expect(screen.queryByTestId('hallenton-felder-leer')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-abgemeldet')).toHaveTextContent('Feld 1 abgemeldet – kein Hallen-Lautsprecher');
  });

  it('Gegenbeispiel: wurde nie ein Lautsprecher bekannt, steht der Satz „Noch kein Hallen-Lautsprecher eingerichtet …“ weiter da, ohne Bestätigung', () => {
    setzeServer(voll([]));
    render(seite());
    expect(screen.getByTestId('hallenton-felder-leer')).toHaveTextContent('Noch kein Hallen-Lautsprecher eingerichtet');
    expect(screen.queryByTestId('lautsprecher-feld-1-abgemeldet')).toBeNull();
  });

  it('die Bestätigung verschwindet, sobald das Feld wieder einen Lautsprecher hat (der Stand wechselt)', async () => {
    doppel.abmelden = vi.fn(() => { setzeServer(voll([])); return erfolg(); });
    const { rerender } = render(seite());
    await klick('lautsprecher-feld-1-abmelden');
    await dialogKnopf('confirm-dialog-confirm');
    rerender(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-abgemeldet')).toBeInTheDocument();
    setzeServer(voll([{ feld: 1, name: 'Tablet Halle' }]));
    rerender(seite());
    expect(screen.queryByTestId('lautsprecher-feld-1-abgemeldet')).toBeNull();
  });
});

describe('Fixrunde 1 klein: kein Recht am Server (`stand` kein_recht)', () => {
  it('die Taste wird gar nicht angeboten (statt eines falschen „kein Netz“)', () => {
    const karte = { feld: 1, zustand: { art: 'bereit' }, geraet: { name: GERAET, art: 'laptop' }, pruefen: false, hupeStattEigenerTon: false, anderesFenster: false, eigenesGeraet: false } as never;
    const eingabe = (stand: 'aktuell' | 'kein_recht') => ({ tournamentId: 't', karten: [karte], stand, darfAendern: true, lautsprecher: doppel.lautsprecher, laufendeSpiele: new Map<number, number>() });
    expect(renderHook(() => useLautsprecherAbmelden(eingabe('kein_recht'))).result.current.anbieten(karte)).toBe(false);
    expect(renderHook(() => useLautsprecherAbmelden(eingabe('aktuell'))).result.current.anbieten(karte)).toBe(true);
  });
});
