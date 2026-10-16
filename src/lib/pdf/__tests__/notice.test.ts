/**
 * B-28 C7 – Aushang A4 hoch mit Zuschauer-QR, gemessen am fertigen PDF (pdfjs).
 * Szenarien: @BM-001 (A4), @BM-006 (nur Schwarz/Weiß), @BM-007 (Titel vollständig, QR ≥ 120 mm), @BM-008 (kein Stand),
 * @BM-043 (Zuschauer-Adresse), @ZM-060, @DR-010 (Kurzadresse, Aufruf), @DR-022 (zweisprachig), @DR-023/@DR-024 (Grafiken).
 */
import i18next from 'i18next';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { printFont, printLimits, printUnit } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { printNotice } from '../../../design-tokens/print-notice';
import { generateLiveUrl, generateTournamentUrl } from '../../../utils/shareUtils';
import { buildNoticePdf } from '../notice';
import { toPdfInput } from '../pdfInput';
import { shortViewerAddress } from '../../qr/publicQr';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { fixtureLogo } from './pdfLogoFixture';
import { pdfLanguage, squash } from './pdfjsText';
import { translatorFor } from './pdfText';
import { allText, drawnNoticeMatrix, noticePdf, noticeTextBox, NOTICE_BASE_URL, NOTICE_TOL, qrBox, titleLinesOf, BM007_NAME, SIXTY } from './pdfNoticeSupport';

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
    const lines = titleLinesOf(page);

    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(printNotice.titleMaxLines);
    expect(squash(lines.map(l => l.str).join(' '))).toBe(squash(SIXTY));
    expect(allText(page)).not.toContain('…');
    expect(box.w).toBeGreaterThanOrEqual(MIN_EDGE);
  });

  it('F4 @BM-007 der Name aus dem Szenario, wörtlich: vollständig, höchstens zwei Zeilen, QR mindestens 120 mm', async () => {
    const { page } = await noticePdf({ title: BM007_NAME });
    const box = qrBox(page);
    const lines = titleLinesOf(page);

    expect(lines.length).toBeLessThanOrEqual(printNotice.titleMaxLines);
    expect(squash(lines.map(l => l.str).join(' '))).toBe(squash(BM007_NAME));
    expect(box.w).toBeGreaterThanOrEqual(MIN_EDGE);
  });

  it('der 60-Zeichen-Titel hat wirklich 60 Zeichen', () => {
    expect(SIXTY).toHaveLength(60);
  });

  it('F2 Titelzeilen überlappen nicht: Abstand der Grundlinien = Schrift × titleLineEm, mindestens die Zeilenhöhe', async () => {
    const { page } = await noticePdf({ title: SIXTY });
    const [first, second] = titleLinesOf(page);
    const cap = first.size * printFont.ascentEm * printUnit.mmPerPt;

    expect(second).toBeDefined();
    expect(second.y - first.y).toBeCloseTo(first.size * printNotice.titleLineEm * printUnit.mmPerPt, 1);
    expect(second.y - first.y, 'Zeilen überlappen nicht').toBeGreaterThan(cap);
  });

  it('kurzer Titel: volle Schrift 40 pt', async () => {
    const { page } = await noticePdf();
    const title = page.texts.find(t => t.str.includes('Hallencup'));

    expect(title?.size).toBeCloseTo(printNotice.titlePt, 1);
  });
});

