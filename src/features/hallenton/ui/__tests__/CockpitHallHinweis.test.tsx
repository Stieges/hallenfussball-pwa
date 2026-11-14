/**
 * H4-12 Cockpit-Hinweise zum Hallenton (Oberfläche): Wortlaute aus dem Record, die Zeilen der Gründe (@HT-039 Spalte Cockpit), Gegenbeispiele
 * (kein Lautsprecher, bereit, keine Zeile bei fremdem Spiel) und die Zeile zur Uhr vor dem Anpfiff (@HT-036). Zustand aus den echten Funktionen
 * (`cockpitHinweisAusLeitung` über die echte Leitung des Moduls), nur die Zeit und der Server-Stand sind von Hand.
 */
import { Profiler } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { CockpitZustand } from '../../../../components/live-cockpit/model/cockpitPhase';
import type { HallStatus } from '../../useHallStatus';
import type { LeitungLebenszeichen, LeitungStand } from '../../runtime/leitungLebenszeichen';

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
const status = vi.hoisted(() => ({ wert: null as unknown as HallStatus, gelesen: 0 }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => { status.gelesen += 1; return status.wert; } }));
const uhr = vi.hoisted(() => ({ abgeglichen: true }));
vi.mock('../../useUhrAbgeglichen', () => ({ useUhrAbgeglichen: () => uhr.abgeglichen }));

import { setzeLeitung } from '../../leitungGeraet';
import { CockpitHallHinweis } from '../CockpitHallHinweis';

const TID = 'tour-1';
const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const GRUND_KASTEN = 'cockpit-hall-aus';

function leitung(stand: LeitungStand | null, o: { gescheitert?: boolean; jetzt?: number } = {}): LeitungLebenszeichen {
  return {
    start: vi.fn(), stop: vi.fn(), stand: () => stand, versuchGescheitert: () => o.gescheitert ?? false, version: () => 1,
    jetzt: () => o.jetzt ?? 1000, subscribe: () => () => undefined,
  };
}
const stand = (speaker: LeitungStand['speaker']): LeitungStand => ({ status: 'ok', speaker, serverNow: SERVER_JETZT, empfangenUm: 900 });
const lautsprecher = (state: 'ready' | 'not_activated' | 'background' | 'slept' | 'volume_zero' | 'custom_sound_failed', o: { ageMs?: number; hint?: boolean } = {}) =>
  stand({ state, ageMs: o.ageMs ?? 2000, outputHint: o.hint ?? false });

function zeige(o: { zustand?: CockpitZustand; feldId?: string | null; kannSteuern?: boolean } = {}) {
  return render(<CockpitHallHinweis tournamentId={TID} feldId={o.feldId === undefined ? 'field-1' : o.feldId} zustand={o.zustand ?? 'laeuft'} kannSteuern={o.kannSteuern ?? true} />);
}
const serverStand = (felder: HallStatus['felder'], stand: HallStatus['stand'] = 'aktuell'): void => { status.wert = { ...status.wert, stand, felder }; };

beforeEach(() => {
  uhr.abgeglichen = true;
  status.gelesen = 0;
  status.wert = { stand: 'aktuell', antwort: null, felder: { 1: { art: 'bereit', pruefen: false } }, lautsprecherBekannt: true, testtonAnfordern: vi.fn(), gehoert: vi.fn() };
});
afterEach(() => { setzeLeitung(null); });

