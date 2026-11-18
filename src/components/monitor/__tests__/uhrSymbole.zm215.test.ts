/**
 * @ZM-215 (Daniel 2026-11-19: Symbole statt Wörter, jede Angabe nur an einer Stelle): Zuordnung Uhr-Zustand → Symbole, Abschnitt → Punkte, Abzeichen der Monitor-Live-Sichten.
 * Aus dem Gherkin: angehalten = Pause-Symbol (Ziffern gedämpft, nicht in der Schlussphase), Halbzeitpause = halber Kreis, Zeit abgelaufen = Pfeife, Verlängerung = Kreis mit Plus nur an der Uhr,
 * im laufenden Spiel kein Symbol; „Pause“, „Halbzeit“ und „Verlängerung“ stehen nie im Abzeichen, „Live“ bleibt; Strafstoßschießen und Ende bleiben im Abzeichen.
 */
import { describe, it, expect } from 'vitest';
import type { MonitorUhrModell, MonitorUhrText, MatchBadgeModel } from '../../../core/view';
import { abschnittVon, uhrSymbole, ziffernGedaempft } from '../uhrSymbole';
import { monitorLiveBadge } from '../liveBadge';

const modell = (text: MonitorUhrText, rest: Partial<MonitorUhrModell> = {}): MonitorUhrModell => ({
  restSekunden: 100, text, schlussphase: false, steht: text === 'angehalten', anker: 'a', verlaengerung: false, balken: null, msBisWechsel: null, ...rest,
});
const arten = (m: MonitorUhrModell): string[] => uhrSymbole(m).map((s) => s.kind);

describe('@ZM-215 Symbol je Uhr-Zustand', () => {
  it.each([
    ['restzeit', []], ['angehalten', ['pause']], ['pauseHalbzeit', ['halbzeit']], ['pause', ['halbzeit']], ['zeitAbgelaufen', ['pfeife']], ['verlaengerung', ['verlaengerung']],
  ] as const)('%s → %j', (text, erwartet) => { expect(arten(modell(text))).toEqual(erwartet); });

  it('in der Verlängerung bleibt der Kreis mit Plus neben dem Symbol, auch wenn die Uhr angehalten oder abgelaufen ist; im regulären Spiel nie (Gegenbeispiel)', () => {
    expect(arten(modell('angehalten', { verlaengerung: true }))).toEqual(['pause', 'verlaengerung']);
    expect(arten(modell('zeitAbgelaufen', { verlaengerung: true }))).toEqual(['pfeife', 'verlaengerung']);
    expect(arten(modell('angehalten', { verlaengerung: false }))).toEqual(['pause']);
    expect(arten(modell('zeitAbgelaufen', { verlaengerung: false }))).toEqual(['pfeife']);
  });

  it('die Namen der Symbole sind die bisherigen Wörter (Schlüssel der Übersetzung)', () => {
    expect(uhrSymbole(modell('angehalten'))[0].key).toBe('stopped');
    expect(uhrSymbole(modell('pauseHalbzeit'))[0].key).toBe('pauseHalftime');
    expect(uhrSymbole(modell('pause'))[0].key).toBe('pause');
    expect(uhrSymbole(modell('zeitAbgelaufen'))[0].key).toBe('ended');
    expect(uhrSymbole(modell('verlaengerung'))[0].key).toBe('overtime');
  });

  it('Ziffern gedämpft nur bei angehaltener Uhr, nicht in der Schlussphase (dort gilt das Violett) und nicht sonst', () => {
    expect(ziffernGedaempft(modell('angehalten'))).toBe(true);
    expect(ziffernGedaempft(modell('angehalten', { schlussphase: true }))).toBe(false);
    for (const text of ['restzeit', 'pauseHalbzeit', 'pause', 'zeitAbgelaufen', 'verlaengerung'] as const) { expect(ziffernGedaempft(modell(text)), text).toBe(false); }
    expect(ziffernGedaempft(null)).toBe(false);
  });
});

describe('@ZM-215 Abschnitt als Punkte nur bei mehr als einem Abschnitt', () => {
  it('zwei von drei Abschnitten: laufend 2, gesamt 3; läuft, angehalten und abgelaufen zeigen ihn', () => {
    for (const text of ['restzeit', 'angehalten', 'zeitAbgelaufen'] as const) { expect(abschnittVon(modell(text, { abschnitt: 2, abschnitte: 3 })), text).toEqual({ current: 2, total: 3 }); }
  });
  it.each([
    ['ein Abschnitt', modell('restzeit', { abschnitt: 1, abschnitte: 1 })],
    ['Halbzeitpause', modell('pauseHalbzeit', { abschnitt: 1, abschnitte: 2 })],
    ['Verlängerung', modell('verlaengerung', { abschnitt: 3, abschnitte: 2, verlaengerung: true })],
    ['Verlängerung angehalten', modell('angehalten', { abschnitt: 3, abschnitte: 2, verlaengerung: true })],
    ['ohne Angabe', modell('restzeit')],
  ])('Gegenbeispiel %s: keine Punkte', (_n, m) => { expect(abschnittVon(m)).toBeNull(); });
  it('ohne Modell keine Punkte', () => { expect(abschnittVon(null)).toBeNull(); });
});

describe('@ZM-215 Abzeichen der Monitor-Live-Sichten: nur was die Folie zeigt', () => {
  const abzeichen = (state: 'live' | 'pause' | 'halftime' | 'overtime' | 'shootout' | 'ended' | 'cancelled'): MatchBadgeModel => ({ kind: 'badge', state });
  it.each(['live', 'pause', 'halftime', 'overtime'] as const)('%s → „Live“', (state) => { expect(monitorLiveBadge(abzeichen(state))).toEqual(abzeichen('live')); });
  it.each(['shootout', 'ended', 'cancelled'] as const)('Gegenbeispiel %s bleibt im Abzeichen', (state) => { expect(monitorLiveBadge(abzeichen(state))).toEqual(abzeichen(state)); });
  it('„Nächstes Spiel“, Anstoßzeit und kein Abzeichen bleiben unverändert', () => {
    for (const m of [{ kind: 'next' }, { kind: 'kickoff', time: '14:04' }, { kind: 'none' }] as MatchBadgeModel[]) { expect(monitorLiveBadge(m)).toEqual(m); }
  });
});
