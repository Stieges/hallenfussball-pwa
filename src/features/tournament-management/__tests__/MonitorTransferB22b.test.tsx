/**
 * Monitore übernehmen – fehlendes Feld/Gruppe, Umbenennen, eigener QR-Link (B-22b) – echter Bedienweg:
 * Dialog → Service → Speichern (und Monitor-Editor für den Warnhinweis).
 * Pflicht: @ME-061 (Feld/Gruppe fehlt), @ME-062 (Umbenennen), @ME-063 (eigener QR-Link)
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorsConfigTab } from '../MonitorsConfigTab';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

const { mockActive } = vi.hoisted(() => ({ mockActive: { current: [] as unknown[] } }));

vi.mock('../../../hooks', async () => {
  const monitors = await import('../../../hooks/useMonitors');
  const sponsors = await import('../../../hooks/useSponsors');
  const fields = await import('../../../hooks/useFields');
  return { useMonitors: monitors.useMonitors, useSponsors: sponsors.useSponsors, useFields: fields.useFields };
});

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ activeTournaments: mockActive.current, loading: false }),
}));

vi.mock('../../auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner' }),
}));

vi.mock('../../../hooks/useMonitorHeartbeats', () => ({
  useMonitorHeartbeats: () => new Map(),
}));

function monitor(overrides: Partial<TournamentMonitor> = {}): TournamentMonitor {
  return {
    id: 'mon-nord',
    name: 'Hallenmonitor Halle',
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    theme: 'dark',
    performanceMode: 'auto',
    slides: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function tournament(overrides: Partial<Tournament> & { id: string }): Tournament {
  return { title: overrides.id, teams: [], matches: [], monitors: [], sponsors: [], ...overrides } as unknown as Tournament;
}

const SV_NORD = { id: 'sp-nord', name: 'SV Nord', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };

/**
 * Quelle mit einer Folie für Feld 2, einer Tabelle für Gruppe C und einer Sponsor-Folie mit eigenem QR-Ziel.
 * Die Sponsor-Folie ist der Träger, der qrTarget auswertet (K1); die QR-Folie tut das nicht.
 */
function nordMit(customQrUrl: string): Tournament {
  return tournament({
    id: 'nord',
    title: 'Hallencup Nord',
    sponsors: [SV_NORD],
    monitors: [monitor({
      slides: [
        { id: 'sl-1', type: 'live', config: { fieldId: 'field-2' }, duration: null, order: 0 },
        { id: 'sl-2', type: 'standings', config: { groupId: 'C' }, duration: null, order: 1 },
        { id: 'sl-3', type: 'sponsor', config: { sponsorId: 'sp-nord', qrTarget: 'custom', customQrUrl }, duration: null, order: 2 },
      ],
    })],
  });
}

const nordZweiFelder = nordMit('https://sv-nord.de');

/** Zielturnier „Süd“ mit nur einem Feld, zwei Gruppen und dem Sponsor aus der Quelle (Zuordnung über den Namen) */
const sued = tournament({
  id: 'sued', title: 'Hallencup Süd', numberOfFields: 1, numberOfGroups: 2,
  sponsors: [{ ...SV_NORD, id: 'sp-sued' }],
});

function renderTab(target: Tournament) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(<MonitorsConfigTab tournament={target} onTournamentUpdate={onUpdate} />);
  return onUpdate;
}

async function chooseSource(id: string) {
  await userEvent.click(screen.getByTestId('monitors-transfer-open'));
  await userEvent.click(await screen.findByTestId(`transfer-source-${id}`));
}

function savedTournament(onUpdate: ReturnType<typeof vi.fn>): Tournament {
  return onUpdate.mock.calls[0][0] as Tournament;
}

function jsonFile(body: unknown, name = 'monitore.json'): File {
  return new File([JSON.stringify(body)], name, { type: 'application/json' });
}

