/**
 * @SL-129 / G3 (Fixrunde 1 Teil b) — Die Konsequenz-Texte von
 * „Spielplan zurücksetzen" (DANGER_ACTIONS.reset_schedule) behaupten fälschlich,
 * Event-Log und Torschützenliste würden gelöscht/ geleert. Der Code löscht
 * weder match_events noch die Torschützenliste (DangerZone.resetKeepsEvents,
 * @SL-129: „Zurücksetzen" behält die Spiel-Ereignisse). Der positive Text
 * (was erhalten bleibt) liefert A-10 — bis dahin weglassen statt lügen.
 *
 * Test: keine Konsequenz behauptet „Event-Log wird gelöscht" oder
 *   „Torschützenliste wird geleert".
 * Gegenprobe (manuell): Wiedereinfügen der Texte macht den Test rot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DANGER_ACTIONS } from '../admin.constants';

const FALSCH = [/Event-Log wird gelöscht/i, /Torschützenliste wird geleert/i];

describe('Gefahrenbereich — Konsequenz-Texte von „Spielplan zurücksetzen" (@SL-129, G3)', () => {
  it('keine Konsequenz behauptet das Löschen von Event-Log oder Torschützenliste', () => {
    for (const pattern of FALSCH) {
      expect(DANGER_ACTIONS.reset_schedule.consequences.join('\n')).not.toMatch(pattern);
    }
  });

  it('die falschen Texte stehen auch in keiner Sprachdatei (DE/EN)', () => {
    for (const lang of ['de', 'en']) {
      const file = resolve(process.cwd(), `src/i18n/locales/${lang}/admin.json`);
      const content = readFileSync(file, 'utf8');
      for (const pattern of FALSCH) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
