/**
 * „Läuft“ (Daniel 23.10.): Turniertag heute (Gerätedatum) ODER angepfiffen, und nicht abgeschlossen – für Helfer-Zugänge und
 * eigene Turniere (@HE-096, @HE-099, @HE-109).
 */
import { describe, expect, it } from 'vitest';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { createMockMatch, createMockTournament } from '../../../test/factories';
import { isRunningHelperEntry, isRunningOwnTournament, localDateKey, toDateKey } from '../runningState';

const NOW = new Date(2026, 10, 28, 7, 30, 0); // Turniertag morgens, vor dem ersten Anpfiff
const entry = (o: Partial<HelperAccessEntry> = {}): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-27T10:00:00Z', ...o,
});

describe('Datum', () => {
  it('localDateKey: Ortszeit des Geräts', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('toDateKey: ISO, deutsche Schreibweise, Unlesbares', () => {
    expect(toDateKey('2026-11-28T09:00:00Z')).toBe('2026-11-28');
    expect(toDateKey('8.3.2026')).toBe('2026-03-08');
    expect(toDateKey('bald')).toBeNull();
    expect(toDateKey(undefined)).toBeNull();
  });
});

describe('Helfer-Zugang läuft', () => {
  it('ab dem Morgen des Turniertags, auch vor dem ersten Anpfiff', () => {
    expect(isRunningHelperEntry(entry(), NOW)).toBe(true);
  });
  it('Gegenbeispiel: Turniertag morgen oder später → läuft nicht', () => {
    expect(isRunningHelperEntry(entry({ date: '2026-11-29' }), NOW)).toBe(false);
    expect(isRunningHelperEntry(entry({ date: '2026-12-04' }), NOW)).toBe(false);
  });
  it('Gegenbeispiel: abgeschlossen, entzogen, nur zusehen, offene Anfrage → läuft nicht', () => {
    expect(isRunningHelperEntry(entry({ closed: true }), NOW)).toBe(false);
    expect(isRunningHelperEntry(entry({ relation: 'revoked' }), NOW)).toBe(false);
    expect(isRunningHelperEntry(entry({ relation: 'viewer' }), NOW)).toBe(false);
    expect(isRunningHelperEntry(entry({ relation: 'pending' }), NOW)).toBe(false);
  });
  it('Turniertag war gestern, Turnier nicht abgeschlossen → läuft noch (der Zugang endet mit dem Turnier, @HE-098 Zeile 3)', () => {
    expect(isRunningHelperEntry(entry({ date: '2026-11-27' }), NOW)).toBe(true);
  });
});

describe('@HE-111 Nachlauf: ein nie abgeschlossenes Turnier gilt ab dem übernächsten Tag nicht mehr als laufend', () => {
  // Live-Cup am Freitag 27.11.2026, Olli hat ihn nie abgeschlossen
  const live = entry({ date: '2026-11-27' });
  it('Samstag, der Tag nach dem Turnier → Feld 2 öffnet sich noch', () => {
    expect(isRunningHelperEntry(live, new Date(2026, 10, 28, 9, 0))).toBe(true);
  });
  it('Sonntag → läuft nicht mehr (Startseite mit Karte)', () => {
    expect(isRunningHelperEntry(live, new Date(2026, 10, 29, 9, 0))).toBe(false);
  });
  it('Gegenbeispiel: am Turniertag selbst, spätabends → läuft', () => {
    expect(isRunningHelperEntry(live, new Date(2026, 10, 27, 23, 59))).toBe(true);
  });
  it('Der Nachlauf endet an der Tagesgrenze, auch am Monatsende', () => {
    expect(isRunningHelperEntry(entry({ date: '2026-11-30' }), new Date(2026, 11, 1, 8, 0))).toBe(true);
    expect(isRunningHelperEntry(entry({ date: '2026-11-30' }), new Date(2026, 11, 2, 8, 0))).toBe(false);
  });
  it('eigenes, angepfiffenes, nie abgeschlossenes Turnier: gleiche Obergrenze', () => {
    const angepfiffen = createMockTournament({ status: 'published', startDate: '2026-11-27', date: '2026-11-27', matches: [createMockMatch({ id: 'm1', matchStatus: 'running' })] });
    expect(isRunningOwnTournament(angepfiffen, new Date(2026, 10, 28, 9, 0))).toBe(true);
    expect(isRunningOwnTournament(angepfiffen, new Date(2026, 10, 29, 9, 0))).toBe(false);
  });
});

describe('Eigenes Turnier läuft', () => {
  const own = (o: Parameters<typeof createMockTournament>[0] = {}) =>
    createMockTournament({ status: 'published', startDate: '2026-11-28', date: '2026-11-28', matches: [createMockMatch({ id: 'm1' })], ...o });

  it('Turniertag heute, nicht abgeschlossen → läuft', () => {
    expect(isRunningOwnTournament(own(), NOW)).toBe(true);
  });
  it('angepfiffen (ein Spiel läuft), Turniertag war gestern → läuft', () => {
    const t = own({ startDate: '2026-11-27', date: '2026-11-27', matches: [createMockMatch({ id: 'm1', matchStatus: 'running' })] });
    expect(isRunningOwnTournament(t, NOW)).toBe(true);
  });
  it('Gegenbeispiel: Trainingsturnier von letzter Woche, nichts angepfiffen → läuft nicht', () => {
    expect(isRunningOwnTournament(own({ startDate: '2026-11-21', date: '2026-11-21' }), NOW)).toBe(false);
  });
  it('Gegenbeispiel: Turniertag in der Zukunft → läuft nicht', () => {
    expect(isRunningOwnTournament(own({ startDate: '2026-12-05', date: '2026-12-05' }), NOW)).toBe(false);
  });
  it('Gegenbeispiel: heute, aber manuell abgeschlossen → läuft nicht', () => {
    expect(isRunningOwnTournament(own({ manuallyCompleted: true }), NOW)).toBe(false);
  });
  it('Gegenbeispiel: heute, aber im Papierkorb / abgebrochen / Entwurf → läuft nicht', () => {
    expect(isRunningOwnTournament(own({ deletedAt: '2026-11-28T06:00:00Z' }), NOW)).toBe(false);
    expect(isRunningOwnTournament(own({ cancelledAt: '2026-11-28T06:00:00Z' }), NOW)).toBe(false);
    expect(isRunningOwnTournament(own({ status: 'draft' }), NOW)).toBe(false);
  });
});

describe('unlesbares oder leeres Datum gilt nicht als laufend (sichere Richtung zu @HE-111)', () => {
  it('Helfer-Zugang ohne lesbares Datum → läuft nicht', () => {
    expect(isRunningHelperEntry(entry({ date: '' }), NOW)).toBe(false);
    expect(isRunningHelperEntry(entry({ date: 'bald' }), NOW)).toBe(false);
  });
  it('Gegenbeispiel: lesbares Datum heute → läuft', () => {
    expect(isRunningHelperEntry(entry({ date: '2026-11-28' }), NOW)).toBe(true);
  });
  it('eigenes, angepfiffenes Turnier ohne Datum → läuft nicht', () => {
    const t = createMockTournament({ status: 'published', startDate: undefined, date: '', matches: [createMockMatch({ id: 'm1', matchStatus: 'running' })] });
    expect(isRunningOwnTournament(t, NOW)).toBe(false);
  });
});
