/**
 * B-28 C7 – Aushang A4 hoch mit Zuschauer-QR, gemessen am fertigen PDF (pdfjs).
 * Szenarien: @BM-001 (A4), @BM-006 (nur Schwarz/Weiß), @BM-007 (Titel vollständig, QR ≥ 120 mm), @BM-008 (kein Stand),
 * @BM-043 (Zuschauer-Adresse), @ZM-060, @DR-010 (Kurzadresse, Aufruf), @DR-022 (zweisprachig), @DR-023/@DR-024 (Grafiken).
 */
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { printLimits } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { printNotice } from '../../../design-tokens/print-notice';
import { generateLiveUrl, generateTournamentUrl } from '../../../utils/shareUtils';
import { buildNoticePdf } from '../notice';
import { toPdfInput } from '../pdfInput';
import { shortViewerAddress } from '../../qr/publicQr';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { fixtureLogo } from './pdfLogoFixture';
import { squash } from './pdfjsText';
import { translatorFor } from './pdfText';
import { allText, drawnNoticeMatrix, noticePdf, noticeTextBox, NOTICE_BASE_URL, NOTICE_TOL, qrBox, SIXTY } from './pdfNoticeSupport';

const matrixOf = (url: string): boolean[][] => {
  const { modules } = QRCode.create(url);
  return Array.from({ length: modules.size }, (_, r) => Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c))));
};
const LIVE = generateLiveUrl('ABC123', NOTICE_BASE_URL);
const MIN_EDGE = 120;

describe('@BM-001 @BM-007 A4 hoch, eine Seite', () => {
  it('210 × 297 mm, eine Seite', async () => {
    const { pages, width, height } = await noticePdf();

    expect(pages).toHaveLength(1);
    expect(Math.round(width)).toBe(210);
    expect(Math.round(height)).toBe(297);
  });
});

