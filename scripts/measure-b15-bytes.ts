/**
 * B-15: Byte-Messung der Zuschauer-Antworten und Egress-Notiz (Aufruf: npx tsx scripts/measure-b15-bytes.ts).
 * Nur lokale Nutzlasten aus der Fixture des Nikolaus-Turniers (6 Teams, 15 Spiele), kein Netz, keine Produktion.
 */
import {
  egress, measure, NIKOLAUS_SCENARIO, P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY, P0_7_RPC_MEGABYTES_PER_DAY,
} from '../src/features/public-view/__tests__/payloadMeasure';

const sizes = measure();
console.log('Antworten je Abruf (Bytes):');
for (const size of [sizes.legacy, sizes.full, sizes.delta, sizes.unchanged]) {
  console.log(`  ${size.label}\n    roh ${size.raw} · gzip ${size.gzip} · brotli ${size.brotli} · Body auf dem Draht ${size.body} · mit Kopfzeilen lokal ${size.withHeadersLocal} · mit Kopfzeilen Cloud (+300/Antwort) ${size.withHeadersCloud}`);
}
console.log('\nEgress je Turniertag (5 h, 2 Bildschirme, 1 Änderung/min, Kopfzeilen Cloud), MB (1 MB = 10^6 B):');
for (const viewers of [100, 300]) {
  const result = egress({ ...NIKOLAUS_SCENARIO, viewers }, sizes);
  console.log(`  ${viewers} Zuschauer: Weg (a) mit 10-s-Takt ${result.legacyMegabytes.toFixed(0)} MB (Wochenende = 2 Tage: ${(2 * result.legacyMegabytes / 1000).toFixed(2)} GB) · Weg (b) ${result.rpcMegabytes.toFixed(0)} MB (Wochenende: ${(2 * result.rpcMegabytes / 1000).toFixed(2)} GB)`);
}
const p07 = egress({ ...NIKOLAUS_SCENARIO, viewers: 300, screens: 3 }, sizes);
console.log(`\nVergleich mit P0-7 (300 Zuschauer + 3 Bildschirme): Weg (b) ${p07.rpcMegabytes.toFixed(0)} MB gegen ${P0_7_RPC_MEGABYTES_PER_DAY} MB (${(100 * (p07.rpcMegabytes / P0_7_RPC_MEGABYTES_PER_DAY - 1)).toFixed(0)} %); Weg (a) mit Takt ${p07.legacyMegabytes.toFixed(0)} MB gegen ${P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY} MB (${(100 * (p07.legacyMegabytes / P0_7_LEGACY_POLLING_MEGABYTES_PER_DAY - 1)).toFixed(0)} %)`);
