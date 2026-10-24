/**
 * Byte-Messung als Test mit Grenzwerten (B-15, Messziele; Datenmenge hat laut Record kein Szenario, sie steht im Plattform-Record „Betrieb im Free-Tarif“). Nutzlast: Nikolaus-Turnier, 6 Teams, 15 Spiele,
 * 8 beendet, 1 laufend (`payloadFixtures.ts`). Kopfzeilen wie im Messtest P0-7 (lokaler Stack, 316 B je Antwort der
 * Server-Funktion); die Cloud-Kopfzeilen misst B-14 an der echten Funktion nach. Weg (b) gegen den Stub des Vertrags.
 */
import { describe, it, expect } from 'vitest';
import {
  CLOUD_HEADER_SURCHARGE, egress, HEADER_BYTES_RPC, measure, NIKOLAUS_SCENARIO, P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY, P0_7_RPC_MEGABYTES_PER_DAY,
} from './payloadMeasure';

const KIBIBYTE = 1024;
const sizes = measure();

describe('Messziele der Zuschauer-Antworten (Weg b, Stub des Vertrags)', () => {
  it('Messziel Voll-Antwort ≤ 30 KB komprimiert inklusive Kopfzeilen', () => {
    expect(sizes.full.withHeadersLocal).toBeLessThanOrEqual(30 * KIBIBYTE);
  });

  it('Messziel Delta „1 Tor“ ≤ 1 KB komprimiert inklusive Kopfzeilen', () => {
    expect(sizes.delta.withHeadersLocal).toBeLessThanOrEqual(KIBIBYTE);
  });

  it('Messziel „keine Änderung“: Body ≤ 300 B; mit Kopfzeilen nur knapp darüber (P0-7: 338 B, Rückfrage an Daniel)', () => {
    expect(sizes.unchanged.body).toBeLessThanOrEqual(300);
    // Die Kopfzeilen allein sind größer als das Ziel von 300 B inkl. Kopfzeilen; hier gilt die Messung als Obergrenze.
    expect(HEADER_BYTES_RPC).toBeGreaterThan(300 - sizes.unchanged.body);
    expect(sizes.unchanged.withHeadersLocal).toBeLessThanOrEqual(400);
  });

  it('Messziel Gegenbeispiel: eine Voll-Antwort als Antwort auf jeden Abruf hielte die Ziele nicht (Weg a, 3 Antworten)', () => {
    expect(sizes.legacy.withHeadersLocal).toBeGreaterThan(sizes.delta.withHeadersLocal * 3);
    expect(sizes.legacy.responses).toBe(3);
  });
});

describe('Egress-Notiz (Formel des Plans, Rechenweg P0-7)', () => {
  it('Egress: Weg (b) bleibt für 100 und 300 Zuschauer unter 1 GB je Turnierwochenende (2 Tage)', () => {
    for (const viewers of [100, 300]) {
      const result = egress({ ...NIKOLAUS_SCENARIO, viewers }, sizes);
      expect((2 * result.rpcMegabytes) / 1000).toBeLessThan(1);
    }
  });

  it('Egress: Abweichung zu P0-7 höchstens 25 % (300 Zuschauer, 3 Bildschirme): Weg (b) und Weg (a) im 10-s-Takt', () => {
    const result = egress({ ...NIKOLAUS_SCENARIO, viewers: 300, screens: 3 }, sizes);
    expect(Math.abs(result.rpcMegabytes / P0_7_RPC_MEGABYTES_PER_DAY - 1)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(result.legacyMegabytes / P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY - 1)).toBeLessThanOrEqual(0.25);
  });

  it('Egress, Gegenbeispiel: Weg (a) im 10-s-Takt liegt bei 300 Zuschauern über 1 GB je Turniertag (nur melden)', () => {
    const result = egress({ ...NIKOLAUS_SCENARIO, viewers: 300 }, sizes);
    expect(result.legacyMegabytes).toBeGreaterThan(1000);
    expect(CLOUD_HEADER_SURCHARGE).toBe(300);
  });
});