describe('@BM-043 @BM-007 der QR trägt die Zuschauer-Adresse und misst mindestens 120 mm', () => {
  it('die gezeichnete Matrix ist QRCode.create(volle https-Adresse /live/CODE), Zelle für Zelle', async () => {
    const { page } = await noticePdf();

    expect(drawnNoticeMatrix(page, matrixOf(LIVE).length)).toEqual(matrixOf(LIVE));
  });

  it('Gegenbeispiel: nie die Verwaltungs-, Anzeige- oder Beitrittsadresse', async () => {
    const { page } = await noticePdf();
    const drawn = drawnNoticeMatrix(page, matrixOf(LIVE).length);

    expect(LIVE).toMatch(/^https:\/\/.+\/#\/live\/ABC123$/);
    for (const fremd of [generateTournamentUrl('ABC123', NOTICE_BASE_URL), `${NOTICE_BASE_URL}/join/ABC123`, `${NOTICE_BASE_URL}/#/display/ABC123`, `${NOTICE_BASE_URL}/#/tv`]) {
      expect(drawn, fremd).not.toEqual(matrixOf(fremd));
    }
  });

  it('Kante des Symbols mindestens 120 mm, quadratisch', async () => {
    const { page } = await noticePdf();
    const box = qrBox(page);

    expect(box.w).toBeGreaterThanOrEqual(MIN_EDGE);
    expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(NOTICE_TOL);
  });

  it('der QR steht mittig auf dem Blatt', async () => {
    const { page, width } = await noticePdf();
    const box = qrBox(page);

    expect(Math.abs(box.x + box.w / 2 - width / 2)).toBeLessThanOrEqual(NOTICE_TOL);
  });
});

describe('@DR-010 Kurzadresse zum Abtippen', () => {
  it('steht als Text unter dem QR und führt zur selben Adresse wie der QR-Inhalt', async () => {
    const { page } = await noticePdf();
    const short = shortViewerAddress(LIVE);
    const text = page.texts.find(t => squash(t.str) === squash(short));
    const box = qrBox(page);

    expect(text, `Kurzadresse „${short}“`).toBeDefined();
    expect(text!.y).toBeGreaterThan(box.y + box.h);
    expect(`https://${squash(text!.str)}`).toBe(squash(LIVE));
  });

  it('Gegenbeispiel: ohne https:// und ohne Pfad-Verlust (mit # wie der Link, F-N4)', () => {
    expect(shortViewerAddress(LIVE)).toBe('hallenfussball.example/#/live/ABC123');
    expect(shortViewerAddress('http://x.example/#/live/ZZZ999')).toBe('x.example/#/live/ZZZ999');
  });
});

describe('@DR-010 Aufruf je Sichtbarkeit', () => {
  it('normales Turnier: „Spielplan und Ergebnisse aufs Handy“', async () => {
    const { page } = await noticePdf();

    expect(squash(allText(page))).toContain(squash('Spielplan und Ergebnisse aufs Handy'));
  });

  it('Kindermodus: „Spielplan aufs Handy“ und nirgends „Ergebnisse“', async () => {
    const { page } = await noticePdf({ isKidsTournament: true });

    expect(squash(allText(page))).toContain(squash('Spielplan aufs Handy'));
    expect(allText(page)).not.toContain('Ergebnisse');
  });

  it('Ergebnisse für Zuschauer ausgeblendet: ebenfalls „Spielplan aufs Handy“, kein „Ergebnisse“', async () => {
    const { page } = await noticePdf({ hideScoresForPublic: true });

    expect(squash(allText(page))).toContain(squash('Spielplan aufs Handy'));
    expect(allText(page)).not.toContain('Ergebnisse');
  });
});

describe('@BM-007 Turniername vollständig, höchstens zwei Zeilen', () => {
  it('60 Zeichen: nicht gekürzt, höchstens zwei Zeilen, kein „…“, der QR bleibt mindestens 120 mm', async () => {
    const { page } = await noticePdf({ title: SIXTY });
    const box = qrBox(page);
    const lines = page.texts.filter(t => t.size >= printNotice.titleMinPt && t.y < box.y);

    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(printNotice.titleMaxLines);
    expect(squash(lines.map(l => l.str).join(' '))).toBe(squash(SIXTY));
    expect(allText(page)).not.toContain('…');
    expect(box.w).toBeGreaterThanOrEqual(MIN_EDGE);
  });

  it('kurzer Titel: volle Schrift 40 pt', async () => {
    const { page } = await noticePdf();
    const title = page.texts.find(t => t.str.includes('Hallencup'));

    expect(title?.size).toBeCloseTo(printNotice.titlePt, 1);
  });
});

describe('@BM-008 kein Stand, keine Uhrzeit', () => {
  it('weder „Stand“ noch eine Uhrzeit hh:mm im Text', async () => {
    const { page } = await noticePdf();

    expect(allText(page)).not.toMatch(/Stand/);
    expect(allText(page)).not.toMatch(/\d\d:\d\d/);
  });
});

describe('@DR-022 Sprache', () => {
  it('deutsche App: nur Deutsch', async () => {
    const { page } = await noticePdf();

    expect(allText(page)).not.toMatch(/phone|Open the camera/);
  });

  it('englische App: zweisprachig, Englisch und Deutsch', async () => {
    const { page } = await noticePdf({}, { locale: 'en' });
    const text = squash(allText(page));

    expect(text).toContain(squash('Schedule and results on your phone'));
    expect(text).toContain(squash('Spielplan und Ergebnisse aufs Handy'));
  });

  it('englisch + Kindermodus: beide Sprachen ohne „results“ und ohne „Ergebnisse“', async () => {
    const { page } = await noticePdf({ isKidsTournament: true }, { locale: 'en' });
    const text = allText(page);

    expect(squash(text)).toContain(squash('Schedule on your phone'));
    expect(squash(text)).toContain(squash('Spielplan aufs Handy'));
    expect(text).not.toMatch(/results|Ergebnisse/);
  });
});

describe('@DR-023 @DR-024 Grafiken wie im Kopf', () => {
  it('links und rechts, höchstens 20 mm hoch, ohne Überlappung mit Titel, QR und untereinander', async () => {
    const { page } = await noticePdf({}, { logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) });
    const [left, right] = [...page.images].sort((a, b) => a.x - b.x);
    const box = qrBox(page);
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
      a.x < b.x + b.w - NOTICE_TOL && b.x < a.x + a.w - NOTICE_TOL && a.y < b.y + b.h - NOTICE_TOL && b.y < a.y + a.h - NOTICE_TOL;

    expect(page.images).toHaveLength(2);
    expect(left.h).toBeLessThanOrEqual(printHeader.logoMaxHeight + NOTICE_TOL);
    expect(right.h).toBeLessThanOrEqual(printHeader.logoMaxHeight + NOTICE_TOL);
    expect(overlaps(left, right)).toBe(false);
    for (const image of page.images) {
      expect(overlaps(image, box)).toBe(false);
      page.texts.forEach(t => expect(overlaps(image, noticeTextBox(t)), `Grafik ↔ „${t.str}“`).toBe(false));
    }
  });

  it('ohne Grafik: keine Lücke oben, der Titel beginnt am oberen Rand des Satzspiegels', async () => {
    const mit = await noticePdf({}, { logoLeft: fixtureLogo(2) });
    const ohne = await noticePdf();
    const top = (p: typeof ohne): number => Math.min(...p.page.texts.map(t => noticeTextBox(t).y));

    expect(mit.page.images).toHaveLength(1);
    expect(ohne.page.images).toHaveLength(0);
    expect(top(ohne)).toBeLessThan(top(mit));
  });
});

describe('Gegenbeispiel: nicht geteilt', () => {
  it.each([
    ['Schalter aus', { isPublic: false, shareCode: 'ABC123' }],
    ['ohne Code', { isPublic: true, shareCode: undefined }],
  ])('%s: kein Aushang, sondern die Fehlerart notShared', async (_name, overrides) => {
    const tournament = hallencupTournament(overrides);
    const input = toPdfInput({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale: 'de', translate: translatorFor('de'), tournament, viewerBaseUrl: NOTICE_BASE_URL },
    });

    expect(await buildNoticePdf(input)).toEqual({ ok: false, reason: 'notShared' });
  });
});

describe('Dateiname', () => {
  it('<Titel>_Aushang_A4.pdf, Leerzeichen werden Unterstriche', async () => {
    const { build } = await noticePdf();

    expect(build.ok && build.filename).toBe('Hallencup_Nord_Aushang_A4.pdf');
  });
});

describe('@DR-001 Mindestgröße', () => {
  it('keine Schrift unter printLimits.minFontPt', async () => {
    const { page } = await noticePdf({}, { locale: 'en' });

    page.texts.forEach(t => expect(t.size, `„${t.str}“`).toBeGreaterThanOrEqual(printLimits.minFontPt - NOTICE_TOL));
  });
});
