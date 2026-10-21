/**
 * Test-Hilfen Paket TB-B (Oberfläche): echte i18next-Instanz (DE/EN: tournament, wizard, common), Kontext mit
 * Attrappen für den Dienst, Turniere aus den Referenzdaten (Nikolaus, @W2A-048, Abschnitt 6). Nur Testumgebung.
 */
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import deCommon from '../../../../i18n/locales/de/common.json';
import deTournament from '../../../../i18n/locales/de/tournament.json';
import deWizard from '../../../../i18n/locales/de/wizard.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import enTournament from '../../../../i18n/locales/en/tournament.json';
import enWizard from '../../../../i18n/locales/en/wizard.json';
import { StandingTieContext, type StandingTieContextValue, type StandingTieService } from '../standingTieContext';

export async function i18nWrapper(lng: 'de' | 'en' = 'de'): Promise<({ children }: { children: ReactNode }) => ReactNode> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'de',
    defaultNS: 'tournament',
    ns: ['tournament', 'wizard', 'common'],
    resources: {
      de: { tournament: deTournament, wizard: deWizard, common: deCommon },
      en: { tournament: enTournament, wizard: enWizard, common: enCommon },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return ({ children }) => <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

export interface FakeTie {
  value: StandingTieContextValue;
  decide: ReturnType<typeof vi.fn>;
  withdraw: ReturnType<typeof vi.fn>;
  onChanged: ReturnType<typeof vi.fn>;
  openRules: ReturnType<typeof vi.fn>;
}

/** Kontext-Attrappe: Turnierleitung (`canDecide`), online, Dienst-Attrappen, die `{ ok: true }` melden. */
export function fakeTie(over: Partial<Pick<StandingTieContextValue, 'canDecide' | 'online'>> = {}): FakeTie {
  const decide = vi.fn().mockResolvedValue({ ok: true });
  const withdraw = vi.fn().mockResolvedValue({ ok: true });
  const onChanged = vi.fn();
  const openRules = vi.fn();
  const service = { decide, withdraw } as unknown as StandingTieService;
  return {
    value: { tournamentId: 't-1', canDecide: true, online: true, service, onChanged, openRules, ...over },
    decide, withdraw, onChanged, openRules,
  };
}

export const withTie = (tie: FakeTie, children: ReactNode): ReactNode => (
  <StandingTieContext.Provider value={tie.value}>{children}</StandingTieContext.Provider>
);
