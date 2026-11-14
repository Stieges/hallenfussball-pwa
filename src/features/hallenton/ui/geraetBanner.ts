/**
 * geraetBanner – was der Abschnitt „Dieses Gerät“ oben sagt (H4-9; @HT-001, @HT-012, @HT-015, @HT-057). Rein, ohne React: aus Rolle, Anzeige der
 * eigenen Felder und der Spur eines Verlusts die Banner. Das erste ist der Stand dieses Geräts; danach, je Art, die Spur eines Verlusts:
 * „Feld 1 von einem anderen Gerät übernommen“ (@HT-015, ohne Knopf zum Zurückholen) und „abgemeldet“ (@HT-057, Gegenstück). Seit H4-10 ist der Stand
 * dieses Geräts groß (`gross`, G7): bereit, Ton nicht aktiviert, keine Verbindung, schlafen gelegt, Lautstärke 0 %, zweites Fenster.
 */
import type { TFunction } from 'i18next';
import type { FeldAnzeige } from '../hallAnzeige';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { FeldKarte } from './feldKarten';

export type GeraetBannerArt =
  | 'bereit' | 'tonNichtAktiv' | 'keineVerbindung' | 'schlafenGelegt' | 'lautstaerkeNull' | 'anderesFenster' | 'nichtBereit'
  | 'keinLautsprecher' | 'angehalten' | 'uebernommen' | 'abgemeldet';

/** `verstanden`: die Spur eines Verlusts (kein Ende ohne Taste); `bestaetigen`: „App war angehalten“ (@HT-014, bis Olli es bestätigt). */
export type GeraetBannerAktion = 'verstanden' | 'bestaetigen';

export interface GeraetBanner {
  art: GeraetBannerArt;
  ton: 'ok' | 'warn' | 'info' | 'neutral';
  titel: string;
  text: string;
  /** Groß (Stand dieses Geräts, `GeraetZustand`) oder kleiner Hinweis (Spuren, „angehalten“). */
  gross: boolean;
  aktion: GeraetBannerAktion | null;
}

export interface GeraetBannerEingabe {
  rolle: HallLautsprecher['rolle'];
  felder: readonly number[];
  name: string | null;
  abgeloest: HallLautsprecher['abgeloest'];
  /** Anzeige der Felder dieses Geräts (`hallAnzeige`, `eigenesGeraet`). */
  eigeneAnzeige: readonly FeldAnzeige[];
  karten: readonly FeldKarte[];
  /** Gerätename eines anderen Lautsprechers je Feld (volle Sicht), für „… gibt jetzt den Ton“. */
  sprecherName: (feld: number) => string | undefined;
  /** Der Takt hatte ausgesetzt, bis bestätigt (`LaufzeitSnapshot.warAngehalten`). */
  angehalten: boolean;
  /** Dieses Gerät ist stumm geschaltet (gleicher Grund wie Lautstärke 0 %, aber anderer Satz). */
  stumm: boolean;
  t: TFunction<'hallenton'>;
}

const feldListe = (felder: readonly number[]): string => felder.join(', ');

function ersterNichtBereit(eigene: readonly FeldAnzeige[]): FeldAnzeige | undefined {
  return eigene.find((f) => f.anzeige.art !== 'bereit');
}

const grosserStand = (art: GeraetBannerArt, ton: GeraetBanner['ton'], titel: string, text: string): GeraetBanner => ({ art, ton, titel, text, gross: true, aktion: null });