describe('G54 @DR-010 Reihenfolge: Titel, Aufruf direkt darunter, QR, Schritte, zuletzt „Oder im Browser eintippen:“ mit Adresse', () => {
  const CALL = 'Spielplan und Ergebnisse aufs Handy';
  const STEPS = ['1. Kamera-App am Handy öffnen', '2. Die Kamera auf den QR-Code richten', '3. Link antippen – ohne Anmeldung, ohne App.'];

  it('von oben nach unten: Titel → Aufruf → QR → Schritt 1, 2, 3 → „Oder im Browser eintippen:“ → Adresse', async () => {
    const { page } = await noticePdf();
    const box = qrBox(page);
    const find = (text: string) => {
      const hit = page.texts.find(t => squash(t.str) === squash(text));
      expect(hit, `„${text}“ steht im Aushang`).toBeDefined();
      return hit!;
    };
    const title = find('Hallencup Nord');
    const call = find(CALL);
    const steps = STEPS.map(find);
    const label = find('Oder im Browser eintippen:');
    const address = find(shortViewerAddress(LIVE));

    expect(title.y).toBeLessThan(call.y);
    expect(call.y, 'Aufruf über dem QR-Code').toBeLessThan(box.y);
    expect(steps[0].y, 'Schritte unter dem QR-Code').toBeGreaterThan(box.y + box.h);
    expect(steps[1].y).toBeGreaterThan(steps[0].y);
    expect(steps[2].y).toBeGreaterThan(steps[1].y);
    expect(label.y, '„Oder im Browser eintippen:“ zuletzt, nach den Schritten').toBeGreaterThan(steps[2].y);
    expect(address.y).toBeGreaterThan(label.y);
  });

  it('der Aufruf steht direkt unter dem Titel: zwischen beiden steht kein anderer Text', async () => {
    const { page } = await noticePdf({ title: SIXTY });
    const call = page.texts.find(t => squash(t.str) === squash(CALL))!;
    const titleLines = page.texts.filter(t => t.y < call.y);

    expect(squash(titleLines.map(t => t.str).join(' '))).toBe(squash(SIXTY));
  });

  it('Gegenbeispiel Kindermodus: derselbe Aufbau mit „Spielplan aufs Handy“ über dem QR', async () => {
    const { page } = await noticePdf({ isKidsTournament: true });
    const call = page.texts.find(t => squash(t.str) === squash('Spielplan aufs Handy'));

    expect(call, 'Aufruf Kindermodus').toBeDefined();
    expect(call!.y).toBeLessThan(qrBox(page).y);
  });
});

