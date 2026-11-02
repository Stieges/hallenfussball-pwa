/**
 * @OB-075 Kurzformen nur in Tabellenköpfen, mit dem ausgeschriebenen Begriff als Hinweis zum Darüberfahren (title) und für
 * Screenreader (Text nur zum Vorlesen); @OB-076 das Wort zwischen zwei Mannschaften folgt der Sprache.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { createRealI18n, type RealLanguage } from '../../../../test/realI18n';
import { ShortLabel } from '../ShortLabel';
import { Versus } from '../Versus';
import { SHORT_TERMS, type TableHeadTerm } from '../shortTerms';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function renderIn(lng: RealLanguage, ui: ReactElement) {
  const i18n = await createRealI18n(lng);
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

const KURZ_LANG: Array<[TableHeadTerm, RealLanguage, string, string]> = [
  ['rank', 'de', '#', 'Platz'],
  ['rank', 'en', '#', 'Position'],
  ['played', 'de', 'Sp.', 'Spiele'],
  ['played', 'en', 'P', 'Played'],
  ['won', 'de', 'S', 'Siege'],
  ['won', 'en', 'W', 'Won'],
  ['drawn', 'de', 'U', 'Unentschieden'],
  ['drawn', 'en', 'D', 'Drawn'],
  ['lost', 'de', 'N', 'Niederlagen'],
  ['lost', 'en', 'L', 'Lost'],
  ['goalDifference', 'de', 'Diff.', 'Tordifferenz'],
  ['goalDifference', 'en', 'GD', 'Goal difference'],
  ['points', 'de', 'Pkt.', 'Punkte'],
  ['points', 'en', 'Pts', 'Points'],
  ['number', 'de', 'Nr.', 'Nummer'],
  ['number', 'en', 'No.', 'Number'],
];

describe('ShortLabel: Kurzform mit ausgeschriebenem Begriff (@OB-075)', () => {
  it.each(KURZ_LANG)('%s (%s): sichtbar „%s“, Hinweis und Vorlesetext „%s“', async (term, lng, kurz, lang) => {
    const { container } = await renderIn(lng, <ShortLabel term={term} />);
    const wurzel = container.firstElementChild as HTMLElement;
    // Maus und Touch: title an der sichtbaren Kurzform
    const sichtbar = wurzel.querySelector('[aria-hidden="true"]');
    expect(sichtbar?.textContent).toBe(kurz);
    expect(sichtbar).toHaveAttribute('title', lang);
    // Der Screenreader liest den ausgeschriebenen Begriff genau einmal (die Kurzform samt title ist für ihn ausgeblendet)
    expect(wurzel).not.toHaveAttribute('title');
    expect(screen.getByText(lang)).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText(lang)).not.toHaveAttribute('title');
    expect(wurzel.querySelectorAll('[title]')).toHaveLength(1);
  });

  it('Gleichlauf: jede Kurzform der Komponente ist ein Schlüssel im Namensraum short und der Begriff ein Schlüssel in sport', () => {
    for (const keys of Object.values(SHORT_TERMS)) {
      expect(keys.short.startsWith('short:')).toBe(true);
      expect(keys.long.startsWith('sport:')).toBe(true);
    }
  });
});

describe('Versus: das Wort zwischen zwei Mannschaften (@OB-076)', () => {
  it('Deutsch: „DJK Kammer gegen TSV Petting“', async () => {
    const { container } = await renderIn('de', <p>DJK Kammer <Versus /> TSV Petting</p>);
    expect(container.textContent).toBe('DJK Kammer gegen TSV Petting');
  });

  it('Englisch: „DJK Kammer vs TSV Petting“', async () => {
    const { container } = await renderIn('en', <p>DJK Kammer <Versus /> TSV Petting</p>);
    expect(container.textContent).toBe('DJK Kammer vs TSV Petting');
  });

  it('Gegenbeispiel: auf Deutsch nie „vs“ oder „VS“', async () => {
    const { container } = await renderIn('de', <p><Versus /></p>);
    expect(container.textContent).not.toMatch(/vs/i);
  });
});
