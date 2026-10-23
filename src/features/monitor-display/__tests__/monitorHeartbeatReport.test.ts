/**
 * B-48b (Befund C-HEARTBEAT): Welchen Wachhalten-Zustand meldet der Monitor an die Verwaltung? Abgeleitet aus den
 * Beispielzeilen von @ME-064 (Datenteil; die Anzeige „Wachhalten: …“ baut B-48c) und dem Browser-Quellen-Satz.
 */
import { describe, it, expect } from 'vitest';
import type { WakeLockStatus } from '../../../hooks/useWakeLock';
import { wakeLockReport } from '../monitorHeartbeatReport';

const imBrowser = { browserQuelle: false, warZugesagt: false };

describe('wakeLockReport – Meldung an die Verwaltung (B-48b)', () => {
  // @ME-064 Beispiele: | Lage | Anzeige | -- hier: Lage -> gemeldeter Wert (die Anzeige leitet B-48c daraus ab)
  it.each<[string, WakeLockStatus, boolean, string]>([
    ['der Browser hat das Anlassen des Bildschirms zugesagt', 'granted', false, 'granted'],
    ['der Browser lässt das Anlassen des Bildschirms nicht zu', 'denied', false, 'denied'],
    ['der Browser beantwortet die Anfrage zum Anlassen des Bildschirms nicht', 'noAnswer', false, 'no_answer'],
    ['der Browser hat das Anlassen zugesagt und die Zusage später zurückgenommen, etwa im Energiesparmodus', 'released', true, 'released'],
  ])('@ME-064:teil %s → meldet %s/%s als %s', (_lage, status, warZugesagt, erwartet) => {
    expect(wakeLockReport(status, { browserQuelle: false, warZugesagt })).toBe(erwartet);
  });

  it('@ME-064:teil läuft der Monitor als Browser-Quelle, meldet er „entfällt“ (not_applicable), egal was der Browser sagt', () => {
    const alle: WakeLockStatus[] = ['idle', 'pending', 'granted', 'denied', 'unsupported', 'noAnswer', 'released'];
    for (const status of alle) {
      expect(wakeLockReport(status, { browserQuelle: true, warZugesagt: false }), status).toBe('not_applicable');
      expect(wakeLockReport(status, { browserQuelle: true, warZugesagt: true }), status).toBe('not_applicable');
    }
  });

  it('fehlt die Schnittstelle, gilt das als „nicht möglich“ (denied)', () => {
    expect(wakeLockReport('unsupported', imBrowser)).toBe('denied');
  });

  it('ohne Antwort und ohne Anfrage meldet er nichts (null = unbekannt)', () => {
    expect(wakeLockReport('idle', imBrowser)).toBeNull();
    expect(wakeLockReport('pending', imBrowser)).toBeNull();
  });

  it('Nachtrag 17.10.: nach einer Zusage wird jeder andere Zustand als „zwischenzeitlich freigegeben“ gemeldet', () => {
    const nachZusage = { browserQuelle: false, warZugesagt: true };
    for (const status of ['denied', 'unsupported', 'noAnswer', 'pending', 'idle', 'released'] as const) {
      expect(wakeLockReport(status, nachZusage), status).toBe('released');
    }
    expect(wakeLockReport('granted', nachZusage)).toBe('granted');
  });

  it('Gegenbeispiel: ohne Antwort oder bei Ablehnung meldet er nie „zugesagt“', () => {
    for (const status of ['noAnswer', 'denied', 'unsupported', 'pending', 'idle', 'released'] as const) {
      expect(wakeLockReport(status, imBrowser), status).not.toBe('granted');
    }
  });
});