describe('G55 @DR-010 Adresse zum Abtippen: ohne „https://“, mit „#“, mindestens 20 pt', () => {
  it('Schrift mindestens 20 pt, kein „https“, Raute vorhanden, Text gleich der Kurzadresse', async () => {
    const { page } = await noticePdf();
    const short = shortViewerAddress(LIVE);
    const address = page.texts.find(t => squash(t.str) === squash(short));

    expect(address, 'Kurzadresse').toBeDefined();
    expect(address!.size).toBeGreaterThanOrEqual(20 - NOTICE_TOL);
    expect(address!.str).toContain('#');
    expect(allText(page)).not.toMatch(/https?:/);
  });

  it('lange Adresse: bricht nach einem „/“ oder „.“ um, jede Zeile bleibt mindestens 20 pt, innerhalb des Rands, zusammen die Kurzadresse', async () => {
    const lang = 'https://hallenfussball-turnierverwaltung-nordheim.example.org';
    const { page, width } = await noticePdf({}, { viewerBaseUrl: lang });
    const short = shortViewerAddress(generateLiveUrl('ABC123', lang));
    const unten = qrBox(page).y + qrBox(page).h;
    const zeilen = page.texts.filter(t => t.y > unten && /[/.#]/.test(t.str) && !t.str.includes(' ') && t.str !== '–');

    expect(zeilen.length, 'mehr als eine Zeile').toBeGreaterThan(1);
    expect(squash(zeilen.map(t => t.str).join(''))).toBe(squash(short));
    zeilen.forEach(t => {
      expect(t.size).toBeGreaterThanOrEqual(20 - NOTICE_TOL);
      const b = noticeTextBox(t);
      expect(b.x).toBeGreaterThanOrEqual(printLimits.margin - NOTICE_TOL);
      expect(b.x + b.w).toBeLessThanOrEqual(width - printLimits.margin + NOTICE_TOL);
    });
  });
});

describe('G75 @ZM-060 Schritt 2: „Die Kamera auf den QR-Code richten“', () => {
  it.each([
    ['de', '2. Die Kamera auf den QR-Code richten'],
    ['en', '2. Point the camera at the QR code'],
  ] as const)('%s', async (locale, text) => {
    const { page } = await noticePdf({}, { locale });

    expect(page.texts.some(t => squash(t.str) === squash(text)), text).toBe(true);
  });
});

describe('G56 @DR-023 C1: Grafiken des Aushangs stehen in einer eigenen Zeile über dem Titel, links Veranstalter, rechts zweite Grafik', () => {
  it('beide Grafiken liegen vollständig über dem Titel und über dem Aufruf, links und rechts am Rand', async () => {
    const { page, width } = await noticePdf({}, { logoLeft: fixtureLogo(2), logoRight: fixtureLogo(1) });
    const [left, right] = [...page.images].sort((a, b) => a.x - b.x);
    const title = page.texts.find(t => t.str.includes('Hallencup'))!;

    expect(page.images).toHaveLength(2);
    expect(left.x).toBeLessThan(width / 2);
    expect(right.x).toBeGreaterThan(width / 2);
    page.images.forEach(image => expect(image.y + image.h, 'Unterkante der Grafik über der Titelzeile').toBeLessThanOrEqual(noticeTextBox(title).y + NOTICE_TOL));
  });
});

describe('@BM-008 kein Stand, keine Uhrzeit', () => {
  it('weder „Stand“ noch eine Uhrzeit hh:mm im Text', async () => {
    const { page } = await noticePdf();

    expect(allText(page)).not.toMatch(/Stand/);
    expect(allText(page)).not.toMatch(/\d\d:\d\d/);
  });
});

describe('@DR-022 Sprache: allein PdfInput.locale, einsprachig', () => {
  it('deutsch: nur Deutsch', async () => {
    const { page } = await noticePdf();

    expect(allText(page)).not.toMatch(/phone|camera|Schedule/);
  });

  it('englisch: nur Englisch, keine zweite Sprache', async () => {
    const { page } = await noticePdf({}, { locale: 'en' });
    const text = allText(page);

    expect(squash(text)).toContain(squash('Schedule and results on your phone'));
    expect(text).not.toMatch(/Spielplan|Handy|Kamera|Ergebnisse|Anmeldung/);
  });

  it('englisch + Kindermodus: „Schedule on your phone“, kein „results“', async () => {
    const { page } = await noticePdf({ isKidsTournament: true }, { locale: 'en' });
    const text = allText(page);

    expect(squash(text)).toContain(squash('Schedule on your phone'));
    expect(text).not.toMatch(/results|Ergebnisse|Spielplan/);
  });

  it('locale „de“ bei englischer App-Sprache ergibt ein deutsches PDF (Sprache nie aus der App)', async () => {
    const app = i18next.language;
    i18next.language = 'en';
    try {
      const { page, build } = await noticePdf({}, { locale: 'de' });

      expect(squash(allText(page))).toContain(squash('Spielplan und Ergebnisse aufs Handy'));
      expect(allText(page)).not.toMatch(/phone/);
      expect(build.ok && pdfLanguage(new Uint8Array(build.doc.output('arraybuffer')))).toBe('de');
    } finally {
      i18next.language = app;
    }
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

describe('@DR-022 Spielplan: die Sprache kommt allein aus dem Eingang', () => {
  it('locale „de“ bei englischer App-Sprache ergibt einen deutschen Spielplan', async () => {
    const { kopfPdf } = await import('./pdfKopfSupport');
    const app = i18next.language;
    i18next.language = 'en';
    try {
      const { pages } = await kopfPdf({ locale: 'de' });
      const text = pages.flatMap(p => p.texts.map(t => t.str)).join(' ');

      expect(text).toContain('Teilnehmer');
      expect(text).not.toContain('Participants');
      expect(text, 'Datum nach deutscher Schreibweise').toMatch(/14\.11\.2026/);
    } finally {
      i18next.language = app;
    }
  });
});
