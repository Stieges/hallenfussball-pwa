/**
 * @RE-003 Das gebaute Paket nennt keine Schrift- oder Skript-Quelle auf fremden Servern (statische Prüfung von dist/).
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error – .mjs ohne Typen
import { findeFremdeQuellen } from '../check-external-hosts.mjs';

const finde = findeFremdeQuellen as (text: string) => string[];

describe('@RE-003 statische Prüfung des Pakets', () => {
  it.each([
    '@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue");',
    'src:url(https://fonts.gstatic.com/s/bebasneue/v1/x.woff2)',
    'import("https://unpkg.com/x/y.js")',
    'libURL = "https://cdn.jsdelivr.net/npm/anderes-paket@1/dist/x.js"',
  ])('findet %s', (text) => {
    expect(finde(text)).toHaveLength(1);
  });

  it.each([
    'i=`https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js`',
    'i.libURL=`https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js`',
    'xmlns="http://www.w3.org/2000/svg" https://policies.google.com/privacy https://lh3.googleusercontent.com/a.png',
    '',
  ])('Gegenbeispiel: %s bleibt unbeanstandet', (text) => {
    expect(finde(text)).toEqual([]);
  });
});