describe('@HT-039 Spalte Cockpit – Kasten „Hallen-Lautsprecher aus – Ende selbst anzeigen“ mit „Grund: …“', () => {
  const FAELLE: Array<[string, LeitungStand, string]> = [
    ['Ton nicht aktiviert', lautsprecher('not_activated'), 'Grund: Ton nicht aktiviert'],
    ['Hintergrund', lautsprecher('background'), 'Grund: Hintergrund'],
    ['schlafen gelegt', lautsprecher('slept'), 'Grund: schlafen gelegt'],
    ['Lautstärke 0 %', lautsprecher('volume_zero'), 'Grund: Lautstärke 0 %'],
  ];
  for (const [name, s, grund] of FAELLE) {
    it(`${name}: Titel und „${grund}“`, () => {
      setzeLeitung(leitung(s));
      zeige();
      const kasten = screen.getByTestId(GRUND_KASTEN);
      expect(kasten).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
      expect(kasten).toHaveTextContent(grund);
    });
  }

  it('@HT-040 meldet sich der Rechner nicht mehr: „Grund: meldet sich nicht (zuletzt <Uhrzeit>)“ mit der Uhrzeit vom Server', () => {
    setzeLeitung(leitung(lautsprecher('ready', { ageMs: 12_000 })));
    zeige();
    const zuletzt = new Intl.DateTimeFormat('de', { hour: '2-digit', minute: '2-digit', hour12: false }).format(SERVER_JETZT - 12_000);
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent(`Grund: meldet sich nicht (zuletzt ${zuletzt})`);
  });

  it('ein unbekannter Zustand des Servers: nur die Zeile, kein Wortgrund', () => {
    setzeLeitung(leitung(stand({ state: 'zustandUnbekannt', ageMs: 1000, outputHint: false })));
    zeige();
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
    expect(screen.getByTestId(GRUND_KASTEN)).not.toHaveTextContent('Grund:');
  });

  it('@HT-040 meldet sich der Rechner wieder bereit, ist der Kasten weg', () => {
    setzeLeitung(leitung(lautsprecher('not_activated')));
    const { rerender } = zeige();
    expect(screen.getByTestId(GRUND_KASTEN)).toBeInTheDocument();
    act(() => { setzeLeitung(leitung(lautsprecher('ready'))); });
    rerender(<CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand="laeuft" kannSteuern />);
    expect(screen.queryByTestId(GRUND_KASTEN)).toBeNull();
  });

  it('@HT-028 „eigener Ton nicht geladen“: kein Cockpit-Hinweis (die Halle hört „Hupe 1“)', () => {
    setzeLeitung(leitung(lautsprecher('custom_sound_failed')));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });
});

describe('@HT-034 @HT-035 @HT-033 Zeile 11 – „Kein Netz – Halle zeigt alten Stand“', () => {
  it('die letzte Antwort ist älter als 15 s (kein Netz am Handy) → genau dieser Wortlaut', () => {
    setzeLeitung(leitung(lautsprecher('ready'), { jetzt: 900 + 15_001 }));
    zeige();
    expect(screen.getByTestId('cockpit-hall-kein-netz')).toHaveTextContent('Kein Netz – Halle zeigt alten Stand');
  });

  it('der letzte Versuch scheiterte am Netz → der Kasten steht sofort, ohne die 15 s', () => {
    setzeLeitung(leitung(lautsprecher('ready'), { gescheitert: true }));
    zeige();
    expect(screen.getByTestId('cockpit-hall-kein-netz')).toBeInTheDocument();
  });
});

describe('@HT-050 „🔈? Hallenton-Ausgang geändert“ – ruhig, ohne Testton-Taste', () => {
  it('bereit mit Hinweis → die ruhige Zeile, keine Taste, keine Störung', () => {
    setzeLeitung(leitung(lautsprecher('ready', { hint: true })));
    zeige();
    const zeile = screen.getByTestId('cockpit-hall-ausgang-geaendert');
    expect(zeile).toHaveTextContent('Hallenton-Ausgang geändert');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId(GRUND_KASTEN)).toBeNull();
  });

  it('Gegenbeispiel: ohne Lebenszeichen der Leitung (auf dem Feld läuft kein Spiel) keinen Hinweis', () => {
    setzeLeitung(leitung(null));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });
});

