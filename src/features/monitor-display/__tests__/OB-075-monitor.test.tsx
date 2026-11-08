/**
 * @OB-075 / @OB-076 am Monitor, Deutsch und Englisch: die Tabelle trägt im Kopf die Kurzformen mit ausgeschriebenem Hinweis
 * (Vorlesetext), die Live-Folie ohne laufendes Spiel nennt das nächste Spiel mit „gegen“ bzw. „vs“, und der Satz
 * „Nächstes Spiel in ~5 Minuten“ steht ausgeschrieben (keine Kurzform, auch nicht an der Uhr).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { StandingsTable } from '../components/StandingsTable';
import { LiveSlide } from '../slides/LiveSlide';
import { monitorThemes } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';
import type { PerformanceSettings } from '../../../types/monitor';
import { buildTournament, slide, FIXTURE_MATCHES } from './monitorFixture';
import { withView } from './monitorViewHelper';
import { createRealI18n, type RealLanguage } from '../../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function renderIn(lng: RealLanguage, ui: ReactElement) {
  const i18n = await createRealI18n(lng);
  return { i18n, ...render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>) };
}

const KOEPFE = {
  de: [['#', 'Platz'], ['S', 'Siege'], ['U', 'Unentschieden'], ['N', 'Niederlagen'], ['Diff.', 'Tordifferenz'], ['Pkt.', 'Punkte']],
  en: [['#', 'Position'], ['W', 'Won'], ['D', 'Drawn'], ['L', 'Lost'], ['GD', 'Goal difference'], ['Pts', 'Points']],
} as const;

describe('@OB-075 Monitor-Tabelle: Kurzformen im Kopf mit Vorlesetext', () => {
  it.each(['de', 'en'] as const)('%s: jede Spalte zeigt die Kurzform, trägt den ausgeschriebenen Begriff als title und als Vorlesetext', async (lng) => {
    const t = buildTournament();
    const rows = calculateStandings(t.teams, t.matches, t, 'A');
    const { container } = await renderIn(lng, <StandingsTable rows={rows} themeColors={monitorThemes.dark} />);
    for (const [kurz, lang] of KOEPFE[lng]) {
      const sichtbar = within(container).getByText(kurz, { selector: '[aria-hidden="true"]' });
      expect(sichtbar).toHaveAttribute('title', lang);
      expect(within(container).getByText(lang, { selector: 'span:not([aria-hidden])' })).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/\bPl\.?(?![a-zäöüß])|\bPos\b/);
  });
});

describe('@OB-076 Monitor Live-Folie: das nächste Spiel (seit @ZM-195 als Kästen „0 : 0“)', () => {
  const performanceSettings = {} as PerformanceSettings;
  const ohneLaufendesSpiel = () => buildTournament({ matches: FIXTURE_MATCHES.map((m) => (m.matchStatus === 'running' ? { ...m, matchStatus: 'scheduled' as const } : m)) });

  it.each([['de'], ['en']] as const)('%s: zwischen den Kästen steht der Doppelpunkt, die Namen stehen darunter, kein „vs.“ in den Kästen', async (lng) => {
    await renderIn(lng, <LiveSlide slide={slide('live', { fieldId: 'field-2' })} {...withView(ohneLaufendesSpiel())} performanceSettings={performanceSettings} theme="dark" style={{}} />);
    expect(screen.getByTestId('live-separator')).toHaveTextContent(':');
    expect(screen.getByText('DJK Berg')).toBeInTheDocument();
    expect(screen.queryByText(/^(vs\.?|VS)$/)).toBeNull();
  });
});

describe('@OB-075 Satz „Nächstes Spiel in ~5 Minuten“ (Monitor)', () => {
  it.each([['de', 'Nächstes Spiel in ~5 Minuten'], ['en', 'Next match in ~5 minutes']] as const)('%s: ausgeschrieben, ohne „Min“', async (lng, erwartet) => {
    const { i18n } = await renderIn(lng, <span />);
    const satz = i18n.t('monitor:nextMatch.title', { minutes: 5 });
    expect(satz).toBe(erwartet);
    expect(satz).not.toMatch(/\bMin\b|\bmin\b/);
  });
});
