/**
 * @OB-075 Rückennummer immer „#12“ (nie „Nr. 12“, nie „No. 12“) · Stellen laut Lern-Spur 2026-11-02:
 * @SL-022 / @SL-019 (Eintragsliste im Cockpit), @SL-089 (Sperr-Hinweis), @ZM-002 / @ZM-186 (Ereignisse der Zuschauer-Seite und der
 * Verwaltung), @ZM-021 (Karten), Strafen-Leiste und Klärungsliste. Geprüft an den echten Texten und Komponenten, Deutsch und Englisch.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactElement } from 'react';
import { describeGoal } from '../../components/live-cockpit/components/goalDescription';
import { getEventLabel } from '../../components/schedule/MatchExpand/liveInfoEventLine';
import { EventList } from '../../components/schedule/MatchSummary/EventList';
import type { RuntimeMatchEvent } from '../../types/tournament';
import { createRealI18n, type RealLanguage } from '../../test/realI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');

const SPRACHEN: RealLanguage[] = ['de', 'en'];
const nord = { id: 'nord', name: 'FC Nord' };
const sued = { id: 'sued', name: 'SV Süd' };
/** Verboten in jeder Form, die eine Rückennummer zeigt. */
const KEIN_NR = /\bNr\.? ?\d|\bNo\.? ?\d|\bNummer \d|\bnumber \d|\bNumber \d/;

const tor = (extra: Partial<RuntimeMatchEvent['payload']> = {}): RuntimeMatchEvent => ({
  id: 'e1', matchId: 'm1', type: 'GOAL', timestampSeconds: 125,
  payload: { teamId: 'nord', teamName: 'FC Nord', direction: 'INC', playerNumber: 7, ...extra },
} as RuntimeMatchEvent);

describe('@OB-075 Rückennummer „#7“ in der Eintragsliste des Cockpits (@SL-019, @SL-022)', () => {
  it.each(SPRACHEN)('%s: Tor „…, #7“, Eigentor „…, #4“ (schießendes Team), ohne Nummer ohne „#“', async (lng) => {
    const i18n = await createRealI18n(lng);
    const t = i18n.getFixedT(lng, 'cockpit');
    const teams = { homeTeamId: 'nord', homeTeamName: 'FC Nord', awayTeamName: 'SV Süd' };
    const wort = lng === 'de' ? { tor: 'Tor', eigen: 'Eigentor', ohne: 'ohne Nummer' } : { tor: 'Goal', eigen: 'Own goal', ohne: 'no number' };

    expect(describeGoal(tor(), teams, t)).toBe(`${wort.tor} FC Nord, #7`);
    expect(describeGoal(tor({ ownGoal: true, ownGoalTeamId: 'sued', playerNumber: 4 }), teams, t)).toBe(`${wort.eigen} SV Süd, #4`);
    expect(describeGoal(tor({ playerNumber: undefined }), teams, t)).not.toContain('#');
    expect(describeGoal(tor(), teams, t)).not.toMatch(KEIN_NR);
    expect(wort.ohne.length).toBeGreaterThan(0);
  });
});

describe('@OB-075 Rückennummer „#9“ in den Ereignissen der Zuschauer-Seite (@ZM-002, @ZM-021, @ZM-186)', () => {
  it.each(SPRACHEN)('%s: Tor, Zeitstrafe, Gelbe Karte und Eigentor tragen „#<Nummer>“, nie „Nr.“ oder „No.“', async (lng) => {
    const i18n = await createRealI18n(lng);
    const t: Parameters<typeof getEventLabel>[3] = (key, opts) => (i18n.t as (k: string, o: Record<string, unknown>) => string)(key as string, { ns: 'tournament', ...opts });
    const e = (type: 'GOAL' | 'TIME_PENALTY' | 'YELLOW_CARD', extra = {}) => ({ id: 'x', type, teamId: 'nord', teamName: 'FC Nord', timestampSeconds: 125, playerNumber: 9, ...extra });

    const zeilen = [
      getEventLabel(e('GOAL'), nord, sued, t),
      getEventLabel(e('TIME_PENALTY'), nord, sued, t),
      getEventLabel(e('YELLOW_CARD'), nord, sued, t),
      getEventLabel(e('GOAL', { ownGoal: true, ownGoalTeamId: 'sued', playerNumber: 4 }), nord, sued, t),
    ];
    expect(zeilen[0]).toContain('FC Nord, #9, 3.');
    expect(zeilen[1]).toContain('FC Nord, #9, 3.');
    expect(zeilen[2]).toContain('FC Nord, #9');
    expect(zeilen[3]).toContain('SV Süd, #4, 3.');
    for (const z of zeilen) { expect(z).not.toMatch(KEIN_NR); }
  });

  it.each(SPRACHEN)('%s: die Ereignisliste der Verwaltung (EventList) zeigt „#9“', async (lng) => {
    const i18n = await createRealI18n(lng);
    const ui: ReactElement = (
      <I18nextProvider i18n={i18n}>
        <EventList events={[tor({ playerNumber: 9 })]} homeTeamId="nord" awayTeamId="sued" homeTeamName="FC Nord" awayTeamName="SV Süd" />
      </I18nextProvider>
    );
    const { container } = render(ui);
    expect(container.textContent).toContain('FC Nord, #9, 3.');
    expect(container.textContent).not.toMatch(KEIN_NR);
  });
});