describe('@HT-016 @HT-038 ohne eingerichteten Lautsprecher zeigt das Cockpit nichts', () => {
  it('Feld ohne Lautsprecher (Antwort ohne Lautsprecher) → kein Kasten', () => {
    setzeLeitung(leitung(stand(null), { jetzt: 900 + 60_000, gescheitert: true }));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('bereit ohne Hinweis → kein Kasten', () => {
    setzeLeitung(leitung(lautsprecher('ready')));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('ein Spiel ohne Feld → kein Kasten', () => {
    setzeLeitung(leitung(lautsprecher('not_activated')));
    zeige({ feldId: null });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });
});

describe('@HT-036 „Uhr nicht abgeglichen – Hallenton kann abweichen“ vor dem Anpfiff', () => {
  it('Uhr noch nie abgeglichen, Spiel nicht angepfiffen, Lautsprecher am Feld → der Hinweis', () => {
    uhr.abgeglichen = false;
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.getByTestId('cockpit-hall-uhr')).toHaveTextContent('Uhr nicht abgeglichen – Hallenton kann abweichen');
  });

  it('ist die Uhr abgeglichen, erscheint der Hinweis nicht', () => {
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Gegenbeispiel: nach dem Anpfiff steht die Zeile zur Uhr nicht mehr', () => {
    uhr.abgeglichen = false;
    zeige({ zustand: 'laeuft' });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Gegenbeispiel @HT-038: Feld ohne Lautsprecher oder ohne Antwort des Servers → kein Hinweis zum Hallenton', () => {
    uhr.abgeglichen = false;
    status.wert = { ...status.wert, felder: {} };
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
    status.wert = { ...status.wert, stand: 'laedt' };
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Hinweis und Störung stehen zugleich untereinander', () => {
    uhr.abgeglichen = false;
    setzeLeitung(leitung(lautsprecher('not_activated')));
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-hall-uhr')).toBeInTheDocument();
  });
});

describe('@HT-039 Kasten schon vor dem Anpfiff – aus dem Server-Stand, solange die Leitung noch keinen Stand hat', () => {
  const GRUENDE: Array<[string, HallStatus['felder'][number], string]> = [
    ['Ton nicht aktiviert', { art: 'nichtBereit', grund: 'not_activated', pruefen: false }, 'Grund: Ton nicht aktiviert'],
    ['Hintergrund', { art: 'nichtBereit', grund: 'background', pruefen: false }, 'Grund: Hintergrund'],
    ['schlafen gelegt', { art: 'nichtBereit', grund: 'slept', pruefen: false }, 'Grund: schlafen gelegt'],
    ['Lautstärke 0 %', { art: 'nichtBereit', grund: 'volume_zero', pruefen: false }, 'Grund: Lautstärke 0 %'],
  ];
  for (const [name, lage, grund] of GRUENDE) {
    it(`vor dem Anpfiff, ${name}: Titel und „${grund}“ – Kopfzeile und Cockpit zeigen es schon vor dem Anpfiff`, () => {
      serverStand({ 1: lage });
      zeige({ zustand: 'vorAnpfiff' });
      const kasten = screen.getByTestId(GRUND_KASTEN);
      expect(kasten).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
      expect(kasten).toHaveTextContent(grund);
    });
  }

  it('vor dem Anpfiff, meldet sich nicht: „Grund: meldet sich nicht (zuletzt 14:02)“ mit der Serverzeit', () => {
    serverStand({ 1: { art: 'meldetSichNicht', zuletztServerMs: new Date(2026, 10, 21, 14, 2).getTime() } });
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Grund: meldet sich nicht (zuletzt 14:02)');
  });

  it.todo('@HT-039 „Ausgang verloren“ und „Ausgang bestätigen“ als Grund im Kasten – wartet auf H4-11 (der Server kennt die Zustände noch nicht)');

  it('@HT-039 pfeift Tom trotzdem an: Zustand läuft ohne Stand der Leitung → Kasten aus dem Server-Stand; kommt der Stand der Leitung, bleibt der Kasten ohne Lücke', () => {
    serverStand({ 1: { art: 'nichtBereit', grund: 'not_activated', pruefen: false } });
    const { rerender } = zeige({ zustand: 'vorAnpfiff' });
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Grund: Ton nicht aktiviert');
    rerender(<CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand="laeuft" kannSteuern />);
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Grund: Ton nicht aktiviert');
    // der Stand der Leitung kommt (zählt jetzt allein): nach jedem Übernehmen ins Bild (Profiler) steht der Kasten da
    const dazwischen: boolean[] = [];
    const eingebaut = (zustand: CockpitZustand) => (
      <Profiler id="hinweis" onRender={() => { dazwischen.push(document.querySelector(`[data-testid="${GRUND_KASTEN}"]`) !== null); }}>
        <CockpitHallHinweis tournamentId={TID} feldId="field-1" zustand={zustand} kannSteuern />
      </Profiler>
    );
    rerender(eingebaut('laeuft'));
    act(() => { setzeLeitung(leitung(lautsprecher('not_activated'))); });
    rerender(eingebaut('laeuft'));
    expect(dazwischen.length).toBeGreaterThan(0);
    expect(dazwischen.every(Boolean)).toBe(true);
    expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Grund: Ton nicht aktiviert');
  });

  it('hat die Leitung einen Stand, gilt nur dieser: der Server-Stand „aus“ wird nicht daneben gezeigt', () => {
    serverStand({ 1: { art: 'nichtBereit', grund: 'slept', pruefen: false } });
    setzeLeitung(leitung(lautsprecher('ready')));
    zeige();
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
    expect(status.gelesen, 'solange die Leitung einen Stand hat, keine zusätzliche Abfrage').toBe(0);
  });

  it('Gegenbeispiel @HT-038: Feld ohne Lautsprecher am Server → kein Kasten, auch vor dem Anpfiff', () => {
    serverStand({});
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('Gegenbeispiel @HT-050 Zeile 3: vor dem Anpfiff „bereit + Prüfen“ → kein Hinweis; im Spiel ohne Leitungsstand → die ruhige Zeile', () => {
    serverStand({ 1: { art: 'bereit', pruefen: true } });
    const { unmount } = zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
    unmount();
    zeige({ zustand: 'laeuft' });
    expect(screen.getByTestId('cockpit-hall-ausgang-geaendert')).toBeInTheDocument();
  });

  it('Gegenbeispiel: kein Recht und unbekannter Stand (kein Netz) → kein Kasten, auch kein „Kein Netz“ aus dem Server-Stand', () => {
    serverStand({}, 'kein_recht');
    const { unmount } = zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
    unmount();
    serverStand({}, 'unbekannt');
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
    expect(screen.queryByTestId('cockpit-hall-kein-netz')).toBeNull();
  });

  it('Gegenbeispiel: ein Server-Stand, der noch lädt, zeigt keinen alten Kasten', () => {
    serverStand({ 1: { art: 'nichtBereit', grund: 'not_activated', pruefen: false } }, 'laedt');
    zeige({ zustand: 'vorAnpfiff' });
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  it('Gegenbeispiel: ohne Steuerrecht wird der Server nicht gefragt (sonst alle 5 s ein 42501) und es steht kein Kasten da', () => {
    serverStand({ 1: { art: 'nichtBereit', grund: 'not_activated', pruefen: false } });
    zeige({ zustand: 'vorAnpfiff', kannSteuern: false });
    expect(status.gelesen).toBe(0);
    expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
  });

  for (const zustand of ['abgepfiffen', 'keinSpiel', 'wartetAufHerkunft'] as const) {
    it(`Gegenbeispiel @HT-035 letzte Zeile: Zustand ${zustand} → kein Kasten, keine Abfrage`, () => {
      serverStand({ 1: { art: 'nichtBereit', grund: 'not_activated', pruefen: false } });
      zeige({ zustand });
      expect(screen.queryByTestId('cockpit-hall-hinweise')).toBeNull();
      expect(status.gelesen).toBe(0);
    });
  }

  for (const zustand of ['halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss', 'pausiert'] as const) {
    it(`@HT-040 in der Pause (${zustand}) bleibt der Kasten aus dem Server-Stand stehen`, () => {
      serverStand({ 1: { art: 'nichtBereit', grund: 'background', pruefen: false } });
      zeige({ zustand });
      expect(screen.getByTestId(GRUND_KASTEN)).toHaveTextContent('Grund: Hintergrund');
    });
  }
});
