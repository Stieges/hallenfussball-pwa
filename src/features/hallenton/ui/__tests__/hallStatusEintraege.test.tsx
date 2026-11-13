/**
 * H4-5 Einträge der Statuszeile (@HT-045, @HT-047, @HT-012, @HT-011, @HT-037, @HT-039, @HT-041, @HT-035): Wortlaute aus der echten
 * deutschen Sprachdatei, Zusammenfassen über Felder, „Prüfen“ nur als `daneben`, Platz für die Probe.
 */
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { StatusEintrag } from '../../../../components/ui/molecules/statusZeileTypen';
import { sortiereEintraege } from '../../../../components/ui/molecules/statusZeileLogik';
import type { FeldAnzeige, HallAnzeige } from '../../hallAnzeige';
import { baueStatusEintraege, type EintragWerkzeug } from '../hallStatusEintraege';

const t = ((key: string, opts?: Record<string, unknown>) => {
  const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
  const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
  return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
}) as unknown as TFunction<'hallenton'>;

const werkzeug = (extra: Partial<EintragWerkzeug> = {}): EintragWerkzeug => ({ t, ziel: '/ziel', tonAktivieren: vi.fn(), ...extra });
const feld = (nr: number, anzeige: FeldAnzeige['anzeige'], eigenesGeraet = false): FeldAnzeige => ({ feld: nr, anzeige, eigenesGeraet });
const anzeige = (felder: FeldAnzeige[], extra: Partial<HallAnzeige> = {}): HallAnzeige => ({ felder, handyOhneNetz: [], statusUnbekannt: false, ...extra });
const BEREIT = { art: 'bereit', pruefen: false, hupeStattEigenerTon: false } as const;
const texte = (e: readonly StatusEintrag[]): string[] => e.map((x) => x.text);
const probe: StatusEintrag = { id: 'probe', rang: 'probe', ton: 'info', rand: 'gestrichelt', symbol: null, text: 'Probe läuft', aktion: { art: 'navigiere', ziel: '/probe' } };

