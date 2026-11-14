/**
 * Keine Rohschlüssel und Rohwerte im Monitor-Editor und auf der Monitor-Karte, in Deutsch und Englisch.
 * Echte Sprachdateien (nicht der Schlüssel-Mock): rendert jede Folienart in Konfiguration und Vorschau.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import i18n from 'i18next';
import '../../../i18n';
import type { MonitorSlide, SlideType, TournamentMonitor } from '../../../types/monitor';
import { SlideConfigEditor } from '../components/SlideConfigEditor';
import { SlidePreview } from '../components/SlidePreview';
import { MonitorCard } from '../components/MonitorCard';
import { createMockTournament } from '../../../test/factories';

const ARTEN: SlideType[] = ['live', 'standings', 'schedule-field', 'sponsor', 'custom-text', 'qr-code', 'all-standings', 'schedule-group', 'next-matches', 'top-scorers'];
const STILE = { slideConfigStyle: {}, inputGroupStyle: {}, labelStyle: {}, selectStyle: {}, inputStyle: {} };
const turnier = createMockTournament({ id: 't', teams: [{ id: 'a', name: 'Waging' }], numberOfFields: 1 });

const folie = (type: SlideType, config: MonitorSlide['config'] = {}): MonitorSlide => ({ id: `s-${type}`, type, config, duration: null, order: 0 });

/** Sichtbarer Text samt Namen für Hilfstechnik, Platzhaltern und Tooltips */
function alleTexte(): string {
  const teile = [document.body.textContent ?? ''];
  document.body.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el => {
    for (const a of ['aria-label', 'title', 'placeholder']) {teile.push(el.getAttribute(a) ?? '');}
  });
  return teile.join('\n');
}

const ROHSCHLUESSEL = /\b(slideEditor|slidePreview|monitorEditor|monitors)\.[A-Za-z]/;

describe.each(['de', 'en'] as const)('keine Rohschlüssel (%s)', (sprache) => {
  const monitor = (transition: TournamentMonitor['transition']): TournamentMonitor => ({
    id: 'm', name: 'Haupthalle', defaultSlideDuration: 15, transition, transitionDuration: 500, theme: 'dark',
    performanceMode: 'auto', slides: ARTEN.map(a => folie(a)), createdAt: '', updatedAt: '',
  });

  it.each(ARTEN)('Konfiguration und Vorschau der Folie „%s“', async (art) => {
    await i18n.changeLanguage(sprache);
    const optionen = art === 'sponsor' ? { showQrCode: true, qrTarget: 'custom' as const } : {};
    render(<>
      <SlideConfigEditor slide={folie(art, optionen)} fields={[]} groups={[{ id: 'A' }, { id: 'B' }]} sponsors={[{ id: 'sp', name: 'Krume' }]}
        onUpdate={vi.fn()} getFieldDisplayName={(id) => id} styles={STILE} showErrors />
      <SlidePreview slide={folie(art)} tournament={turnier} />
    </>);
    const text = alleTexte();
    expect(text).not.toMatch(ROHSCHLUESSEL);
    expect(text).not.toMatch(/Phase 2/);
    expect(text).not.toContain(`-Slide`);
    // Rohwert der Folienart (z. B. „qr-code“) darf nirgends als Beschriftung stehen
    expect(text).not.toMatch(new RegExp(`(^|[^A-Za-z-])${art}([^A-Za-z-]|$)`));
    cleanup();
  });

  it('alle Auswahlen der Eigener-Text- und Sponsor-Folie zeigen übersetzte Einträge (QR-Ziel, Ausrichtung, Farbschema)', async () => {
    await i18n.changeLanguage(sprache);
    render(<>
      <SlideConfigEditor slide={folie('custom-text', { headline: 'x', colorScheme: 'celebration' })} fields={[]} groups={[]} sponsors={[]}
        onUpdate={vi.fn()} getFieldDisplayName={(id) => id} styles={STILE} />
      <SlideConfigEditor slide={folie('sponsor', { sponsorId: 'sp', showQrCode: true })} fields={[]} groups={[]} sponsors={[{ id: 'sp', name: 'K' }]}
        onUpdate={vi.fn()} getFieldDisplayName={(id) => id} styles={STILE} />
    </>);
    const optionen = [...document.querySelectorAll('option')].map(o => o.textContent);
    for (const o of optionen) {expect(o).not.toMatch(/^[a-z]+\.[A-Za-z.]+$/);}
    expect(alleTexte()).not.toMatch(ROHSCHLUESSEL);
    cleanup();
  });

  it.each(['fade', 'slide', 'none'] as const)('Monitor-Karte zeigt den Übergang „%s“ als Wort, nicht als Rohwert', async (uebergang) => {
    await i18n.changeLanguage(sprache);
    const noop = vi.fn();
    render(<MonitorCard monitor={monitor(uebergang)} heartbeatStatus={null} isDeleting={false} isCopied={false}
      onCancelDelete={noop} onCopyUrl={noop} onOpenDisplay={noop} getSlideTypeIcon={() => 'x'} getSlideTypeLabel={(t) => t}
      formatDuration={(s) => `${s} s`} styles={{ actionButtonStyle: () => ({}) }} />);
    const meta = document.body.textContent ?? '';
    const erwartet = i18n.t(`tournament:monitorEditor.settings.transitions.${uebergang}`);
    expect(meta).toContain(erwartet);
    expect(erwartet).not.toMatch(ROHSCHLUESSEL);
    if (sprache === 'de') {expect(meta).not.toContain(uebergang);}
    expect(meta).not.toMatch(ROHSCHLUESSEL);
    cleanup();
  });
});

afterAll(async () => { await i18n.changeLanguage('de'); });
