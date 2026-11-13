/**
 * hallStatusEintraege – baut aus der `HallAnzeige` die `StatusEintrag`-Liste der Statuszeile (H4-5, G6; @HT-045). Rein, ohne Hooks.
 * - Gleiche Zustände über mehrere Felder ein Eintrag („Lautsprecher Feld 1, 2 nicht bereit“, @HT-045 Zeile 4).
 * - „🔈? Prüfen“ (@HT-047) nur als `daneben` an einem bereit-Eintrag, nie als eigener Eintrag.
 * - „Hupe 1 statt eigener Ton“ (@HT-028) ist kein Eintrag der Kopfzeile (keine Pille „nicht bereit“, keine Störung): `hallAnzeige`
 *   liefert es je Feld, der Unterpunkt „Hallenton“ (H4-8) zeigt es bei dem Gerät.
 * - Platz für die Probe: `probe` wird unverändert angehängt (die Probe-Sitzung liefert `rang: 'probe'`).
 */
import type { TFunction } from 'i18next';
import { iconSizeValues } from '../../../design-tokens';
import { Icons } from '../../../components/ui/Icons';
import type { StatusEintrag } from '../../../components/ui/molecules/statusZeileTypen';
import type { FeldAnzeige, FeldAnzeigeArt, HallAnzeige } from '../hallAnzeige';

const GROESSE = iconSizeValues.xs;

/**
 * Ziel der Pillen: bis H4-8 der Admin-Hub des Turniers (`/tournament/<id>/admin`, eine echte Route). Der Unterpunkt „Hallenton“ gibt es
 * noch nicht; eine unbekannte Kategorie ließe den Klick wirkungslos (das Admin Center ignoriert sie). H4-8 stellt hier auf
 * `/admin/hallenton` um (Pflichtpunkt).
 */
export const hallentonZiel = (turnierId: string): string => `/tournament/${turnierId}/admin`;

export interface EintragWerkzeug {
  t: TFunction<'hallenton'>;
  /** Ziel der Pillen ohne eigene Aktion (der Unterpunkt „Hallenton“). */
  ziel: string;
  tonAktivieren: () => void;
  /** Im Unterpunkt „Hallenton“ entfällt der Lautsprecher-Eintrag (Regel 8). */
  ohneLautsprecher?: boolean;
  probe?: StatusEintrag | null;
}

interface Gruppe { schluessel: string; art: FeldAnzeigeArt; felder: number[] }

function gruppiere(felder: readonly FeldAnzeige[]): Gruppe[] {
  const jeSchluessel = new Map<string, Gruppe>();
  for (const f of felder) {
    const schluessel = f.anzeige.art === 'bereit' ? `bereit:${f.anzeige.pruefen}` : f.anzeige.art;
    const gruppe = jeSchluessel.get(schluessel);
    if (gruppe) {
      gruppe.felder.push(f.feld);
    } else {
      jeSchluessel.set(schluessel, { schluessel, art: f.anzeige, felder: [f.feld] });
    }
  }
  return [...jeSchluessel.values()];
}

function gruppenEintrag(g: Gruppe, w: EintragWerkzeug): StatusEintrag {
  const { t } = w;
  const feld = g.felder.join(', ');
  const reihe = g.felder[0];
  const navigiere = { art: 'navigiere', ziel: w.ziel } as const;
  const aktivieren = { art: 'ausloesen', onClick: w.tonAktivieren } as const;
  const aus = <Icons.SpeakerOff size={GROESSE} />;
  switch (g.art.art) {
    case 'bereit': {
      const text = t('statuszeile.bereit', { feld });
      const pruefen: StatusEintrag | undefined = g.art.pruefen
        ? {
          id: `pruefen-${reihe}`, rang: 'hinweis', ton: 'info', rand: 'gestrichelt', symbol: <Icons.SpeakerQuestion size={GROESSE} />,
          text: t('statuszeile.pruefen'), lesetext: t('statuszeile.pruefenLesetext', { feld }), aktion: navigiere,
        }
        : undefined;
      return {
        id: `bereit-${g.schluessel}`, rang: 'bereit', reihe, ton: 'ok', symbol: <Icons.Speaker size={GROESSE} />,
        text, kurz: t('statuszeile.bereitKurz', { feld }), lesetext: text, aktion: navigiere, daneben: pruefen,
      };
    }
    case 'tonNichtAktiv':
      return { id: 'tonNichtAktiv', rang: 'stoerung', reihe, ton: 'warn', symbol: aus, text: t('statuszeile.tonNichtAktiv'), aktion: aktivieren };
    case 'schlafenGelegt':
      return { id: 'schlafenGelegt', rang: 'stoerung', reihe, ton: 'warn', symbol: <Icons.Moon size={GROESSE} />, text: t('statuszeile.schlafenGelegt'), aktion: aktivieren };
    case 'keineVerbindung': {
      const text = t('statuszeile.nichtBereitKeineVerbindung', { feld });
      return { id: 'keineVerbindung', rang: 'stoerung', reihe, ton: 'warn', symbol: aus, text, kurz: t('statuszeile.nichtBereitKeineVerbindungKurz', { feld }), lesetext: text, aktion: navigiere };
    }
    case 'anderesFenster':
      return { id: 'anderesFenster', rang: 'hinweis', reihe, ton: 'info', symbol: <Icons.Speaker size={GROESSE} />, text: t('statuszeile.anderesFenster'), aktion: navigiere };
    case 'nichtBereit': {
      const text = t('statuszeile.nichtBereit', { feld });
      return { id: 'nichtBereit', rang: 'stoerung', reihe, ton: 'warn', symbol: aus, text, kurz: t('statuszeile.nichtBereitKurz', { feld }), lesetext: text, aktion: navigiere };
    }
  }
}

export function baueStatusEintraege(anzeige: HallAnzeige, w: EintragWerkzeug): StatusEintrag[] {
  const eintraege: StatusEintrag[] = [];
  if (w.ohneLautsprecher !== true) {
    eintraege.push(...gruppiere(anzeige.felder).map((g) => gruppenEintrag(g, w)));
    if (anzeige.handyOhneNetz.length > 0) {
      const feld = anzeige.handyOhneNetz.join(', ');
      eintraege.push({
        id: 'handyOhneNetz', rang: 'stoerung', reihe: anzeige.handyOhneNetz[0], ton: 'warn', symbol: <Icons.Phone size={GROESSE} />,
        text: w.t('statuszeile.handyOhneNetz', { feld }), aktion: { art: 'navigiere', ziel: w.ziel },
      });
    }
    if (anzeige.statusUnbekannt) {
      eintraege.push({
        id: 'statusUnbekannt', rang: 'stoerung', ton: 'neutral', rand: 'gestrichelt', symbol: <Icons.HelpCircle size={GROESSE} />,
        text: w.t('statuszeile.statusUnbekannt'), aktion: { art: 'navigiere', ziel: w.ziel },
      });
    }
  }
  if (w.probe) {
    eintraege.push(w.probe);
  }
  return eintraege;
}

