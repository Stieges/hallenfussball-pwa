/**
 * H4-9 „Dieses Gerät“ (@HT-001, @HT-002, @HT-015, @HT-021, @HT-043, @HT-046): Erwartungen aus dem Gherkin, nicht am Code abgelesen.
 * Die Hooks sind Doppel (Stand am Server, Gerät); Texte aus den echten deutschen Sprachdateien. Kopfzeile (Statuszeile) und
 * Rücksprung nach der Anmeldung (@HT-026) stehen in `hallStatusEintraege.test.tsx` und `loginRueckkehr.test.ts`; das Wechseln
 * des Turniers (@HT-056) in `DiesesGeraet.wechseln.test.tsx`.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import tournamentDe from '../../../../i18n/locales/de/tournament.json';
import type { HallStatusAntwort, HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { lautsprecherLage, type LautsprecherLage } from '../../runtime/hallStatusAuswertung';
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
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => doppel.abgeschlossen }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
const laufendDoppel = vi.hoisted(() => ({ spiele: new Map<number, number>() }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => laufendDoppel.spiele }));
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
const setzeServer = (antwort: HallStatusVoll): void => {
  doppel.status = { stand: 'aktuell', antwort, felder: lageAus(antwort), lautsprecherBekannt: antwort.speakers.length > 0, testtonAnfordern: vi.fn(), gehoert: vi.fn() } as unknown as HallStatus;
};

const zugeordnet = (felder: number[]) => Promise.resolve({ ok: true as const, status: 'assigned' as const, fields: felder, replaced: [] });
function lautsprecherDoppel(teil: Partial<HallLautsprecher> = {}): HallLautsprecher {
  return {
    rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null,
    einschalten: vi.fn((felder: readonly number[]) => zugeordnet([...felder])),
    wechseln: vi.fn((felder: readonly number[]) => zugeordnet([...felder])),
    feldAbmelden: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [2] })),
    ausschalten: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] })),
    tonAktivieren: vi.fn(() => Promise.resolve(true)),
    abgeloestVerstanden: vi.fn(), hierAnhoeren: vi.fn(() => Promise.resolve(true)),
    lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 }, setzeLautstaerke: vi.fn(), angehaltenBestaetigen: vi.fn(),
    ...teil,
  } as unknown as HallLautsprecher;
}
const eigenerLautsprecher = (felder: number[], zustand: 'not_activated' | 'ready' | 'slept', teil: Partial<HallLautsprecher> = {}): HallLautsprecher => lautsprecherDoppel({
  rolle: 'diesesTurnier', felder, name: 'Rechner der Turnierleitung',
  laufzeit: { rolle: zustand === 'ready' ? 'toent' : 'wartet', zustandJeFeld: Object.fromEntries(felder.map((f) => [`field-${f}`, zustand])) } as never,
  ...teil,
});

const seite = () => <HallentonSeite tournamentId="t-nord" felderAnzahl={2} />;
const einschalten = (): ReturnType<typeof vi.fn> => doppel.lautsprecher.einschalten as unknown as ReturnType<typeof vi.fn>;
const klick = async (testId: string): Promise<void> => { await act(async () => { fireEvent.click(screen.getByTestId(testId)); await Promise.resolve(); }); };

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false;
  doppel.lautsprecher = lautsprecherDoppel();
  setzeServer(voll([]));
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('@HT-043 Schritte bis zum ersten Testton', () => {
  it('noch kein Hallen-Lautsprecher → die Schritte in Reihenfolge: App installieren, Schalter, Ton aktivieren, Testton in der Halle', () => {
    render(seite());
    const schritte = screen.getByTestId('hallenton-einrichtung');
    const titel = within(schritte).getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
    expect(titel[0]).toContain('App installieren');
    expect(titel[1]).toContain('Schalter');
    expect(titel[2]).toContain('Ton aktivieren');
    expect(titel[3]).toContain('Testton in der Halle');
    // der Schalter steht in Schritt 2 und trägt den Wortlaut des Records
    expect(within(screen.getByTestId('einrichtung-schritt-2')).getByRole('switch', { name: 'Dieses Gerät ist Hallen-Lautsprecher für Feld …' })).toBeInTheDocument();
    // die Schritte stehen vor den Feldkarten
    expect(schritte.compareDocumentPosition(screen.getByTestId('lautsprecher-feld-1-zustand')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('dazu die Anleitung zum Schlafenlegen mit Adresse zum Kopieren; Chrome und Edge: „Diese Websites immer aktiv lassen“', () => {
    render(seite());
    fireEvent.click(within(screen.getByTestId('hallenton-anleitung')).getByRole('button', { name: /Laptop und Browser einstellen/ }));
    fireEvent.click(screen.getByTestId('anleitung-browser-chrome'));
    expect(screen.getByTestId('anleitung-chrome')).toHaveTextContent('Diese Websites immer aktiv lassen');
    expect(screen.getByTestId('anleitung-einstellung-text')).toHaveTextContent('chrome://settings/performance');
    expect(screen.getByTestId('anleitung-app-kopieren')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('anleitung-browser-edge'));
    expect(screen.getByTestId('anleitung-edge')).toHaveTextContent('Diese Websites immer aktiv lassen');
    expect(screen.getByTestId('anleitung-einstellung-text')).toHaveTextContent('edge://settings/system');
    fireEvent.click(screen.getByTestId('anleitung-browser-safari'));
    expect(screen.getByTestId('anleitung-safari')).toHaveTextContent('Safari');
  });
  it('läuft die App schon installiert, ist „App installieren“ erledigt; Gegenbeispiel: im Browser-Tab nicht', () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: q === '(display-mode: standalone)', media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
    const { unmount } = render(seite());
    expect(screen.getByTestId('einrichtung-schritt-1')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('einrichtung-installiert')).toBeInTheDocument();
    unmount();
    window.matchMedia = vi.fn((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
    render(seite());
    expect(screen.getByTestId('einrichtung-schritt-1')).toHaveAttribute('data-done', 'false');
    expect(screen.queryByTestId('einrichtung-installiert')).toBeNull();
  });
});

describe('@HT-001 Der Rechner der Turnierleitung wird Hallen-Lautsprecher für Feld 1', () => {
  it('Gerätenamen eintragen, Schalter umlegen, Feld 1 wählen → Zuordnung Feld 1 mit dem Namen; Feld 2 bleibt ohne', async () => {
    render(seite());
    fireEvent.change(screen.getByTestId('geraet-name'), { target: { value: 'Rechner der Turnierleitung' } });
    expect(screen.getByTestId('geraet-feld-1')).toBeDisabled(); // Felder erst bei „Ein“ wählbar
    await klick('geraet-schalter-taste');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await klick('geraet-feld-1');
    expect(einschalten()).toHaveBeenCalledTimes(1);
    expect(einschalten()).toHaveBeenCalledWith([1], 'Rechner der Turnierleitung', false);
  });
  it('„Ton aktivieren“ steht als einzige Haupttaste unten, solange der Browser einen Klick braucht; Klick ruft die Aktivierung', async () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'not_activated');
    render(seite());
    const leiste = screen.getByTestId('hallenton-fussleiste');
    expect(within(leiste).getByTestId('ton-aktivieren')).toHaveTextContent('Ton aktivieren');
    expect(document.querySelectorAll('[data-primary]')).toHaveLength(1);
    expect(screen.getByTestId('geraet-banner-tonNichtAktiv')).toHaveTextContent('Grund: Ton nicht aktiviert');
    await klick('ton-aktivieren');
    expect(doppel.lautsprecher.tonAktivieren).toHaveBeenCalledTimes(1);
  });
  it('bereit → Banner „Lautsprecher bereit“ mit Feld und Namen, keine Fußleiste mehr; die Verwaltung nennt Gerät und „bereit“ bei Feld 1', () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'ready');
    setzeServer(voll([{ feld: 1, name: 'Rechner der Turnierleitung', state: 'ready' }]));
    render(seite());
    expect(screen.getByTestId('geraet-banner-bereit')).toHaveTextContent('Lautsprecher bereit');
    expect(screen.getByTestId('geraet-banner-bereit')).toHaveTextContent('Feld 1 · Rechner der Turnierleitung');
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(screen.getByTestId('lautsprecher-feld-1')).toHaveTextContent('Rechner der Turnierleitung');
    expect(screen.getByTestId('lautsprecher-feld-2-zustand')).toHaveTextContent('kein Hallen-Lautsprecher');
  });
  it('Gegenbeispiel: dieses Gerät ist kein Lautsprecher → keine Fußleiste', () => {
    render(seite());
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
  });
  it('Namensänderung wirkt nach dem Verlassen des Felds (gleiche Felder, neuer Name); der Name hat höchstens 60 Zeichen', async () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'ready');
    render(seite());
    const feld = screen.getByTestId('geraet-name');
    expect(feld).toHaveAttribute('maxlength', '60');
    fireEvent.change(feld, { target: { value: 'Laptop Halle' } });
    await act(async () => { fireEvent.blur(feld); await Promise.resolve(); });
    expect(einschalten()).toHaveBeenCalledWith([1], 'Laptop Halle', false);
  });
});

describe('@HT-002 Ein Gerät übernimmt mehrere Felder', () => {
  it('Feld 1 ist schon gewählt, Feld 2 dazu → Zuordnung für Feld 1 und 2 zusammen', async () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'ready');
    render(seite());
    expect(screen.getByTestId('geraet-feld-1')).toHaveAttribute('aria-pressed', 'true');
    await klick('geraet-feld-2');
    expect(einschalten()).toHaveBeenCalledWith([1, 2], 'Rechner der Turnierleitung', false);
  });
  it('banner nennt beide Felder: „Feld 1, 2 · Name“', () => {
    doppel.lautsprecher = eigenerLautsprecher([1, 2], 'ready');
    render(seite());
    expect(screen.getByTestId('geraet-banner-bereit')).toHaveTextContent('Feld 1, 2 · Rechner der Turnierleitung');
  });
  it('Gegenbeispiel: ein Feld abwählen, das andere bleibt → nur dieses Feld wird abgemeldet, nicht das Gerät', async () => {
    doppel.lautsprecher = eigenerLautsprecher([1, 2], 'ready');
    render(seite());
    await klick('geraet-feld-2');
    expect(doppel.lautsprecher.feldAbmelden).toHaveBeenCalledWith(2);
    expect(doppel.lautsprecher.ausschalten).not.toHaveBeenCalled();
  });
  it('das letzte Feld abwählen oder „Aus“ → das Gerät ist kein Hallen-Lautsprecher mehr', async () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'ready');
    const { unmount } = render(seite());
    await klick('geraet-feld-1');
    expect(doppel.lautsprecher.ausschalten).toHaveBeenCalledTimes(1);
    unmount();
    doppel.lautsprecher = eigenerLautsprecher([1], 'ready');
    render(seite());
    await klick('geraet-schalter-taste');
    expect(doppel.lautsprecher.ausschalten).toHaveBeenCalledTimes(1);
  });
});

describe('@HT-015 Ein zweites Gerät für dasselbe Feld löst das erste ab', () => {
  const belegt = (): void => {
    doppel.lautsprecher = lautsprecherDoppel({
      einschalten: vi.fn((_f: readonly number[], _n: string, abloesen?: boolean) => Promise.resolve(abloesen === true
        ? { ok: true as const, status: 'assigned' as const, fields: [1], replaced: [{ field: 1, deviceName: 'Rechner der Turnierleitung' }] }
        : { ok: true as const, status: 'occupied' as const, fields: [{ field: 1, deviceName: 'Rechner der Turnierleitung' }] })),
    });
    setzeServer(voll([{ feld: 1, name: 'Rechner der Turnierleitung', state: 'ready' }]));
  };
  it('Schalter umlegen, Feld 1 wählen → Frage „Feld 1 hat schon einen Hallen-Lautsprecher (Rechner der Turnierleitung). Ablösen?“', async () => {
    belegt();
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    expect(screen.getByText(/Feld 1 hat schon einen Hallen-Lautsprecher \(Rechner der Turnierleitung\)\. Ablösen\?/)).toBeInTheDocument();
    expect(einschalten()).toHaveBeenCalledTimes(1);
  });
  it('bestätigen → zweiter Aufruf mit Ablösen', async () => {
    belegt();
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ablösen' })); await Promise.resolve(); });
    expect(einschalten()).toHaveBeenCalledTimes(2);
    expect(einschalten()).toHaveBeenLastCalledWith([1], expect.any(String), true);
    expect(screen.queryByText(/Ablösen\?/)).toBeNull();
  });
  it('Gegenbeispiel: abbrechen ändert nichts – kein zweiter Aufruf, Frage weg', async () => {
    belegt();
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); await Promise.resolve(); });
    expect(einschalten()).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Ablösen\?/)).toBeNull();
  });
  it('auf dem alten Gerät steht „Feld 1 von einem anderen Gerät übernommen“, ohne Knopf zum Zurückholen', () => {
    doppel.lautsprecher = lautsprecherDoppel({ abgeloest: { felder: [{ feld: 1, art: 'abgeloest' }], um: SERVER_JETZT } });
    setzeServer(voll([{ feld: 1, name: 'Hallenmonitor Halle', state: 'ready' }]));
    render(seite());
    const banner = screen.getByTestId('geraet-banner-uebernommen');
    expect(banner).toHaveTextContent('Feld 1 von einem anderen Gerät übernommen');
    expect(banner).toHaveTextContent('Hallenmonitor Halle gibt jetzt den Ton für Feld 1');
    expect(within(banner).queryByRole('button', { name: /zurück|wieder übernehmen/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /zurückholen|wieder übernehmen/i })).toBeNull();
    // der Schalter steht auf „Aus“; „Verstanden“ nimmt nur die Meldung weg
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('geraet-verstanden'));
    expect(doppel.lautsprecher.abgeloestVerstanden).toHaveBeenCalledTimes(1);
  });
  it('soll es wieder tönen, legt Olli dort den Schalter für Feld 1 wie beim ersten Mal um', async () => {
    doppel.lautsprecher = lautsprecherDoppel({ abgeloest: { felder: [{ feld: 1, art: 'abgeloest' }], um: SERVER_JETZT } });
    setzeServer(voll([{ feld: 1, name: 'Hallenmonitor Halle', state: 'ready' }]));
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    expect(einschalten()).toHaveBeenCalledWith([1], expect.any(String), false);
  });
  it('@HT-057 abgemeldet: eigener Wortlaut, nicht „übernommen“', () => {
    doppel.lautsprecher = lautsprecherDoppel({ abgeloest: { felder: [{ feld: 1, art: 'abgemeldet' }], um: SERVER_JETZT } });
    render(seite());
    expect(screen.getByTestId('geraet-banner-abgemeldet')).toHaveTextContent('Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld 1 abgemeldet.');
    expect(screen.queryByTestId('geraet-banner-uebernommen')).toBeNull();
  });
});

describe('B1 Installations-Angebot nur im Unterpunkt', () => {
  it('der Unterpunkt hält das Angebot des Browsers zurück, solange er offen ist; danach nicht mehr', () => {
    const ereignis = (): Event => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    const { unmount } = render(seite());
    const offen = ereignis();
    act(() => { window.dispatchEvent(offen); });
    expect(offen.defaultPrevented).toBe(true);
    expect(screen.getByTestId('einrichtung-installieren')).toBeInTheDocument(); // Taste, weil das Angebot da ist
    unmount();
    const zu = ereignis();
    act(() => { window.dispatchEvent(zu); });
    expect(zu.defaultPrevented).toBe(false);
  });
});

describe('B5 Abbrechen setzt den Schalter zurück', () => {
  it('Ablösen abbrechen: Schalter wieder „Aus“, nichts gewählt', async () => {
    doppel.lautsprecher = lautsprecherDoppel({
      einschalten: vi.fn(() => Promise.resolve({ ok: true as const, status: 'occupied' as const, fields: [{ field: 1, deviceName: 'Hallenmonitor Halle' }] })),
    });
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); await Promise.resolve(); });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('geraet-feld-1')).toBeDisabled();
  });
});

describe('@HT-021 Handy: Hinweis, aber keine Sperre', () => {
  const kennung = (ua: string): void => { vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua); };
  it('auf einem Handy steht der Hinweis, und Schalter, Felder und „Ton aktivieren“ bleiben benutzbar', async () => {
    kennung('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1');
    render(seite());
    expect(screen.getByTestId('geraet-handy-hinweis')).toHaveTextContent('Ein Handy ist als Hallen-Lautsprecher meist zu leise und schaltet sich ab – besser einen Rechner an der Hallenanlage');
    expect(screen.getByTestId('geraet-schalter-taste')).toBeEnabled();
    await klick('geraet-schalter-taste');
    expect(screen.getByTestId('geraet-feld-1')).toBeEnabled();
    await klick('geraet-feld-1');
    expect(einschalten()).toHaveBeenCalledTimes(1);
  });
  it('ohne Namen am Handy gilt der Standardname „Handy“ (kein Tippen nötig)', async () => {
    kennung('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36');
    render(seite());
    expect(screen.getByTestId('geraet-name')).toHaveValue('Handy');
  });
  it('Gegenbeispiel: auf einem Rechner kein Hinweis', () => {
    kennung('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15');
    render(seite());
    expect(screen.queryByTestId('geraet-handy-hinweis')).toBeNull();
    expect(screen.getByTestId('geraet-name')).toHaveValue('Laptop');
  });
});

describe('@HT-046 nach dem Turnierende: lesbar, nichts änderbar', () => {
  beforeEach(() => { doppel.darf = false; doppel.abgeschlossen = true; });
  it('Hinweis „lässt sich nicht mehr zum Hallen-Lautsprecher machen“, kein Schalter, keine Felder, kein Gerätename, keine Fußleiste', () => {
    doppel.lautsprecher = eigenerLautsprecher([1], 'not_activated');
    render(seite());
    expect(screen.getByTestId('geraet-gesperrt')).toHaveTextContent('Nach dem Turnierende lässt sich dieses Gerät nicht mehr zum Hallen-Lautsprecher machen.');
    expect(screen.queryByTestId('geraet-schalter-taste')).toBeNull(); // der Schalter „Hallen-Lautsprecher“
    expect(screen.queryByTestId('geraet-feld-1')).toBeNull();
    expect(screen.queryByTestId('geraet-name')).toBeNull();
    expect(screen.queryByTestId('hallenton-fussleiste')).toBeNull();
  });
  it('Gegenbeispiel: laufendes Turnier mit Recht → Schalter da', () => {
    doppel.darf = true; doppel.abgeschlossen = false;
    render(seite());
    expect(screen.getByTestId('geraet-schalter-taste')).toBeInTheDocument();
  });
});

describe('Fehler bei der Zuordnung', () => {
  it('kein Netz → Meldung „kein Netz, nichts geändert“, kein Wechsel des Zustands', async () => {
    doppel.lautsprecher = lautsprecherDoppel({ einschalten: vi.fn(() => Promise.resolve({ ok: false as const, grund: 'netz' as const })) });
    render(seite());
    await klick('geraet-schalter-taste');
    await klick('geraet-feld-1');
    expect(screen.getByTestId('geraet-fehler')).toHaveTextContent('kein Netz');
  });
});
