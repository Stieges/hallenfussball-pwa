/**
 * H3b-2b Fixrunde 1, Tonwahl (Ruling Ledger 07.11.): Abpfiff aus `matchCockpitSettings.soundId`, eigener Abpfiff-Ton vor der
 * Hupe, ohne Wahl „Hupe 1“ (@HT-025, @HT-027); Halbzeit-Ton aus `hall_sound_status`.
 */
import { describe, expect, it } from 'vitest';
import { tonWahlAus } from '../tonWahl';

const url = (pfad: string): string => `https://speicher.example/hallenton-sounds/${pfad}`;
const settings = (extra: Partial<{ halftimeSound: 'horn-1' | 'horn-2' | 'horn-3' | 'custom'; halftimeCustomPath: string | null; endCustomPath: string | null }> = {}) => ({
  halftimeSound: 'horn-1' as const, halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], ...extra,
});

describe('@HT-025 Tonwahl des Hallen-Lautsprechers', () => {
  it('@HT-025 Abpfiff „Hupe 2“ im Turnier, Halbzeit „Hupe 1“ → horn-2 und horn-1', () => {
    expect(tonWahlAus('horn-2', settings(), url)).toEqual({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
  });

  it('@HT-025 ohne Wahl gilt die Vorbelegung „Hupe 1“ für beide (auch ohne Antwort des Servers)', () => {
    expect(tonWahlAus(null, null, url)).toEqual({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
    expect(tonWahlAus(undefined, settings(), url)).toEqual({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
  });

  it('@HT-027 ein eigener Abpfiff-Ton hat Vorrang vor der Hupe des Turniers; eigener Halbzeit-Ton über die öffentliche Adresse', () => {
    const wahl = tonWahlAus('horn-3', settings({ endCustomPath: 't/ende.mp3', halftimeSound: 'custom', halftimeCustomPath: 't/halb.mp3' }), url);
    expect(wahl).toEqual({ abpfiff: { eigeneUrl: url('t/ende.mp3') }, halbzeit: { eigeneUrl: url('t/halb.mp3') } });
  });

  it('Gegenbeispiel: der lokal hochgeladene Cockpit-Ton („custom“, nur im Browser) wird zur Vorbelegung „Hupe 1“', () => {
    expect(tonWahlAus('custom', settings({ halftimeSound: 'horn-3' }), url)).toEqual({ abpfiff: 'horn-1', halbzeit: 'horn-3' });
  });
});
