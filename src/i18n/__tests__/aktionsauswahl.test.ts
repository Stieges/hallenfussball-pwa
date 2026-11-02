/**
 * @SL-193 @SL-194 @OB-075 Texte der Aktionsauswahl und der Wechsel-Rückfrage, Deutsch und Englisch.
 * Die Beschriftungen stehen im Gherkin wörtlich (Deutsch); Begriffe sind ausgeschrieben (kein „SR“, kein „HF“).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { initRealGlobalI18n } from '../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');

/** Übersetzen mit dynamischem Schlüssel (die Schlüssel der App sind typisiert). */
const t = (key: string, options?: Record<string, unknown>): string => (i18next.t as (k: string, o?: Record<string, unknown>) => string)(key, options);

const DE: Record<string, string> = {
  enterResult: 'Ergebnis eintragen',
  kickOff: 'Im Cockpit anpfeifen',
  shiftFrom: 'Ab hier verschieben',
  changeReferee: 'Schiedsrichter ändern',
  changeField: 'Feld ändern',
  forfeit: 'Nicht angetreten',
  toCockpit: 'Zum Cockpit',
  endAndEnter: 'Spiel beenden und Ergebnis eintragen',
  correct: 'Ergebnis korrigieren',
  protocol: 'Protokoll ansehen',
};

describe('@SL-193 Beschriftungen der Aktionen', () => {
  beforeAll(async () => { await initRealGlobalI18n('de'); });

  it('@SL-193 Deutsch: wörtlich wie im Szenario', async () => {
    await initRealGlobalI18n('de');
    for (const [id, text] of Object.entries(DE)) {
      expect(t(`tournament:actionMenu.actions.${id}`)).toBe(text);
    }
  });

  it('@SL-193 Englisch: jede Aktion ist übersetzt (nicht der deutsche Text, nicht der Schlüssel)', async () => {
    await initRealGlobalI18n('en');
    for (const [id, text] of Object.entries(DE)) {
      const en = t(`tournament:actionMenu.actions.${id}`);
      expect(en).not.toBe(text);
      expect(en).not.toContain('actionMenu');
    }
    expect(t('tournament:actionMenu.actions.correct')).toBe('Correct result');
  });

  it('@OB-075 ausgeschrieben: weder „SR“ noch „HF“ noch „Ref.“ in der Auswahl (Deutsch und Englisch)', async () => {
    for (const lang of ['de', 'en'] as const) {
      await initRealGlobalI18n(lang);
      const alle = JSON.stringify(i18next.getResourceBundle(lang, 'tournament').actionMenu);
      expect(alle).not.toMatch(/\bSR\b|\bHF\b|\bRef\.|\bSp\./);
    }
  });
});

describe('@SL-194 Rückfrage beim Wechsel', () => {
  it('@SL-194 Deutsch: „Spiel 5 läuft weiter. Trotzdem zu Spiel 6 wechseln?“, Taste „Wechseln“', async () => {
    await initRealGlobalI18n('de');
    expect(t('tournament:schedule.runningMatch.message', { running: 5, target: 6 })).toBe('Spiel 5 läuft weiter. Trotzdem zu Spiel 6 wechseln?');
    expect(t('tournament:schedule.runningMatch.confirmSwitch')).toBe('Wechseln');
  });

  it('@SL-194 Englisch: das laufende Spiel läuft weiter, die Taste heißt „Switch“', async () => {
    await initRealGlobalI18n('en');
    expect(t('tournament:schedule.runningMatch.message', { running: 5, target: 6 })).toBe('Match 5 keeps running. Switch to match 6 anyway?');
    expect(t('tournament:schedule.runningMatch.confirmSwitch')).toBe('Switch');
  });

  it('@SL-194 Gegenbeispiel: nichts in der Frage klingt nach Beenden', async () => {
    for (const lang of ['de', 'en'] as const) {
      await initRealGlobalI18n(lang);
      expect(t('tournament:schedule.runningMatch.message', { running: 5, target: 6 })).not.toMatch(/beend|end(ed|s)? |stop/i);
    }
  });
});
