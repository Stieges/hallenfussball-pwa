/**
 * @FU-084 (Client-Seite): Das Live-Repository ist nur lesend.
 *
 * Schreibmethoden (save / saveAll / delete / deleteEvent / clear) gibt es am Interface
 * `ILiveMatchRepository` und an beiden Implementierungen nicht mehr. Die Prüfung ist
 * typgetrieben: jede `@ts-expect-error`-Zeile wird rot, sobald die Methode zurückkommt
 * (unbenutztes `@ts-expect-error`). Der Laufzeit-Teil belegt, dass die Lesemethoden bleiben.
 */
import { describe, it, expect } from 'vitest';
import type { ILiveMatchRepository } from '../ILiveMatchRepository';
import { LocalStorageLiveMatchRepository } from '../LocalStorageLiveMatchRepository';
import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

describe('ILiveMatchRepository ist nur lesend (@FU-084)', () => {
  it('Interface: keine Schreibmethode', () => {
    const repo: ILiveMatchRepository = new SupabaseLiveMatchRepository();

    // @ts-expect-error save ist aus dem Interface entfernt
    expect(repo.save).toBeUndefined();
    // @ts-expect-error saveAll ist aus dem Interface entfernt
    expect(repo.saveAll).toBeUndefined();
    // @ts-expect-error delete ist aus dem Interface entfernt
    expect(repo.delete).toBeUndefined();
    // @ts-expect-error deleteEvent ist aus dem Interface entfernt
    expect(repo.deleteEvent).toBeUndefined();
    // @ts-expect-error clear ist aus dem Interface entfernt
    expect(repo.clear).toBeUndefined();
  });

  it('SupabaseLiveMatchRepository: keine Schreibmethode', () => {
    const repo = new SupabaseLiveMatchRepository();

    // @ts-expect-error save existiert nicht mehr
    expect(repo.save).toBeUndefined();
    // @ts-expect-error saveAll existiert nicht mehr
    expect(repo.saveAll).toBeUndefined();
    // @ts-expect-error delete existiert nicht mehr
    expect(repo.delete).toBeUndefined();
    // @ts-expect-error deleteEvent existiert nicht mehr
    expect(repo.deleteEvent).toBeUndefined();
    // @ts-expect-error clear existiert nicht mehr
    expect(repo.clear).toBeUndefined();
  });

  it('LocalStorageLiveMatchRepository: keine Schreibmethode', () => {
    const repo = new LocalStorageLiveMatchRepository();

    // @ts-expect-error save existiert nicht mehr
    expect(repo.save).toBeUndefined();
    // @ts-expect-error saveAll existiert nicht mehr
    expect(repo.saveAll).toBeUndefined();
    // @ts-expect-error delete existiert nicht mehr
    expect(repo.delete).toBeUndefined();
    // @ts-expect-error deleteEvent existiert nicht mehr
    expect(repo.deleteEvent).toBeUndefined();
    // @ts-expect-error clear existiert nicht mehr
    expect(repo.clear).toBeUndefined();
  });

  it('Gegenbeispiel: get und getAll bleiben lesbar', () => {
    const repo: ILiveMatchRepository = new SupabaseLiveMatchRepository();

    expect(typeof repo.get).toBe('function');
    expect(typeof repo.getAll).toBe('function');
  });
});
