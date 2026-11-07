/**
 * @OB-080 Alle Aktionen einer Turnierkarte sind auf jedem Gerät erreichbar (docs/anforderungen/2026-10-02_oberflaeche.md), @W5-029 „Kopie fürs Proben“
 * beginnt mit „Kopieren“ im Kartenmenü. Das Menü ragt bei den kompakten Karten in die Nachbarkarte; jede Karte ist ein eigener Stapelkontext
 * (backdrop-filter). Die Karte mit offenem Menü muss deshalb über den Nachbarn liegen – auch wenn die Maus sie verlassen hat.
 * (Die Trefferprüfung im echten Browser macht startseite-turniertag.spec.ts, „Zeiger kurz auf ihr, dann Kopieren“.)
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { zIndex } from '../../design-tokens';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { TournamentCard } from '../TournamentCard';

const turnier = (id: string) => ({
  id, title: `Nikolausturnier ${id}`, status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '08:30', location: { name: 'Bergader SportARENA' },
}) as unknown as Tournament;

describe('@OB-080 Karte mit offenem Menü liegt über ihren Nachbarn', () => {
  it('Menü öffnen hebt die Karte, Maus verlassen lässt sie oben, Schließen senkt sie wieder', () => {
    render(
      <>
        <TournamentCard tournament={turnier('f2')} categoryLabel="upcoming" inToday onClick={vi.fn()} onCopy={vi.fn()} />
        <TournamentCard tournament={turnier('f1')} categoryLabel="upcoming" inToday onClick={vi.fn()} onCopy={vi.fn()} />
      </>,
    );
    const oben = screen.getByTestId('tournament-card-f2');
    const nachbar = screen.getByTestId('tournament-card-f1');
    expect(oben.style.zIndex).toBe('auto');

    fireEvent.mouseEnter(oben);
    fireEvent.click(screen.getByTestId('tournament-f2-actions-trigger'));
    expect(screen.getByTestId('action-menu-item-copy')).toBeInTheDocument();
    expect(oben.style.zIndex).toBe(String(zIndex.raised));

    // Zeiger wandert auf die Nachbarkarte: die obere Karte bleibt oben, die Nachbarkarte hebt sich nicht im Stapel
    fireEvent.mouseLeave(oben);
    fireEvent.mouseEnter(nachbar);
    expect(oben.style.zIndex).toBe(String(zIndex.raised));
    expect(nachbar.style.zIndex).toBe('auto');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('action-menu-item-copy')).toBeNull();
    expect(oben.style.zIndex).toBe('auto');
  });
});