describe('@OB-075 Rückennummer in Sperr-Hinweis, Strafen-Leiste und Klärungsliste (@SL-089, @SL-088)', () => {
  it('Deutsch: Sperr-Hinweis „#7 ist für dieses Turnier gesperrt“, Zeitstrafe „#7 · 1:30“, Rückfrage „#7 hat schon Gelb“', async () => {
    const i18n = await createRealI18n('de');
    expect(i18n.t('cockpit:tafel.vor.gesperrt', { team: 'FC Nord', nummer: 7 })).toBe('FC Nord: #7 ist für dieses Turnier gesperrt');
    expect(i18n.t('cockpit:spalte.gesperrt', { nummer: 7 })).toBe('#7 gesperrt');
    expect(i18n.t('cockpit:spalte.strafe', { nummer: 7, rest: '1:30' })).toBe('#7 · 1:30');
    expect(i18n.t('cockpit:strafen.mitNr', { team: 'FC Nord', nummer: 7 })).toBe('FC Nord, #7');
    expect(i18n.t('cockpit:karte.schonGelb', { nummer: 7 })).toBe('#7 hat schon Gelb');
    expect(i18n.t('tournament:klaerung.zeile.mitNummer', { what: 'Gelbe Karte', team: 'SV Süd', nr: 5 })).toBe('Gelbe Karte SV Süd, #5');
  });

  it('Englisch: dieselben Stellen mit „#7“, nie „No. 7“ oder „number 7“', async () => {
    const i18n = await createRealI18n('en');
    const texte = [
      i18n.t('cockpit:tafel.vor.gesperrt', { team: 'FC Nord', nummer: 7 }),
      i18n.t('cockpit:spalte.gesperrt', { nummer: 7 }),
      i18n.t('cockpit:spalte.strafe', { nummer: 7, rest: '1:30' }),
      i18n.t('cockpit:strafen.mitNr', { team: 'FC Nord', nummer: 7 }),
      i18n.t('cockpit:karte.schonGelb', { nummer: 7 }),
      i18n.t('tournament:klaerung.zeile.mitNummer', { what: 'Yellow card', team: 'SV Süd', nr: 5 }),
    ];
    texte.forEach((text) => { expect(text).toContain('#'); expect(text).not.toMatch(KEIN_NR); });
    expect(texte[0]).toBe('FC Nord: #7 is suspended for this tournament');
  });
});

describe('@OB-075 Gegenbeispiel: in keiner Sprachdatei steht ein Satz mit „Nr. <Zahl>“, „No. <Zahl>“ oder „Nummer {{…}}“ für eine Rückennummer', () => {
  it.each(SPRACHEN)('%s: kein Wert mit Nummern-Wort vor einem Platzhalter der Rückennummer', async (lng) => {
    const namen = ['cockpit', 'tournament', 'publicView', 'monitor', 'helpers', 'wizard'];
    const treffer: string[] = [];
    const gehe = (knoten: unknown, pfad: string) => {
      if (typeof knoten === 'string') {
        if (/\b(Nr\.?|No\.?|Nummer|[Nn]umber) ?(\d|\{\{(nummer|number|nr|playerNumber)\}\})/.test(knoten) && !/Spiel \{\{|Match \{\{|Game \{\{|Zahl|Number \{\{number\}\}$/.test(knoten)) { treffer.push(`${pfad}: ${knoten}`); }
      } else if (knoten !== null && typeof knoten === 'object') {
        Object.entries(knoten).forEach(([k, v]) => gehe(v, `${pfad}.${k}`));
      }
    };
    for (const ns of namen) { gehe((await import(`../locales/${lng}/${ns}.json`)).default, `${lng}:${ns}`); }
    expect(treffer).toEqual([]);
  });
});
