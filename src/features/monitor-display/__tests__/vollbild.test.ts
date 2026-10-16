// @vitest-environment jsdom
/**
 * Vollbild über alle Browser (B-17 Fixrunde 2): unpräfixiert, sonst webkit, sonst nichts – ohne Fehler.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { istImVollbild, vollbildAnfordern, vollbildUmschalten } from '../vollbild';

afterEach(() => {
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document.documentElement, 'webkitRequestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'webkitExitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'webkitFullscreenElement');
});

describe('vollbildAnfordern', () => {
  it('nutzt die unpräfixierte API, wenn sie da ist', () => {
    const unpraefixiert = vi.fn().mockResolvedValue(undefined);
    const webkit = vi.fn();
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: unpraefixiert, configurable: true });
    Object.defineProperty(document.documentElement, 'webkitRequestFullscreen', { value: webkit, configurable: true });
    vollbildAnfordern();
    expect(unpraefixiert).toHaveBeenCalledTimes(1);
    expect(webkit).not.toHaveBeenCalled();
  });

  it('Safari vor 16.4: fällt auf webkitRequestFullscreen zurück', () => {
    const webkit = vi.fn();
    Object.defineProperty(document.documentElement, 'webkitRequestFullscreen', { value: webkit, configurable: true });
    vollbildAnfordern();
    expect(webkit).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: fehlt die Vollbild-API ganz, wirft nichts', () => {
    expect(() => vollbildAnfordern()).not.toThrow();
  });

  it('Gegenbeispiel: eine verweigerte Anfrage wirft weder synchron noch als abgelehntes Versprechen', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: vi.fn(() => { throw new TypeError('Nutzergeste fehlt'); }),
      configurable: true,
    });
    expect(() => vollbildAnfordern()).not.toThrow();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: vi.fn().mockRejectedValue(new Error('verweigert')),
      configurable: true,
    });
    expect(() => vollbildAnfordern()).not.toThrow();
    await Promise.resolve();
  });
});

describe('vollbildUmschalten', () => {
  it('ist im Vollbild (webkit), beendet es über webkitExitFullscreen', () => {
    const ende = vi.fn();
    Object.defineProperty(document, 'webkitFullscreenElement', { value: document.documentElement, configurable: true });
    Object.defineProperty(document, 'webkitExitFullscreen', { value: ende, configurable: true });
    expect(istImVollbild()).toBe(true);
    vollbildUmschalten();
    expect(ende).toHaveBeenCalledTimes(1);
  });

  it('ohne Vollbild fordert es an', () => {
    const anfordern = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: anfordern, configurable: true });
    vollbildUmschalten();
    expect(anfordern).toHaveBeenCalledTimes(1);
  });
});
