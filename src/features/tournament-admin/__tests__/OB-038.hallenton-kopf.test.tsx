/**
 * @OB-038 „den Seitenkopf ‚Hallenton‘ in der Verwaltung“ → der gezeichnete Lautsprecher (dasselbe Symbol wie in der Hallenton-Seite),
 * kein Emoji; die Karte „Töne → Hallenton“ im Match Cockpit trägt denselben Lautsprecher mit dem Wort daneben.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { Icons } from '../../../components/ui/Icons';
import { OHNE_EMOJI } from '../../../test/symbolText';

vi.mock('../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('../../hallenton/ui/HallentonSeite', () => ({ HallentonSeite: () => <div data-testid="hallenton-seite" /> }));
vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));

import { HallentonCategory } from '../categories/Hallenton';
import { HallentonKarte } from '../categories/MatchCockpit/HallentonKarte';
import { renderToStaticMarkup } from 'react-dom/server';

const turnier = { id: 't1', title: 'Cup', teams: [], matches: [], numberOfFields: 2 } as unknown as Tournament;
const lautsprecher = renderToStaticMarkup(<Icons.Speaker size={24} />);

describe('@OB-038 Seitenkopf „Hallenton“ in der Verwaltung', () => {
  it('der Kopf zeigt den gezeichneten Lautsprecher und das Wort „Hallenton“, kein Emoji', () => {
    render(<MemoryRouter><HallentonCategory tournamentId="t1" tournament={turnier} /></MemoryRouter>);
    const kopf = screen.getByRole('heading', { level: 1 });
    expect(kopf).toHaveTextContent('Hallenton');
    expect(kopf.textContent).not.toMatch(OHNE_EMOJI);
    const svg = kopf.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.innerHTML).toBe(lautsprecher.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
  });

  it('Match Cockpit: die Karte „Töne → Hallenton“ trägt denselben Lautsprecher, kein Emoji', () => {
    render(<MemoryRouter><HallentonKarte tournamentId="t1" /></MemoryRouter>);
    const titel = screen.getByRole('heading', { level: 3 });
    expect(titel.querySelector('svg')).not.toBeNull();
    expect(titel.textContent).not.toMatch(OHNE_EMOJI);
  });
});