/** Der große Stand dieses Geräts (G7): bereit, Ton nicht aktiviert, keine Verbindung, schlafen gelegt, Lautstärke 0 %, anderes Fenster, sonst „nicht bereit“ mit Grund. */
function eigenerStand({ felder, name, eigeneAnzeige, karten, stumm, t }: GeraetBannerEingabe): GeraetBanner {
  const feld = feldListe(felder);
  const wo = t('geraet.bereitText', { feld, name: name ?? '' });
  const offen = ersterNichtBereit(eigeneAnzeige);
  if (offen === undefined) {
    return grosserStand('bereit', 'ok', t('geraet.bereit'), wo);
  }
  const grund = (g: string): string => t('geraet.grundUndWo', { grund: g, wo });
  switch (offen.anzeige.art) {
    case 'tonNichtAktiv': return grosserStand('tonNichtAktiv', 'warn', t('geraet.nichtBereit'), grund(t('feld.grund.tonNichtAktiviert')));
    case 'keineVerbindung': return grosserStand('keineVerbindung', 'warn', t('geraet.keineVerbindung'), wo);
    case 'schlafenGelegt': return grosserStand('schlafenGelegt', 'warn', t('geraet.schlafenGelegt'), t('geraet.schlafenGelegtText'));
    case 'anderesFenster': return grosserStand('anderesFenster', 'info', t('geraet.anderesFenster'), t('geraet.anderesFensterText', { feld }));
    default: break;
  }
  const zustand = karten.find((k) => k.feld === offen.feld)?.zustand;
  if (zustand?.art === 'nichtBereit' && zustand.grund === 'lautstaerkeNull') {
    return grosserStand('lautstaerkeNull', 'warn', stumm ? t('geraet.stumm') : t('geraet.lautstaerkeNull'), t('geraet.lautstaerkeNullText', { feld }));
  }
  return grosserStand('nichtBereit', 'warn', t('geraet.nichtBereit'), zustand?.art === 'nichtBereit' ? grund(t(`feld.grund.${zustand.grund}`)) : wo);
}

function spurBanner(eingabe: GeraetBannerEingabe): GeraetBanner[] {
  const { abgeloest, sprecherName, t } = eingabe;
  if (abgeloest === null) {
    return [];
  }
  const uebernommen = abgeloest.felder.filter((v) => v.art === 'abgeloest').map((v) => v.feld);
  const abgemeldet = abgeloest.felder.filter((v) => v.art === 'abgemeldet').map((v) => v.feld);
  const banner: GeraetBanner[] = [];
  if (uebernommen.length > 0) {
    const namen = [...new Set(uebernommen.map(sprecherName).filter((n): n is string => n !== undefined))];
    const feld = feldListe(uebernommen);
    banner.push({
      art: 'uebernommen', ton: 'info', titel: t('geraet.uebernommen', { feld }), gross: false, aktion: 'verstanden',
      text: namen.length === 1 ? t('geraet.uebernommenText', { name: namen[0], feld }) : t('geraet.uebernommenTextOhneName', { feld }),
    });
  }
  if (abgemeldet.length > 0) {
    banner.push({ art: 'abgemeldet', ton: 'info', titel: t('geraet.abgemeldetTitel'), text: t('geraet.abgemeldet', { feld: feldListe(abgemeldet) }), gross: false, aktion: 'verstanden' });
  }
  return banner;
}

export function baueGeraetBanner(eingabe: GeraetBannerEingabe): GeraetBanner[] {
  const { rolle, felder, angehalten, t } = eingabe;
  const istLautsprecher = rolle === 'diesesTurnier' && felder.length > 0;
  const aktuell: GeraetBanner = istLautsprecher
    ? eigenerStand(eingabe)
    : { art: 'keinLautsprecher', ton: 'neutral', titel: t('geraet.keinLautsprecher'), text: t('geraet.keinLautsprecherText'), gross: false, aktion: null };
  // @HT-014: wieder bereit, und der Rechner sagt „App war angehalten – Töne können gefehlt haben“, bis Olli es bestätigt
  const hinweis: GeraetBanner[] = istLautsprecher && angehalten
    ? [{ art: 'angehalten', ton: 'warn', titel: t('geraet.angehalten'), text: '', gross: false, aktion: 'bestaetigen' }]
    : [];
  const spur = spurBanner(eingabe);
  // Ist dieses Gerät nur abgelöst oder abgemeldet, sagt die Spur es genauer als „kein Hallen-Lautsprecher“
  return rolle !== 'diesesTurnier' && spur.length > 0 ? spur : [aktuell, ...hinweis, ...spur];
}
