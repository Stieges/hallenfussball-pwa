/**
 * geraetBanner – was der Abschnitt „Dieses Gerät“ oben sagt (H4-9; @HT-001, @HT-012, @HT-015, @HT-057). Rein, ohne React: aus Rolle, Anzeige der
 * eigenen Felder und der Spur eines Verlusts die Banner. Das erste ist der Stand dieses Geräts; danach, je Art, die Spur eines Verlusts:
 * „Feld 1 von einem anderen Gerät übernommen“ (@HT-015, ohne Knopf zum Zurückholen) und „abgemeldet“ (@HT-057, Gegenstück). Die großen
 * Zustände mit Grund je Fall (H4-10) setzen auf diese Banner auf.
 */
import type { TFunction } from 'i18next';
import type { FeldAnzeige } from '../hallAnzeige';
import type { HallLautsprecher } from '../useHallLautsprecher';
import type { FeldKarte } from './feldKarten';

export type GeraetBannerArt = 'bereit' | 'nichtBereit' | 'keinLautsprecher' | 'uebernommen' | 'abgemeldet';

export interface GeraetBanner {
  art: GeraetBannerArt;
  ton: 'ok' | 'warn' | 'info' | 'neutral';
  titel: string;
  text: string;
  /** Die Spur eines Verlusts hat eine Taste „Verstanden“. */
  verstehen: boolean;
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
  t: TFunction<'hallenton'>;
}

const feldListe = (felder: readonly number[]): string => felder.join(', ');

function ersterNichtBereit(eigene: readonly FeldAnzeige[]): FeldAnzeige | undefined {
  return eigene.find((f) => f.anzeige.art !== 'bereit');
}

function eigenerStand({ felder, name, eigeneAnzeige, karten, t }: GeraetBannerEingabe): GeraetBanner {
  const offen = ersterNichtBereit(eigeneAnzeige);
  if (offen === undefined) {
    return { art: 'bereit', ton: 'ok', titel: t('geraet.bereit'), text: t('geraet.bereitText', { feld: feldListe(felder), name: name ?? '' }), verstehen: false };
  }
  if (offen.anzeige.art === 'tonNichtAktiv') {
    return { art: 'nichtBereit', ton: 'warn', titel: t('geraet.tonNichtAktiv'), text: t('geraet.tonNichtAktivText'), verstehen: false };
  }
  const zustand = karten.find((k) => k.feld === offen.feld)?.zustand;
  const text = zustand?.art === 'nichtBereit'
    ? t('geraet.grund', { grund: t(`feld.grund.${zustand.grund}`) })
    : t('geraet.bereitText', { feld: feldListe(felder), name: name ?? '' });
  return { art: 'nichtBereit', ton: 'warn', titel: t('geraet.nichtBereit'), text, verstehen: false };
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
      art: 'uebernommen', ton: 'info', titel: t('geraet.uebernommen', { feld }), verstehen: true,
      text: namen.length === 1 ? t('geraet.uebernommenText', { name: namen[0], feld }) : t('geraet.uebernommenTextOhneName', { feld }),
    });
  }
  if (abgemeldet.length > 0) {
    banner.push({ art: 'abgemeldet', ton: 'info', titel: t('geraet.abgemeldetTitel'), text: t('geraet.abgemeldet', { feld: feldListe(abgemeldet) }), verstehen: true });
  }
  return banner;
}

export function baueGeraetBanner(eingabe: GeraetBannerEingabe): GeraetBanner[] {
  const { rolle, felder, t } = eingabe;
  const stand: GeraetBanner = rolle === 'diesesTurnier' && felder.length > 0
    ? eigenerStand(eingabe)
    : { art: 'keinLautsprecher', ton: 'neutral', titel: t('geraet.keinLautsprecher'), text: t('geraet.keinLautsprecherText'), verstehen: false };
  const spur = spurBanner(eingabe);
  // Ist dieses Gerät nur abgelöst oder abgemeldet, sagt die Spur es genauer als „kein Hallen-Lautsprecher“
  return rolle !== 'diesesTurnier' && spur.length > 0 ? spur : [stand, ...spur];
}
