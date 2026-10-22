/**
 * B-49 Wächter (Befund C-HELFER-FELD-OHNE-SPERRE): Die Steuer je Feld (A-34) erkennt das steuernde Gerät nur an der Geräte-ID.
 * - Der Ausgang (`OutboxSender` im `MatchEngineProvider`) sendet sie mit jedem Eintrag (`append_match_events`, `p_device_id`).
 * - Jeder Leser des Feld-Stands übergibt sie: ohne sie meldet `field_control_state` nie `isMine`, das steuernde Gerät sähe sich
 *   selbst als fremden Halter. Das gilt auch für `readForeignFieldHolder` (Variante A „Spiel beenden“, Branch
 *   `feat/spielplan-spiel-beenden`): Nach dem Zusammenführen muss jeder Aufruf `getDeviceId()` als 4. Argument tragen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../..');

function quellen(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'test' ? [] : quellen(path);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const dateien = quellen(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('B-49 Geräte-ID an jedem Weg der Steuer je Feld', () => {
  it('@FU-026 @FU-030 der Ausgang bekommt die Geräte-ID (MatchEngineProvider → OutboxSender)', () => {
    const provider = readFileSync(join(SRC, 'features/match-engine/MatchEngineProvider.tsx'), 'utf8');
    const sender = provider.slice(provider.indexOf('new OutboxSender({'), provider.indexOf('});', provider.indexOf('new OutboxSender({')));
    expect(sender).toMatch(/deviceId: getDeviceId\(\)/);
  });

  it('@HE-049 jeder Aufruf von field_control_state sendet p_device_id ohne Bedingung', () => {
    const aufrufe = dateien.filter((d) => d.text.includes("rpc('field_control_state'"));
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const { path, text } of aufrufe) {
      const ab = text.indexOf("rpc('field_control_state'");
      const block = text.slice(ab, text.indexOf('})', ab));
      // eigene Zeile `p_device_id: deviceId,` – nicht als bedingter Teil `...(deviceId !== undefined ? { p_device_id: deviceId } : {})`
      expect(block, path).toMatch(/^\s*p_device_id: deviceId,?\s*$/m);
      expect(block, path).not.toMatch(/\?\s*\{\s*p_device_id/);
    }
  });

  it('@FU-081 jeder Aufruf von readForeignFieldHolder übergibt die Geräte-ID (4. Argument)', () => {
    for (const { path, text } of dateien) {
      for (const m of text.matchAll(/(?<!function )readForeignFieldHolder\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
        expect(m[1].split(',').length, `${path}: ${m[0]}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

/** Prüfung 2 gegen beide Formen (Review #341 N4): so wie hier erkannt, so wie in Variante A (#337) abgelehnt. */
describe('B-49 Wächter erkennt ein bedingtes p_device_id', () => {
  const muster = (block: string): boolean => /^\s*p_device_id: deviceId,?\s*$/m.test(block) && !/\?\s*\{\s*p_device_id/.test(block);
  it('@HE-049 unbedingt (eigene Zeile) → erlaubt', () => {
    expect(muster("rpc('field_control_state', {\n      p_tournament_id: tournamentId,\n      p_device_id: deviceId,\n    ")).toBe(true);
  });
  it('@HE-049 Gegenbeispiel: bedingt (Variante A) → abgelehnt', () => {
    expect(muster("rpc('field_control_state', {\n      p_tournament_id: tournamentId,\n      ...(deviceId !== undefined ? { p_device_id: deviceId } : {}),\n    ")).toBe(false);
  });
});
