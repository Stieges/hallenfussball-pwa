/**
 * B-28 C8 – strukturierte Hinweise vor dem Speichern (@DR-012, @DR-027, @DR-024, G45, G80): `buildSchedulePdf` und
 * `buildNoticePdf` liefern neben den Sätzen (`notes`) Original und Gedrucktes (`hints`), damit der Dialog sie nebeneinander
 * zeigt. Rein über `buildHints`, am Spielplan und am Aushang.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDF_FONT, isPdfGlyph } from '../fonts';
import { buildHints, hasHints, hintNotes, NO_HINTS } from '../notes';
import { buildNoticePdf } from '../notice';
import { toPdfInput } from '../pdfInput';
import { buildSchedulePdf } from '../schedulePdf';
import { buildPdfTexts } from '../translations';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { NOTICE_BASE_URL, sharedTournament } from './pdfNoticeSupport';
import { translatorFor } from './pdfText';

const NOW = new Date(2026, 10, 14, 15, 7);
const ARABISCH = 'الأهلي';
const de = buildPdfTexts(translatorFor('de'), 'de');
const mode = { fallback: false, covers: isPdfGlyph };

async function build(names: string[], extra: Partial<Parameters<typeof buildSchedulePdf>[0]['options']> = {}, tournamentOverrides = {}) {
  const teams = HALLENCUP_TEAMS.map((team, i) => (names[i] ? { ...team, name: names[i] } : team));
  const tournament = hallencupTournament({ teams, ...tournamentOverrides });
  return buildSchedulePdf({
    schedule: hallencupSchedule(tournament),
    standings: undefined,
    options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW, ...extra },
  });
}

describe('buildHints (rein)', () => {
  it('ohne Auffälligkeit: keine Hinweise', () => {
    const hints = buildHints({ fields: [['Halle', 'Sporthalle am Park']], teamNames: ['FC Nord', 'Łódź Süd', 'Динамо Север'], mode, logoFailures: [] });

    expect(hints).toEqual(NO_HINTS);
    expect(hasHints(hints)).toBe(false);
  });

  it('Teamname mit arabischen Zeichen: Original und Gedrucktes („??????“), sonst nichts', () => {
    const hints = buildHints({ fields: [], teamNames: ['FC Nord', ARABISCH], mode, logoFailures: [] });

    expect(hints.names).toEqual([{ original: ARABISCH, printed: '??????' }]);
    expect(hasHints(hints)).toBe(true);
  });

  it('Feld mit Emoji: Bezeichnung, Original, Gedrucktes; leere Felder werden übersprungen', () => {
    const hints = buildHints({ fields: [['Regelwerk', 'Hallenregeln ⚽'], ['Halle', '']], teamNames: [], mode, logoFailures: [] });

    expect(hints.fields).toEqual([{ label: 'Regelwerk', original: 'Hallenregeln ⚽', printed: 'Hallenregeln ?' }]);
  });

  it('Ersatzschrift: der Rückfall zählt nur die Zeichen der Standardschrift (ł wird „?“)', () => {
    const standard = (char: string): boolean => (char.codePointAt(0) ?? 0) < 0x100;
    const hints = buildHints({ fields: [], teamNames: ['Łódź'], mode: { fallback: true, covers: standard }, logoFailures: [] });

    expect(hints.fontFallback).toBe(true);
    expect(hints.names).toEqual([{ original: 'Łódź', printed: '?ód?' }]);
  });

  it('hintNotes: Sätze in der Reihenfolge Schrift, Felder, Teamnamen, Grafiken (G80, „als „?“ gedruckt“)', () => {
    const hints = buildHints({
      fields: [['Regelwerk', 'Regeln ⚽']],
      teamNames: [ARABISCH],
      mode: { fallback: true, covers: isPdfGlyph },
      logoFailures: ['left'],
    });

    expect(hintNotes(hints, de)).toEqual([
      de.fontFallbackNote,
      'Regelwerk „Regeln ⚽“ enthält Zeichen, die im PDF als „?“ gedruckt werden',
      `Teamname „${ARABISCH}“ enthält Zeichen, die im PDF als „?“ gedruckt werden`,
      de.logoUnusable('left'),
    ]);
  });
});

describe('@DR-012 am Spielplan: hints und notes beschreiben dasselbe', () => {
  it('arabischer Teamname: ein Eintrag in hints.names, ein Satz in notes', async () => {
    const result = await build([ARABISCH]);

    expect(result.hints.names).toEqual([{ original: ARABISCH, printed: '??????' }]);
    expect(result.notes).toEqual(hintNotes(result.hints, de));
    expect(result.notes).toHaveLength(1);
  });

  it('Regelwerk mit Emoji und Ansprechpartner: je ein Eintrag in hints.fields', async () => {
    const tournament = Object.assign(hallencupTournament(), { rulebook: 'Hallenregeln ⚽' });
    const result = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, now: NOW, contact: 'Anna ⚽' },
    });

    expect(result.hints.fields.map(f => [f.label, f.original, f.printed])).toEqual([
      ['Regelwerk', 'Hallenregeln ⚽', 'Hallenregeln ?'],
      ['Ansprechpartner', 'Anna ⚽', 'Anna ?'],
    ]);
  });

  it('Gegenbeispiel: Kyrillisch und Griechisch (@DR-014) und ein ł lösen keinen Hinweis aus', async () => {
    const result = await build(['Динамо Север', 'Ολυμπιακός', 'Łódź Süd']);

    expect(result.hints).toEqual(NO_HINTS);
    expect(result.notes).toEqual([]);
  });

  it('@DR-027 Schrift lädt nicht: hints.fontFallback ist gesetzt, die Namen werden an der Standardschrift gemessen', async () => {
    vi.spyOn(PDF_FONT.load, 'normal').mockRejectedValue(new Error('offline'));
    const result = await build(['Łódź Süd']);

    expect(result.hints.fontFallback).toBe(true);
    expect(result.hints.names).toEqual([{ original: 'Łódź Süd', printed: '?ód? Süd' }]);
  });
});

describe('@DR-012 @DR-024 am Aushang: der Turniername wird gemeldet', () => {
  it('Titel mit arabischen Zeichen: Feld „Turniername“ in den hints, keine Teamnamen', async () => {
    const tournament = sharedTournament({ title: `Cup ${ARABISCH}` });
    const input = toPdfInput({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, viewerBaseUrl: NOTICE_BASE_URL },
    });
    const result = await buildNoticePdf(input);

    expect(result.ok && result.hints.fields).toEqual([{ label: 'Turniername', original: `Cup ${ARABISCH}`, printed: 'Cup ??????' }]);
    expect(result.ok && result.hints.names).toEqual([]);
    expect(result.ok && result.notes).toEqual([`Turniername „Cup ${ARABISCH}“ enthält Zeichen, die im PDF als „?“ gedruckt werden`]);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
