/**
 * H4-12 Cockpit-Hinweise zum Hallenton (Oberfläche): Wortlaute aus dem Record, die Zeilen der Gründe (@HT-039 Spalte Cockpit), Gegenbeispiele
 * (kein Lautsprecher, bereit, keine Zeile bei fremdem Spiel) und die Zeile zur Uhr vor dem Anpfiff (@HT-036). Zustand aus den echten Funktionen
 * (`cockpitHinweisAusLeitung` über die echte Leitung des Moduls), nur die Zeit und der Server-Stand sind von Hand.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
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
const status = vi.hoisted(() => ({ wert: null as unknown as HallStatus }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => status.wert }));
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

function zeige(o: { vorAnpfiff?: boolean; feldId?: string | null } = {}) {
  return render(<CockpitHallHinweis tournamentId={TID} feldId={o.feldId === undefined ? 'field-1' : o.feldId} vorAnpfiff={o.vorAnpfiff ?? false} />);
}

beforeEach(() => {
  uhr.abgeglichen = true;
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
    rerender(<CockpitHallHinweis tournamentId={TID} feldId="field-1" vorAnpfiff={false} />);
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
    zeige({ vorAnpfiff: true });
    expect(screen.getByTestId('cockpit-hall-uhr')).toHaveTextContent('Uhr nicht abgeglichen – Hallenton kann abweichen');
  });

  it('ist die Uhr abgeglichen, erscheint der Hinweis nicht', () => {
    zeige({ vorAnpfiff: true });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Gegenbeispiel: nach dem Anpfiff steht die Zeile zur Uhr nicht mehr', () => {
    uhr.abgeglichen = false;
    zeige({ vorAnpfiff: false });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Gegenbeispiel @HT-038: Feld ohne Lautsprecher oder ohne Antwort des Servers → kein Hinweis zum Hallenton', () => {
    uhr.abgeglichen = false;
    status.wert = { ...status.wert, felder: {} };
    zeige({ vorAnpfiff: true });
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
    status.wert = { ...status.wert, stand: 'laedt' };
    expect(screen.queryByTestId('cockpit-hall-uhr')).toBeNull();
  });

  it('Hinweis und Störung stehen zugleich untereinander', () => {
    uhr.abgeglichen = false;
    setzeLeitung(leitung(lautsprecher('not_activated')));
    zeige({ vorAnpfiff: true });
    expect(screen.getByTestId('cockpit-hall-aus')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-hall-uhr')).toBeInTheDocument();
  });
});
