/**
 * @ZM-208 Die kurze Zuschauer-Adresse `host/live/CODE` führt beim Start auf `/#/live/CODE`; nur diese Route, alles andere bleibt unberührt
 * (Gegenbeispiele: andere Pfade, Adressen mit Hash-Route, Auth-Callback).
 */
import { describe, expect, it } from 'vitest';
import { shortLiveTarget } from '../shortLiveRedirect';

describe('@ZM-208 kurze Zuschauer-Adresse', () => {
  it('/live/CODE ohne Hash wird auf die Hash-Route umgeleitet, die Suche bleibt erhalten', () => {
    expect(shortLiveTarget('/live/ABC123', '', '')).toBe('/#/live/ABC123');
    expect(shortLiveTarget('/live/ABC123/', '?s=finished', '')).toBe('/#/live/ABC123?s=finished');
    expect(shortLiveTarget('/live/mess26', '', '#')).toBe('/#/live/mess26');
  });

  it('Gegenbeispiel: eine Adresse mit Hash-Route (auch der QR-Code) wird nicht angefasst', () => {
    expect(shortLiveTarget('/', '', '#/live/ABC123')).toBeNull();
    expect(shortLiveTarget('/live/ABC123', '', '#/live/ABC123')).toBeNull();
  });

  it('Gegenbeispiel: andere Pfade werden nicht umgeleitet (Verwaltung, Anzeige, Auth-Callback, Unterpfade, Sonderzeichen)', () => {
    for (const pfad of ['/', '/tournament/abc', '/display/t1/m1', '/auth/callback', '/auth/confirm', '/live', '/live/', '/live/ABC123/extra', '/live/AB-C', '/livex/ABC123', '/x/live/ABC123']) {
      expect(shortLiveTarget(pfad, '', ''), pfad).toBeNull();
    }
  });
});

describe('@RZ-029 Der Kanal-Zusatz überlebt die Umleitung', () => {
  it('/live/CODE?k=q wird zu /#/live/CODE?k=q, ebenso k=l und zusammen mit anderen Teilen der Suche', () => {
    expect(shortLiveTarget('/live/NIKO26', '?k=q', '')).toBe('/#/live/NIKO26?k=q');
    expect(shortLiveTarget('/live/NIKO26', '?k=l', '')).toBe('/#/live/NIKO26?k=l');
    expect(shortLiveTarget('/live/NIKO26/', '?k=q&s=finished', '')).toBe('/#/live/NIKO26?k=q&s=finished');
  });

  it('Gegenbeispiel: die Hash-Adresse mit Zusatz (QR-Code der Monitor-Folie und des PDFs) wird nicht noch einmal umgeleitet', () => {
    expect(shortLiveTarget('/', '', '#/live/NIKO26?k=q')).toBeNull();
  });
});


describe('@RE-008 Impressum und Datenschutz auch ohne Raute', () => {
  it('/impressum und /datenschutz, auch mit abschließendem „/“, werden auf die Hash-Adresse umgeleitet', () => {
    expect(shortLiveTarget('/impressum', '', '')).toBe('/#/impressum');
    expect(shortLiveTarget('/datenschutz', '', '')).toBe('/#/datenschutz');
    expect(shortLiveTarget('/impressum/', '', '')).toBe('/#/impressum');
    expect(shortLiveTarget('/datenschutz/', '', '#')).toBe('/#/datenschutz');
  });

  it('die Suche bleibt erhalten', () => {
    expect(shortLiveTarget('/impressum', '?a=1', '')).toBe('/#/impressum?a=1');
  });

  it('Gegenbeispiel: mit Hash-Route (auch /#/impressum) wird nichts angefasst', () => {
    expect(shortLiveTarget('/', '', '#/impressum')).toBeNull();
    expect(shortLiveTarget('/impressum', '', '#/datenschutz')).toBeNull();
  });

  it('Gegenbeispiel: ähnliche und andere Pfade bleiben unberührt', () => {
    for (const pfad of ['/', '/irgendwas', '/impressum-foo', '/impressum//', '/impressum/x', '/datenschutz/x', '/Impressum', '/x/impressum', '/login', '/auth/callback']) {
      expect(shortLiveTarget(pfad, '', ''), pfad).toBeNull();
    }
  });

  it('Gegenbeispiel: /live/CODE verhält sich unverändert', () => {
    expect(shortLiveTarget('/live/ABC123', '', '')).toBe('/#/live/ABC123');
    expect(shortLiveTarget('/live/ABC123/', '?k=q', '')).toBe('/#/live/ABC123?k=q');
  });
});