describe('Wortlaute (G7)', () => {
  it('@HT-012 „Ton nicht aktiv – hier klicken“; der Klick aktiviert den Ton', () => {
    const w = werkzeug();
    const [e] = baueStatusEintraege(anzeige([feld(1, { art: 'tonNichtAktiv' }, true)]), w);
    expect(e?.text).toBe('Ton nicht aktiv – hier klicken');
    expect(e?.rang).toBe('stoerung');
    expect(e?.aktion.art).toBe('ausloesen');
    if (e?.aktion.art === 'ausloesen') { e.aktion.onClick(); }
    expect(w.tonAktivieren).toHaveBeenCalledTimes(1);
  });
  it('@HT-011 „Lautsprecher Feld 1 nicht bereit – keine Verbindung“', () => {
    expect(texte(baueStatusEintraege(anzeige([feld(1, { art: 'keineVerbindung' }, true)]), werkzeug()))).toEqual(['Lautsprecher Feld 1 nicht bereit – keine Verbindung']);
  });
  it('@HT-037 „Lautsprecher schlafen gelegt“; ein Klick auf „Ton aktivieren“ hebt es auf', () => {
    const w = werkzeug();
    const [e] = baueStatusEintraege(anzeige([feld(1, { art: 'schlafenGelegt' }, true)]), w);
    expect(e?.text).toBe('Lautsprecher schlafen gelegt');
    if (e?.aktion.art === 'ausloesen') { e.aktion.onClick(); }
    expect(w.tonAktivieren).toHaveBeenCalledTimes(1);
  });
  it('@HT-039 auf anderen Geräten die grundlose Pille „Lautsprecher Feld 1 nicht bereit“', () => {
    expect(texte(baueStatusEintraege(anzeige([feld(1, { art: 'nichtBereit' })]), werkzeug()))).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('@HT-033 Zeile 8 „Lautsprecher läuft schon in einem anderen Fenster“', () => {
    expect(texte(baueStatusEintraege(anzeige([feld(1, { art: 'anderesFenster' }, true)]), werkzeug()))).toEqual(['Lautsprecher läuft schon in einem anderen Fenster']);
  });
  it('@HT-041 „Lautsprecher: Status unbekannt“, neutral und gestrichelt', () => {
    const [e] = baueStatusEintraege(anzeige([], { statusUnbekannt: true }), werkzeug());
    expect(e).toMatchObject({ text: 'Lautsprecher: Status unbekannt', ton: 'neutral', rand: 'gestrichelt' });
  });
  it('@HT-035 „Feld 1: Handy ohne Netz“', () => {
    expect(texte(baueStatusEintraege(anzeige([feld(1, BEREIT)], { handyOhneNetz: [1] }), werkzeug()))).toContain('Feld 1: Handy ohne Netz');
  });
});

describe('@HT-045 Reihenfolge, Zusammenfassen, Platz für die Probe', () => {
  it('Zeile 4: Feld 1 und 2 nicht bereit ergeben EIN Eintrag „Lautsprecher Feld 1, 2 nicht bereit“, dann „Probe läuft“', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'nichtBereit' }), feld(2, { art: 'nichtBereit' })]), werkzeug({ probe }));
    expect(texte(sortiereEintraege(e))).toEqual(['Lautsprecher Feld 1, 2 nicht bereit', 'Probe läuft']);
  });
  it('Zeile 3: Feld 1 nicht bereit und Probe → Störung vor Probe', () => {
    expect(texte(sortiereEintraege(baueStatusEintraege(anzeige([feld(1, { art: 'nichtBereit' })]), werkzeug({ probe }))))).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft']);
  });
  it('Zeile 2: Feld 1 bereit und Probe → Probe vor „bereit“', () => {
    expect(texte(sortiereEintraege(baueStatusEintraege(anzeige([feld(1, BEREIT)]), werkzeug({ probe }))))).toEqual(['Probe läuft', 'Lautsprecher Feld 1 bereit']);
  });
  it('Zeile 1 und 5: nur bereit → ein Eintrag; kein Lautsprecher und keine Probe → keine Einträge', () => {
    expect(texte(baueStatusEintraege(anzeige([feld(1, BEREIT)]), werkzeug()))).toEqual(['Lautsprecher Feld 1 bereit']);
    expect(baueStatusEintraege(anzeige([]), werkzeug())).toEqual([]);
  });
  it('Probe-Platzhalter: nur die Probe ohne Lautsprecher → die Zeile zeigt „Probe läuft“, sonst nichts (kein „kein Lautsprecher“)', () => {
    expect(texte(baueStatusEintraege(anzeige([]), werkzeug({ probe })))).toEqual(['Probe läuft']);
  });
  it('Gleiche Zustände mit Kurzform und Lesetext für Vorlesehilfen', () => {
    const [e] = baueStatusEintraege(anzeige([feld(1, BEREIT), feld(2, BEREIT)]), werkzeug());
    expect(e).toMatchObject({ text: 'Lautsprecher Feld 1, 2 bereit', kurz: 'Feld 1, 2 bereit', lesetext: 'Lautsprecher Feld 1, 2 bereit' });
  });
  it('Im Unterpunkt „Hallenton“ (ohneLautsprecher) entfällt der Lautsprecher-Eintrag, die Probe bleibt', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'nichtBereit' })], { statusUnbekannt: true, handyOhneNetz: [1] }), werkzeug({ ohneLautsprecher: true, probe }));
    expect(texte(e)).toEqual(['Probe läuft']);
  });
});

describe('@HT-047 „Prüfen“ nur als daneben', () => {
  it('bereit mit Hinweis: „Prüfen“ hängt als `daneben` am bereit-Eintrag, nie als eigener Eintrag', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'bereit', pruefen: true, hupeStattEigenerTon: false })]), werkzeug());
    expect(e).toHaveLength(1);
    expect(e[0]?.text).toBe('Lautsprecher Feld 1 bereit');
    expect(e[0]?.daneben).toMatchObject({ text: 'Prüfen', ton: 'info', rand: 'gestrichelt' });
    expect(e.some((x) => x.text === 'Prüfen')).toBe(false);
  });
  it('Gegenbeispiel: nicht bereit → kein „Prüfen“ (ohne Ausgang kommt kein Ton)', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'nichtBereit' })]), werkzeug());
    expect(JSON.stringify(e.map((x) => [x.text, x.daneben?.text]))).not.toContain('Prüfen');
  });
  it('Felder mit und ohne Hinweis bleiben getrennte bereit-Einträge; „Prüfen“ gehört nur zu dem mit Hinweis', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'bereit', pruefen: true, hupeStattEigenerTon: false }), feld(2, BEREIT)]), werkzeug());
    expect(e.map((x) => [x.text, x.daneben?.text ?? null])).toEqual([['Lautsprecher Feld 1 bereit', 'Prüfen'], ['Lautsprecher Feld 2 bereit', null]]);
  });
  it('@HT-028 „Hupe 1 statt eigener Ton“ ist keine Pille „nicht bereit“ in der Kopfzeile: nur der bereit-Eintrag', () => {
    const e = baueStatusEintraege(anzeige([feld(1, { art: 'bereit', pruefen: false, hupeStattEigenerTon: true })]), werkzeug());
    expect(texte(e)).toEqual(['Lautsprecher Feld 1 bereit']);
    expect(e[0]?.rang).toBe('bereit');
  });
});
