/**
 * @ZM-212 Das Profil „Halle (sehr fern)“ in der Monitor-Datei (Export und Import): es wandert mit; ein unbekannter Wert (neuere Datei)
 * gilt als nicht gesetzt, die Datei bleibt lesbar. Bestehende Dateien ohne Profil ändern sich nicht (kein neues Feld im Export).
 */
import { describe, it, expect } from 'vitest';
import type { TournamentMonitor } from '../../../types/monitor';
import { exportMonitorConfig, importMonitorConfig, instantiateMonitorConfig, HALLEN_STANDARD } from '../monitorConfigTransfer';

const NOW = '2026-11-17T10:00:00.000Z';
const monitor = (profile?: TournamentMonitor['profile']): TournamentMonitor => ({
  id: 'mon-1', name: 'Hallenmonitor Feld 1', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark', performanceMode: 'auto',
  ...(profile === undefined ? {} : { profile }),
  slides: [{ id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 }],
  createdAt: NOW, updatedAt: NOW,
});
const optionen = { existingNames: [] as string[], generateId: (kind: string) => `${kind}-neu`, now: NOW, sponsors: [], addSponsor: () => 'sp' };

describe('@ZM-212 Profil in der Monitor-Datei', () => {
  it('Export trägt das Profil „Halle (sehr fern)“ mit', () => {
    expect(exportMonitorConfig([monitor('hall-very-far')], []).monitors[0].profile).toBe('hall-very-far');
  });

  it('Gegenbeispiel: ein Monitor ohne Profil exportiert kein Feld `profile` (Dateien bestehender Monitore bleiben gleich)', () => {
    expect('profile' in exportMonitorConfig([monitor()], []).monitors[0]).toBe(false);
  });

  it('Rundlauf: Export → Datei → Import → Übernahme ergibt wieder das Profil', () => {
    const datei = JSON.stringify(exportMonitorConfig([monitor('hall-very-far')], []));
    const gelesen = importMonitorConfig(datei);
    if (!gelesen.ok) { throw new Error('Import schlug fehl'); }
    const [uebernommen] = instantiateMonitorConfig(gelesen.payload, optionen).monitors;
    expect(uebernommen.profile).toBe('hall-very-far');
  });

  it('Gegenbeispiel: die Vorlage „Hallen-Standard“ übernimmt kein Profil', () => {
    const [uebernommen] = instantiateMonitorConfig(HALLEN_STANDARD, optionen).monitors;
    expect('profile' in uebernommen).toBe(false);
  });

  it('Ein unbekannter Profilwert in der Datei (neuere Fassung) macht die Datei nicht unlesbar: er gilt als nicht gesetzt', () => {
    const datei = JSON.stringify({ ...exportMonitorConfig([monitor()], []), monitors: [{ ...exportMonitorConfig([monitor()], []).monitors[0], profile: 'zukunft-profil' }] });
    const gelesen = importMonitorConfig(datei);
    expect(gelesen.ok).toBe(true);
    if (!gelesen.ok) { return; }
    expect(gelesen.payload.monitors[0].profile).toBeUndefined();
    expect('profile' in instantiateMonitorConfig(gelesen.payload, optionen).monitors[0]).toBe(false);
  });
});
