/**
 * R3-4 Texte zu abgelehnten Abschlüssen. Erwartungen aus dem Gherkin (@LZ-019, @LZ-022, @LZ-024, @LZ-026) und aus Review #393 H-5:
 * der Dialog behauptet nie, jemand anderes habe abgeschlossen, wenn der Server keine Person nennt.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import i18n from 'i18next';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { FinishT } from '../model/finishItems';
import { rejectionView } from '../model/finishRejection';

const t: FinishT = (key, options) => String(i18n.t(key, options as never));
beforeAll(async () => { await initRealDeI18n(); });

describe('@LZ-026 / H-5 Das Turnier ist schon abgeschlossen', () => {
  it('der Server nennt Maria → „Das Turnier hat Maria bereits abgeschlossen“ (mit Zeit)', () => {
    const v = rejectionView({ code: 'ALREADY_FINISHED', at: '2026-11-28T12:10:00.000Z', by: 'Maria' }, t);
    expect(v.text).toMatch(/^Das Turnier hat Maria bereits abgeschlossen \(am .+, \d\d:\d\d Uhr\)\.$/);
    expect(v.action).toBe('close');
  });

  it('H-5: ohne Person (eigener Versuch war doch angekommen) steht KEIN Name und kein „von jemand anderem“', () => {
    const v = rejectionView({ code: 'ALREADY_FINISHED', at: null }, t);
    expect(v.text).toBe('Das Turnier ist bereits abgeschlossen.');
    expect(v.text).not.toMatch(/jemand|anderen|von /i);
  });

  it('ein leerer Name zählt nicht als Person', () => {
    expect(rejectionView({ code: 'ALREADY_FINISHED', at: null, by: '  ' }, t).text).toBe('Das Turnier ist bereits abgeschlossen.');
  });
});

describe('Ablehnungen in Klartext, mit dem nächsten Schritt', () => {
  it('@LZ-024 Speichern gescheitert: „nichts verändert“, Haupttaste „Erneut versuchen“', () => {
    const v = rejectionView({ code: 'UNEXPECTED' }, t);
    expect(v.title).toBe('Das Turnier ist noch nicht abgeschlossen.');
    expect(v.text).toContain('Es wurde nichts verändert, das Turnier läuft weiter.');
    expect(v.action).toBe('retry');
  });

  it('E4 eigener Ausgang: „Erst übertragen“ mit der Zahl (Einzahl und Mehrzahl)', () => {
    expect(rejectionView({ code: 'OWN_OUTBOX', pending: 1 }, t).text).toContain('noch 1 Eintrag nicht übertragen');
    expect(rejectionView({ code: 'OWN_OUTBOX', pending: 3 }, t).text).toContain('noch 3 Einträge nicht übertragen');
  });

  it('E4 Stand geändert: Haupttaste „Stand neu laden“', () => {
    expect(rejectionView({ code: 'STALE_STATE' }, t).action).toBe('reloadState');
  });

  it('@LZ-022 kein Recht und Gast-Turnier: keine Wiederholung anbieten', () => {
    expect(rejectionView({ code: 'FORBIDDEN' }, t).action).toBe('close');
    expect(rejectionView({ code: 'LOCAL' }, t).action).toBe('close');
  });

  it('Gegenbeispiel: kein Text zeigt einen technischen Code', () => {
    const all = [
      { code: 'STALE_STATE' }, { code: 'PROVISIONAL' }, { code: 'CHECK_FAILED' }, { code: 'REQUEST_ID_CONFLICT' },
      { code: 'INVALID_STANDINGS', reason: 'TEAM_SET' }, { code: 'NOT_RUNNING', lifecycle: 'fixed' }, { code: 'NOT_RUNNING', lifecycle: 'cancelled' },
    ] as const;
    for (const reason of all) {
      const v = rejectionView(reason, t);
      expect(`${v.title ?? ''} ${v.text}`).not.toMatch(/STALE_STATE|PROVISIONAL|REQUEST_ID|INVALID_|NOT_RUNNING|TEAM_SET|tournament:finish/);
    }
  });
});
