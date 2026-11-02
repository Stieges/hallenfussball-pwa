/**
 * `imageSizeOf` liest die Maße aus dem Dateikopf (Grundlage der Pixelgrenze beim Hochladen, @W3-030).
 */
import { describe, expect, it } from 'vitest';
import { imageSizeOf } from '../logoBytes';

function jpeg(prefix: number[], width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(48);
  bytes.set([0xff, 0xd8, ...prefix, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  const at = 2 + prefix.length + 5;
  const view = new DataView(bytes.buffer);
  view.setUint16(at, height);
  view.setUint16(at + 2, width);
  return bytes;
}

describe('imageSizeOf', () => {
  it('@W3-030 JPEG: Höhe und Breite aus dem ersten SOF-Block', () => {
    expect(imageSizeOf({ data: jpeg([], 640, 480), format: 'JPEG' })).toEqual({ width: 640, height: 480 });
  });

  it('@W3-030 JPEG mit Füllbytes (FF FF) vor dem Marker: die Füllbytes werden übersprungen', () => {
    expect(imageSizeOf({ data: jpeg([0xff, 0xff], 16000, 16000), format: 'JPEG' })).toEqual({ width: 16000, height: 16000 });
  });

  it('@W3-030 JPEG ohne lesbaren Kopf: undefined', () => {
    expect(imageSizeOf({ data: new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]), format: 'JPEG' })).toBeUndefined();
  });
});
