/**
 * R3-2a, Anzeige auf dem Gerät nach dem Abschluss: Einträge, die der Server nach dem Abschluss aufbewahrt hat (Grund
 * AFTER_FINISH), zeigt das Gerät als „Turnier ist abgeschlossen – N Einträge an die Turnierleitung übergeben“.
 * Szenarien: @FU-018 („Toms Gerät zeigt ‚an die Turnierleitung übergeben‘“), @HE-070 Z. 1 / @FU-057 Z. 1 („abgelehnt mit
 * ‚Turnier ist abgeschlossen‘“), @LZ-030 (Korrektur nicht übernommen). Gegenbeispiel: andere Klärungsgründe bleiben „wird geprüft“.
 * Echte i18next-Instanz (DE/EN, Namensräume common + sport wegen der Verweise).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import deSport from '../../../../i18n/locales/de/sport.json';
import enSport from '../../../../i18n/locales/en/sport.json';
import { emptyOutboxStatus, type OutboxStatus } from '../../../../core/match/client/outboxTypes';
import { OutboxNotice } from '../OutboxNotice';

vi.unmock('i18next');
vi.unmock('react-i18next');

/** `matchId: null` = ohne Spielbezug (Gesamtzahl des Geräts). */
async function renderNotice(status: Partial<OutboxStatus>, lng: 'de' | 'en' = 'de', matchId: string | null = 'finale') {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common', 'sport'],
    resources: { de: { common: deCommon, sport: deSport }, en: { common: enCommon, sport: enSport } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  render(
    <I18nextProvider i18n={instance}>
      <OutboxNotice status={{ ...emptyOutboxStatus(), ...status }} {...(matchId !== null ? { matchId } : {})} onReload={vi.fn()} />
    </I18nextProvider>,
  );
}

describe('R3-2a OutboxNotice: „Turnier ist abgeschlossen – an die Turnierleitung übergeben“ (@FU-018, @HE-070, @FU-057)', () => {
  it('@FU-018 @HE-070 ein Eintrag: Turnier ist abgeschlossen, an die Turnierleitung übergeben', async () => {
    await renderNotice({ reviewByMatch: { finale: 1 }, afterFinishByMatch: { finale: 1 } });

    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'tournamentFinished');
    expect(notice.textContent).toBe('Turnier ist abgeschlossen – 1 Eintrag an die Turnierleitung übergeben');
  });

  it('@FU-057 @LZ-030 mehrere Einträge, auf Englisch', async () => {
    await renderNotice({ reviewByMatch: { finale: 3 }, afterFinishByMatch: { finale: 3 } }, 'en');

    expect(screen.getByTestId('outbox-notice').textContent).toBe('The tournament is finished – 3 entries handed to the organisers');
  });

  it('@FU-018 ohne Spielbezug zählt das ganze Gerät', async () => {
    await renderNotice({ reviewByMatch: { finale: 1, hf1: 1 }, afterFinishByMatch: { finale: 1, hf1: 1 } }, 'de', null);

    expect(screen.getByTestId('outbox-notice').textContent).toBe('Turnier ist abgeschlossen – 2 Einträge an die Turnierleitung übergeben');
  });

  it('Gegenbeispiel: ein anderer Klärungsgrund bleibt „wird geprüft“', async () => {
    await renderNotice({ reviewByMatch: { finale: 2 } });

    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'review');
    expect(notice.textContent).toBe('wird geprüft (2)');
  });

  it('Gegenbeispiel: Übergaben eines anderen Spiels erscheinen nicht im Hinweis dieses Spiels', async () => {
    await renderNotice({ reviewByMatch: { hf1: 1 }, afterFinishByMatch: { hf1: 1 } });

    expect(screen.queryByTestId('outbox-notice')).toBeNull();
  });
});