describe('Monitore übernehmen – B-22b', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActive.current = [nordZweiFelder, sued];
  });

  describe('@ME-061 fehlendes Feld oder Gruppe', () => {
    it('zeigt für eine Feld-Folie „Umstellen“ und „Entfernen“; ohne Wahl bleibt die Folie', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');

      expect(screen.getByTestId('transfer-issue-0:0')).toBeInTheDocument();
      expect(screen.getByTestId('transfer-issue-0:0-reassign-field')).toBeInTheDocument();
      expect(screen.getByTestId('transfer-issue-0:0-remove')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const saved = savedTournament(onUpdate).monitors ?? [];
      expect(saved[0].slides[0].config.fieldId).toBe('field-2');
    });

    it('„Auf Feld 1 umstellen“ setzt die Folie auf Feld 1', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-issue-0:0-reassign-field'));
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(savedTournament(onUpdate).monitors?.[0].slides[0].config.fieldId).toBe('field-1');
    });

    it('„Folie entfernen“ nimmt die Folie nicht mit', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-issue-0:0-remove'));
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(savedTournament(onUpdate).monitors?.[0].slides.map(s => s.type)).toEqual(['standings', 'sponsor']);
    });

    it('Tabellen-Folie mit fehlender Gruppe: „Alle Tabellen zeigen“ macht eine Gesamttabelle', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-issue-0:1-all-groups'));
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const slides = savedTournament(onUpdate).monitors?.[0].slides ?? [];
      expect(slides[1].type).toBe('all-standings');
    });

    it('Gegenbeispiel: hat das Zielturnier das Feld und die Gruppe, gibt es keinen Hinweis', async () => {
      const zwei = tournament({ id: 'sued', title: 'Hallencup Süd', numberOfFields: 2, numberOfGroups: 3 });
      mockActive.current = [nordZweiFelder, zwei];
      renderTab(zwei);
      await chooseSource('nord');

      expect(screen.queryByTestId('transfer-issues')).not.toBeInTheDocument();
    });

    it('Monitor-Editor zeigt an der Folie einen Warnhinweis, bis Feld oder Gruppe passen', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-confirm'));
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

      const saved = savedTournament(onUpdate);
      const { rerender } = render(
        <MonitorEditor tournament={saved} monitorId={saved.monitors?.[0].id ?? ''} onTournamentUpdate={vi.fn()} onClose={vi.fn()} />
      );
      expect(screen.getAllByTestId('slide-reference-warning').length).toBeGreaterThan(0);

      const angepasst = tournament({
        ...saved,
        monitors: [{ ...saved.monitors![0], slides: [{ ...saved.monitors![0].slides[0], config: { fieldId: 'field-1' } }, ...saved.monitors![0].slides.slice(1)] }],
      });
      rerender(<MonitorEditor tournament={angepasst} monitorId={angepasst.monitors?.[0].id ?? ''} onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getAllByTestId('slide-reference-warning')).toHaveLength(1);
    });
  });

  describe('@ME-062 Umbenennen', () => {
    it('vergibt „Halle (2)“ bei vorhandenem Namen und meldet es', async () => {
      const onUpdate = renderTab(tournament({ id: 'sued', title: 'Hallencup Süd', monitors: [monitor({ id: 'mon-bestand', name: 'Halle' })] }));
      mockActive.current = [tournament({ id: 'nord', title: 'Hallencup Nord', monitors: [monitor({ name: 'Halle' })] }), sued];
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(savedTournament(onUpdate).monitors?.[1].name).toBe('Halle (2)');
      expect(await screen.findByTestId('transfer-renamed')).toHaveTextContent('monitors.transfer.renamed');
    });

    it('Gegenbeispiel: ohne Namenskonflikt kein Umbenennen-Hinweis', async () => {
      renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await screen.findByTestId('transfer-done');
      expect(screen.queryByTestId('transfer-renamed')).not.toBeInTheDocument();
    });
  });

  describe('@ME-063 eigener QR-Link', () => {
    it('nimmt den eigenen Link aus einem eigenen Turnier mit', async () => {
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const qr = savedTournament(onUpdate).monitors?.[0].slides[2].config;
      expect(qr?.qrTarget).toBe('custom');
      expect(qr?.customQrUrl).toBe('https://sv-nord.de');
      await screen.findByTestId('transfer-done');
      expect(screen.queryByTestId('transfer-custom-qr-invalid')).not.toBeInTheDocument();
    });

    it('ungültige eigene Adresse aus dem Turnier (javascript:) wird verworfen und gemeldet (M1)', async () => {
      mockActive.current = [nordMit('javascript:alert(1)'), sued];
      const onUpdate = renderTab(sued);
      await chooseSource('nord');
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const qr = savedTournament(onUpdate).monitors?.[0].slides[2].config;
      expect(qr?.qrTarget).toBeUndefined();
      expect(qr?.customQrUrl).toBeUndefined();
      expect(qr?.sponsorId).toBe('sp-sued');
      expect(await screen.findByTestId('transfer-custom-qr-invalid')).toHaveTextContent('monitors.transfer.customQrInvalid');
    });

    it('aus einer Datei wird der eigene Link nicht übernommen und gemeldet', async () => {
      const onUpdate = renderTab(sued);
      await userEvent.click(screen.getByTestId('monitors-transfer-open'));
      const file = jsonFile({
        kind: 'monitor-config', version: 1,
        monitors: [{
          name: 'Datei-Monitor', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
          theme: 'dark', performanceMode: 'auto',
          slides: [{ type: 'sponsor', config: { sponsorName: 'SV Nord', qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' }, duration: null }],
        }],
      });
      await userEvent.upload(screen.getByTestId('transfer-file'), file);
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      const qr = savedTournament(onUpdate).monitors?.[0].slides[0].config;
      expect(qr?.qrTarget).toBeUndefined();
      expect(qr?.customQrUrl).toBeUndefined();
      expect(await screen.findByTestId('transfer-custom-qr-file')).toBeInTheDocument();
    });

    it('Gegenbeispiel: Datei mit QR-Ziel ohne eigenen Link zeigt keinen Hinweis und behält das Ziel', async () => {
      const onUpdate = renderTab(sued);
      await userEvent.click(screen.getByTestId('monitors-transfer-open'));
      const file = jsonFile({
        kind: 'monitor-config', version: 1,
        monitors: [{
          name: 'Datei-Monitor', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
          theme: 'dark', performanceMode: 'auto',
          slides: [{ type: 'sponsor', config: { sponsorName: 'SV Nord', qrTarget: 'sponsor-website' }, duration: null }],
        }],
      });
      await userEvent.upload(screen.getByTestId('transfer-file'), file);
      await userEvent.click(screen.getByTestId('transfer-confirm'));

      await screen.findByTestId('transfer-done');
      expect(screen.queryByTestId('transfer-custom-qr-file')).not.toBeInTheDocument();
      await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
      expect(savedTournament(onUpdate).monitors?.[0].slides[0].config.qrTarget).toBe('sponsor-website');
    });
  });
});
