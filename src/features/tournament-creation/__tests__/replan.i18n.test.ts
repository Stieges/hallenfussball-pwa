import { describe, it, expect, beforeAll } from 'vitest';
import { vi } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { openReplan, formatReplanTime } from '../utils/replan';
import deWizard from '../../../i18n/locales/de/wizard.json';
import enWizard from '../../../i18n/locales/en/wizard.json';

type I18nInstance = {
  t: (key: string, opts?: Record<string, unknown>) => string;
  changeLanguage: (lng: string) => Promise<unknown>;
  language: string;
};

let i18n: I18nInstance;

beforeAll(async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const instance = actual.createInstance();
  await instance.init({
    lng: 'de',
    fallbackLng: 'de',
    resources: {
      de: { wizard: deWizard },
      en: { wizard: enWizard },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  i18n = instance as unknown as I18nInstance;
});

const match = (id: string): Match =>
  ({ id, round: 1, field: 1, teamA: 'a', teamB: 'b' });

const tournament = (): Tournament =>
  ({
    id: 't1',
    matches: [match('m1')],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    teams: [
      { id: '1', name: 'A', isRemoved: true },
      { id: '2', name: 'B', isRemoved: true },
    ],
  }) as unknown as Tournament;

describe('W4 – Grund und Vorschlag als i18n-Schlüssel', () => {
  it('liefert reasonKey/suggestionKey statt deutschen Rohtext', () => {
    const session = openReplan(tournament(), tournament(), 'not-started');
    const preview = session.preview;
    expect(preview.status).toBe('impossible');
    if (preview.status !== 'impossible') {
      return;
    }
    expect(preview.reasonKey).toBeTruthy();
    expect(preview.suggestionKey).toBeTruthy();
    expect(preview.reasonKey).toMatch(/^[a-zA-Z0-9_.]+$/);
    expect(preview.suggestionKey).toMatch(/^[a-zA-Z0-9_.]+$/);
    expect(preview.reasonKey).not.toMatch(/[äöüÄÖÜß]/);
    expect(preview.suggestionKey).not.toMatch(/[äöüÄÖÜß]/);
  });

  it('löst die Schlüssel mit echter i18n-Instanz in DE und EN auf', async () => {
    const session = openReplan(tournament(), tournament(), 'not-started');
    const preview = session.preview;
    if (preview.status !== 'impossible') {
      return;
    }
    const { reasonKey, suggestionKey } = preview;
    await i18n.changeLanguage('de');
    const reasonDe = i18n.t(reasonKey, { ns: 'wizard' });
    const suggestionDe = i18n.t(suggestionKey, { ns: 'wizard' });
    await i18n.changeLanguage('en');
    const reasonEn = i18n.t(reasonKey, { ns: 'wizard' });
    const suggestionEn = i18n.t(suggestionKey, { ns: 'wizard' });
    expect(reasonDe).not.toBe(reasonKey);
    expect(suggestionDe).not.toBe(suggestionKey);
    expect(reasonDe).not.toBe(reasonEn);
    expect(suggestionDe).not.toBe(suggestionEn);
    expect(reasonEn).not.toMatch(/[äöüÄÖÜß]/);
    expect(suggestionEn).not.toMatch(/[äöüÄÖÜß]/);
  });

  it('enthält „hinzufügen“ mit Umlaut in der DE-Übersetzung', async () => {
    await i18n.changeLanguage('de');
    const minRest = i18n.t('replan.suggestionMinRestOrAddField', { ns: 'wizard' });
    const collision = i18n.t('replan.suggestionCollision', { ns: 'wizard' });
    expect(minRest).toContain('hinzufügen');
    expect(collision).toContain('hinzufügen');
    expect(minRest).not.toMatch(/hinzufuegen/);
    expect(collision).not.toMatch(/hinzufuegen/);
  });

  it('formatiert die Uhrzeit nach der gewählten Sprache', async () => {
    const date = new Date('2030-01-01T14:30:00Z');
    await i18n.changeLanguage('de');
    const de = formatReplanTime(date, i18n.language);
    await i18n.changeLanguage('en');
    const en = formatReplanTime(date, i18n.language);
    expect(de).not.toBe(en);
    expect(de.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
  });
});
