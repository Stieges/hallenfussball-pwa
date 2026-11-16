/**
 * @OB-038 „die Hinweise und die Fehlerseite der Zuschauer-Seite“ → gezeichnete Symbole (Pokal, Schloss, Lupe, Warnung) mit dem Text.
 * Der Text enthält kein Emoji (Deutsch und Englisch); das Symbol steht im Baustein und ist Schmuck, der Text trägt die Aussage.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicInfoTab } from '../components/PublicInfoTab';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import { PublicNotFoundView, PublicErrorView } from '../components/PublicStatusViews';
import { createMockTournament } from '../../../test/factories';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { OHNE_EMOJI, OHNE_SYMBOLERSATZ } from '../../../test/symbolText';
import deTexte from '../../../i18n/locales/de/publicView.json';
import enTexte from '../../../i18n/locales/en/publicView.json';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const sichtbar = (el: Element): string => el.textContent ?? '';

describe('@OB-038 Zuschauer-Seite: Hinweise', () => {
  it('„Tabellen ausgeblendet“: Pokal als gezeichnetes Symbol, im Text kein Emoji', () => {
    const turnier = createMockTournament({ hideRankingsForPublic: true });
    render(<PublicStandingsTab tournament={turnier} standings={[]} />);
    const symbol = screen.getByTestId('public-standings-hidden-icon');
    expect(symbol.querySelector('svg')).not.toBeNull();
    expect(symbol).toHaveAttribute('aria-hidden', 'true');
    const zeile = symbol.parentElement!;
    expect(sichtbar(zeile)).toBe('Tabellen ausgeblendet');
    expect(sichtbar(zeile)).not.toMatch(OHNE_EMOJI);
  });

  it('„Bambini-Modus aktiv“: Schloss als gezeichnetes Symbol, im Text kein Emoji', () => {
    const turnier = createMockTournament({ hideScoresForPublic: true });
    render(<PublicInfoTab tournament={turnier} theme="system" setTheme={vi.fn()} resolvedTheme="light" />);
    const symbol = screen.getByTestId('public-info-bambini-icon');
    expect(symbol.querySelector('svg')).not.toBeNull();
    expect(symbol).toHaveAttribute('aria-hidden', 'true');
    expect(sichtbar(symbol.parentElement!)).toBe('Bambini-Modus aktiv');
    expect(sichtbar(symbol.parentElement!)).not.toMatch(OHNE_EMOJI);
  });
});

describe('@OB-038 Zuschauer-Seite: Fehlerseiten', () => {
  it('„Turnier nicht gefunden“: Lupe als gezeichnetes Symbol, im Text kein Emoji', () => {
    const { container } = render(<PublicNotFoundView />);
    expect(screen.getByTestId('public-not-found-icon').querySelector('svg')).not.toBeNull();
    expect(sichtbar(container)).toBe('Turnier nicht gefunden oder nicht öffentlich');
    expect(sichtbar(container)).not.toMatch(OHNE_EMOJI);
  });

  it('Fehleransicht: Warnung als gezeichnetes Symbol, im Text kein Emoji, „Erneut versuchen“ bleibt', () => {
    const { container } = render(<PublicErrorView errorMessage="Netz weg" onRetry={() => Promise.resolve()} />);
    expect(screen.getByTestId('public-error-icon').querySelector('svg')).not.toBeNull();
    expect(sichtbar(container)).not.toMatch(OHNE_EMOJI);
    expect(sichtbar(container)).not.toMatch(OHNE_SYMBOLERSATZ);
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });
});

describe('@OB-038 Zuschauer-Texte in Deutsch und Englisch ohne Emoji', () => {
  const blaetter = (o: unknown): string[] => (typeof o === 'string' ? [o] : o !== null && typeof o === 'object' ? Object.values(o).flatMap(blaetter) : []);
  it.each([['de', deTexte], ['en', enTexte]] as const)('%s: kein Text der Zuschauer-Seite enthält ein Emoji', (_sprache, texte) => {
    expect(blaetter(texte).filter((t) => OHNE_EMOJI.test(t))).toEqual([]);
  });
});
