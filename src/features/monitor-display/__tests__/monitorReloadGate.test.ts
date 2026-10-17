/**
 * B-19b (@ZM-124 drei Zeilen, @ZM-128, @ME-012): reine Neulade-Regel des Monitors. Neu geladen wird erst beim
 * Folienwechsel zu einer Folie ohne laufendes Spiel; bei nur einer Folie, sobald auf keinem Feld ein Spiel läuft.
 * „Laufend“ = running ODER paused (ein unterbrochenes Spiel ist nicht vorbei).
 */
import { describe, expect, it } from 'vitest';
import type { RuleMatch } from '../slideProgramme';
import { neuladenErlaubt } from '../monitorReloadGate';
import { slide } from './monitorFixture';

const liveFeld1 = slide('live', { fieldId: 'field-1' });
const tabelle = slide('standings', { groupId: 'A' });
const liveFeld2 = slide('live', { fieldId: 'field-2' });

const spiel7 = (matchStatus: string): RuleMatch => ({ id: 'match-7', field: 1, matchStatus });
const beendet: RuleMatch = { id: 'match-7', field: 1, matchStatus: 'finished' };
const keinSpiel: RuleMatch[] = [{ id: 'match-7', field: 1, matchStatus: 'scheduled' }];

describe('Neulade-Regel des Monitors (B-19b, @ZM-124, @ZM-128, @ME-012)', () => {
  it('@ME-012: Live-Folie mit laufendem Spiel 7 → kein Neuladen, auch nach vielen Wechseln', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1, tabelle], matches: [spiel7('running')], index: 0, wechselSeitUpdate: 5 })).toBe(false);
  });

  it('Gegenbeispiel: Spiel paused (Pause) ist nicht vorbei → kein Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1, tabelle], matches: [spiel7('paused')], index: 0, wechselSeitUpdate: 1 })).toBe(false);
  });

  it('@ZM-124 Zeile 2: Tabelle ohne Spiel, aber noch kein Wechsel seit der neuen Version → wartet', () => {
    expect(neuladenErlaubt({ slides: [tabelle, liveFeld2], matches: keinSpiel, index: 0, wechselSeitUpdate: 0 })).toBe(false);
  });

  it('@ZM-124 Zeile 2: Wechsel zu einer Folie ohne laufendes Spiel (Live-Folie Feld 2) → Neuladen', () => {
    expect(neuladenErlaubt({ slides: [tabelle, liveFeld2], matches: keinSpiel, index: 1, wechselSeitUpdate: 1 })).toBe(true);
  });

  it('@ZM-128: Wechsel von der laufenden Live-Folie zu Tabelle bei laufendem Spiel auf Feld 1 → Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1, tabelle], matches: [spiel7('running')], index: 1, wechselSeitUpdate: 1 })).toBe(true);
  });

  it('Gegenbeispiel: Wechsel IN eine laufende Live-Folie → kein Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1, tabelle], matches: [spiel7('running')], index: 0, wechselSeitUpdate: 1 })).toBe(false);
  });

  it('@ZM-124 Zeile 1: Spiel 7 beendet, Folienwechsel zu Tabelle → Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1, tabelle], matches: [beendet], index: 1, wechselSeitUpdate: 1 })).toBe(true);
  });

  it('@ZM-124 Zeile 3: nur eine Live-Folie, Spiel auf Feld 1 läuft → kein Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1], matches: [spiel7('running')], index: 0, wechselSeitUpdate: 0 })).toBe(false);
  });

  it('@ZM-124 Zeile 3: nur eine Live-Folie, Spiel auf Feld 2 läuft (kein Spiel auf Feld 1 der Folie) → kein Neuladen', () => {
    const aufFeld2: RuleMatch[] = [{ id: 'match-8', field: 2, matchStatus: 'running' }];
    expect(neuladenErlaubt({ slides: [liveFeld1], matches: aufFeld2, index: 0, wechselSeitUpdate: 0 })).toBe(false);
  });

  it('@ZM-124 Zeile 3: nur eine Live-Folie, auf keinem Feld läuft ein Spiel → Neuladen ohne Folienwechsel', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1], matches: keinSpiel, index: 0, wechselSeitUpdate: 0 })).toBe(true);
  });

  it('@ZM-124 Zeile 3 Gegenbeispiel: nur eine Live-Folie, Spiel pausiert auf Feld 1 → kein Neuladen', () => {
    expect(neuladenErlaubt({ slides: [liveFeld1], matches: [spiel7('paused')], index: 0, wechselSeitUpdate: 0 })).toBe(false);
  });
});
