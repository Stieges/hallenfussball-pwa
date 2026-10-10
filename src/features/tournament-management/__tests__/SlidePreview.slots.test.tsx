/**
 * SlidePreview (Monitor-Konfiguration, Vorschau) – A-04a: Spielseiten über slotLabel.
 * @TM-015 offene Seite zeigt ihre Herkunft; Gegenbeispiel: Umbenennen wirkt, kein gespeicherter Name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import i18next from 'i18next';
import { render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';
import { teamSlot, pendingSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { SlidePreview } from '../components/SlidePreview';

vi.mock('i18next', async () => {
  const actual = await vi.importActual<typeof import('i18next')>('i18next');
  const de = (await import('../../../i18n/locales/de/tournament.json')).default;
  const instance = actual.default.createInstance();
  await instance.init({ lng: 'de', fallbackLng: false, resources: { de: { tournament: de } }, interpolation: { escapeValue: false } });
  return { default: instance };
});

const NORD = testUuid(1);

function tournamentWith(teamName: string): Tournament {
  return {
    id: 't1',
    teams: [{ id: NORD, name: teamName }],
    groups: [],
    matches: [{
      id: testUuid(101), round: 1, field: 1, teamA: 'ALT', teamB: 'ALT',
      slotA: teamSlot(NORD), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
    }],
  } as unknown as Tournament;
}

const slide = (type: 'live' | 'schedule-field'): MonitorSlide => ({
  id: 's1', type, config: { fieldId: 'field-1' }, duration: null, order: 0,
});

describe('SlidePreview – Spielseiten über slotLabel', () => {
  // Das Modul zieht die App-i18n nach; die Sprache für den gerenderten Text ausdrücklich setzen
  beforeEach(async () => { await i18next.changeLanguage('de'); });

  it('@TM-015 Live-Vorschau: Teamname über die Team-ID, offene Seite über ihre Herkunft', () => {
    render(<SlidePreview slide={slide('live')} tournament={tournamentWith('FC Nord')} />);
    expect(screen.getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByText('Zweiter')).toBeInTheDocument(); // erste 8 Zeichen von „Zweiter Gruppe B“
  });

  it('@TM-015 Spielplan-Vorschau: Seiten über slotLabel; Gegenbeispiel: Umbenennen zeigt den neuen Namen', () => {
    render(<SlidePreview slide={slide('schedule-field')} tournament={tournamentWith('Nordlicht')} />);
    expect(screen.getByText('Nordli')).toBeInTheDocument();
    expect(screen.queryByText('ALT')).toBeNull();
    expect(screen.getByText('Zweite')).toBeInTheDocument();
  });
});
