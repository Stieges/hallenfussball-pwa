/**
 * T9 (Befund C-PDF-AUSHANG-METADATEN): Der Aushang trägt wie der Spielplan Titel und Sprache als Eigenschaften der Datei, sein QR-Code
 * ist antippbar und führt zur Zuschauer-Seite; die Dateinamen folgen der Sprache des Dokuments (englisch ohne „Spielplan“).
 * Szenarien: @DR-039 (Titel „<Turnier> – <Art>“, Sprache der App), @DR-038 (QR-Code antippbar), @DR-022 (Sprache allein aus dem Eingang),
 * @BM-027 (Dateiname mit Stand).
 */
import { describe, expect, it } from 'vitest';
import { generateLiveUrl } from '../../../utils/shareUtils';
import { buildSchedulePdf } from '../schedulePdf';
import type { PdfLocale } from '../translations';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readMetadata } from './pdfjsLayout';
import { noticePdf, NOTICE_BASE_URL, NOTICE_TOL, qrBox, SHARE_CODE } from './pdfNoticeSupport';
import { translatorFor } from './pdfText';

const LIVE = generateLiveUrl(SHARE_CODE, NOTICE_BASE_URL);
const NOW = new Date(2026, 10, 14, 15, 7);

describe.each([
  ['de', 'Hallencup Nord – Aushang', 'Hallencup_Nord_Aushang_A4.pdf'],
  ['en', 'Hallencup Nord – Poster', 'Hallencup_Nord_Poster_A4.pdf'],
] as const)('Aushang (%s): Eigenschaften der Datei, Link, Dateiname', (locale, title, filename) => {
  it('@DR-039 Titel und Sprache der Datei', async () => {
    const { build } = await noticePdf({}, { locale, translate: translatorFor(locale) });
    const meta = build.ok ? await readMetadata(new Uint8Array(build.doc.output('arraybuffer'))) : undefined;

    expect(meta).toEqual({ title, lang: locale });
  });

  it('@DR-038 der QR-Code ist ein Link auf die Zuschauer-Seite und deckt das ganze Muster ab', async () => {
    const { page } = await noticePdf({}, { locale, translate: translatorFor(locale) });
    const box = qrBox(page);

    expect(page.links.map(l => l.url)).toEqual([LIVE]);
    const [link] = page.links;
    expect(link.x).toBeLessThanOrEqual(box.x + NOTICE_TOL);
    expect(link.y).toBeLessThanOrEqual(box.y + NOTICE_TOL);
    expect(link.x + link.w).toBeGreaterThanOrEqual(box.x + box.w - NOTICE_TOL);
    expect(link.y + link.h).toBeGreaterThanOrEqual(box.y + box.h - NOTICE_TOL);
  });

  it('@BM-027 Dateiname in der Sprache des Dokuments', async () => {
    const { build } = await noticePdf({}, { locale, translate: translatorFor(locale) });

    expect(build.ok && build.filename).toBe(filename);
  });
});

describe('@BM-027 @DR-022 Spielplan: der Dateiname folgt der Sprache des Dokuments', () => {
  const nameFor = async (locale: PdfLocale, edition?: 'plan' | 'blank'): Promise<string> => {
    const tournament = hallencupTournament();
    const { filename } = await buildSchedulePdf({
      schedule: hallencupSchedule(tournament),
      standings: undefined,
      options: { locale, translate: translatorFor(locale), tournament, now: NOW, ...(edition ? { edition } : {}) },
    });
    return filename;
  };

  it('englisch: „Schedule“ statt „Spielplan“, auch in der Fassung ohne Ergebnisse', async () => {
    expect(await nameFor('en')).toBe('Hallencup_Nord_Schedule_2026-11-14_1507.pdf');
    expect(await nameFor('en', 'blank')).toBe('Hallencup_Nord_Schedule_without-results_2026-11-14_1507.pdf');
  });

  it('Gegenbeispiel deutsch: unverändert „Spielplan“ bzw. „Spielplan_ohne-Ergebnisse“', async () => {
    expect(await nameFor('de')).toBe('Hallencup_Nord_Spielplan_2026-11-14_1507.pdf');
    expect(await nameFor('de', 'blank')).toBe('Hallencup_Nord_Spielplan_ohne-Ergebnisse_2026-11-14_1507.pdf');
  });
});
