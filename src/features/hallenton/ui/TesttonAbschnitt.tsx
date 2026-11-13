/**
 * TesttonAbschnitt – „Testton“ im Unterpunkt „Hallenton“ (H4-8; @HT-017, @HT-041, @HT-046): „Hier anhören“ spielt auf diesem Gerät,
 * „Testton in der Halle“ am Hallen-Lautsprecher des Felds, danach die Quittung „gespielt 14:02“ (vom Server) oder der Grund. Ohne
 * aktuellen Stand kein Aufruf: „Kein Testton: kein Netz“. Ist der Lautsprecher nicht bereit oder meldet er sich nicht, geht gar kein
 * Auftrag raus (ein spätes Nachholen in der Halle wäre schlimmer als die Auskunft). Die Rückfrage „Auf Feld 1 läuft Spiel 11 …“ kommt
 * mit H4-10. Der ganze Abschnitt steht nur, wo geändert werden darf (nach dem Turnierende nicht, @HT-046).
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import type { HallStatus } from '../useHallStatus';
import type { HallFehlerGrund, HallStatusAntwort } from '../../../core/repositories/hallentonRpc';
import type { FeldKarte } from './feldKarten';
import { echterZeitgeber } from '../runtime/zeitgeber';
import { formatUhrzeit } from './uhrzeit';

/** So lange wartet die Anzeige auf die Quittung, bevor sie „keine Antwort“ sagt (der Lautsprecher meldet alle 5 s). */
export const QUITTUNG_WARTEN_MS = 15_000;

/** `laeuft`: der in DIESER Sitzung ausgelöste Auftrag (Kennung + Start, lokal gemessen); nur seine Quittung zählt (@HT-017). */
type Ergebnis = { art: 'laeuft'; testId: string; seit: number } | { art: 'text'; text: string; warn: boolean };

export interface TesttonAbschnittProps {
  karten: readonly FeldKarte[];
  status: Pick<HallStatus, 'stand' | 'antwort' | 'testtonAnfordern'>;
  /** „Hier anhören“: spielt den Abpfiff-Ton auf diesem Gerät. */
  hierAnhoeren: () => void;
  geraetName: string | null;
}

const abschnittStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const kastenStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.md, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: cssVars.colors.surface, color: cssVars.colors.textPrimary };
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
const zeileStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, paddingTop: cssVars.spacing.md, borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` };
const quittungStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, margin: 0, fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold };

const FEHLER_TEXT = {
  netz: 'testton.keinNetz', kein_recht: 'testton.keinRecht', turnier_beendet: 'testton.beendet', ungueltig: 'testton.fehler', antwort_unbekannt: 'testton.fehler',
} as const satisfies Record<HallFehlerGrund, string>;

function nichtGespielt(karte: FeldKarte, t: TFunction<'hallenton'>): string | null {
  const z = karte.zustand;
  switch (z.art) {
    case 'nichtBereit': return t('feld.zustand.nichtBereit', { grund: t(`feld.grund.${z.grund}`) });
    case 'zustandUnbekannt': return t('feld.zustand.zustandUnbekannt');
    case 'meldetSichNicht': return t('testton.nichtGespieltMeldetSich', { zeit: z.zuletzt });
    default: return null;
  }
}

/** Uhrzeit der Quittung (Serverzeit) – nur für genau diesen Test; ein älterer Test des Lautsprechers am Server zählt nie. */
function gespielteZeit(antwort: HallStatusAntwort | null, feld: number, sprache: string, testId: string): string | null {
  if (antwort?.sicht !== 'voll') {
    return null;
  }
  const test = antwort.speakers.find((s) => s.field === feld)?.test;
  const gespielt = test?.playedAt ?? null;
  if (!test || gespielt === null) {
    return null;
  }
  return test.testId === testId ? formatUhrzeit(gespielt, sprache) : null;
}

export function TesttonAbschnitt({ karten, status, hierAnhoeren, geraetName }: TesttonAbschnittProps): ReactElement {
  const { t, i18n } = useTranslation('hallenton');
  const [ergebnisse, setErgebnisse] = useState<Readonly<Record<number, Ergebnis>>>({});
  const setze = useCallback((feld: number, e: Ergebnis) => setErgebnisse((alt) => ({ ...alt, [feld]: e })), []);

  // Die Quittung des eigenen Auftrags (gleiche Kennung) ersetzt „läuft“ für immer; ein älterer Test am Server zählt nie (@HT-017)
  useEffect(() => {
    setErgebnisse((alt) => {
      let geaendert = false;
      const neu: Record<number, Ergebnis> = { ...alt };
      for (const [feld, e] of Object.entries(alt)) {
        const zeit = e.art === 'laeuft' ? gespielteZeit(status.antwort, Number(feld), i18n.language, e.testId) : null;
        if (zeit !== null) {
          neu[Number(feld)] = { art: 'text', text: t('testton.gespielt', { zeit }), warn: false };
          geaendert = true;
        }
      }
      return geaendert ? neu : alt;
    });
  }, [status.antwort, i18n.language, t]);

  // Je Feld eine eigene Frist ab seinem Start: ein zweiter Auftrag verlängert die des ersten nicht
  const fristen = Object.entries(ergebnisse).flatMap(([feld, e]) => (e.art === 'laeuft' ? [`${feld}:${e.testId}:${e.seit}`] : [])).join('|');
  useEffect(() => {
    const timers = fristen === '' ? [] : fristen.split('|').map((eintrag) => {
      const [feld, testId, seit] = eintrag.split(':');
      return window.setTimeout(() => {
        setErgebnisse((alt) => {
          const e = alt[Number(feld)];
          return e?.art === 'laeuft' && e.testId === testId ? { ...alt, [Number(feld)]: { art: 'text', text: t('testton.keineAntwort'), warn: true } } : alt;
        });
      }, Math.max(0, Number(seit) + QUITTUNG_WARTEN_MS - echterZeitgeber.jetzt()));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [fristen, t]);

  const ausloesen = async (karte: FeldKarte): Promise<void> => {
    const grund = nichtGespielt(karte, t);
    if (status.stand === 'laedt') {
      return; // die erste Antwort steht noch aus: kein „kein Netz“, die Taste ist bis dahin aus
    }
    if (status.stand !== 'aktuell') {
      setze(karte.feld, { art: 'text', text: t('testton.keinNetz'), warn: true });
    } else if (grund !== null) {
      setze(karte.feld, { art: 'text', text: grund, warn: true });
    } else {
      const antwort = await status.testtonAnfordern(karte.feld);
      if (!antwort.ok) {
        setze(karte.feld, { art: 'text', text: t(FEHLER_TEXT[antwort.grund]), warn: true });
      } else if (antwort.status === 'requested') {
        setze(karte.feld, { art: 'laeuft', testId: antwort.testId, seit: echterZeitgeber.jetzt() });
      } else {
        setze(karte.feld, { art: 'text', text: antwort.status === 'too_soon' ? t('testton.zuFrueh') : t('testton.keinLautsprecher'), warn: true });
      }
    }
  };

  return (
    <section style={abschnittStil} aria-labelledby="hallenton-testton-titel" data-testid="hallenton-testton">
      <h2 id="hallenton-testton-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('testton.titel')}</h2>
      <div style={kastenStil}>
        <h3 style={titelStil}>{t('testton.anhoerenTitel')}</h3>
        <p style={textStil}>{geraetName === null ? t('testton.anhoerenText') : t('testton.anhoerenTextGeraet', { name: geraetName })}</p>
        <div>
          <Button variant="secondary" icon={<Icons.SpeakerLow size={iconSizeValues.sm} />} onClick={hierAnhoeren} data-testid="testton-hier-anhoeren">{t('testton.anhoeren')}</Button>
        </div>
        <h3 style={titelStil}>{t('testton.halleTitel')}</h3>
        <p style={textStil}>{t('testton.halleText')}</p>
        {karten.map((karte) => {
          const e = ergebnisse[karte.feld];
          const kein = karte.zustand.art === 'keinLautsprecher';
          const zeile = kein ? null : status.stand === 'unbekannt' ? { text: t('testton.keinNetz'), warn: true }
            : e?.art === 'laeuft' ? { text: t('testton.laeuft'), warn: false }
            : e?.art === 'text' ? { text: e.text, warn: e.warn } : null;
          return (
            <div key={karte.feld} style={zeileStil} data-testid={`testton-feld-${karte.feld}`}>
              <div style={{ minWidth: 0 }}>
                <h4 style={titelStil}>{t('feld.titel', { feld: karte.feld })}</h4>
                <p style={textStil}>{kein || karte.geraet === undefined ? t('testton.keinLautsprecherKein') : t('testton.lautsprecher', { name: karte.geraet.name })}</p>
              </div>
              {kein ? null : (
                <Button variant="secondary" icon={<Icons.Speaker size={iconSizeValues.sm} />} disabled={status.stand === 'laedt'} onClick={() => { void ausloesen(karte); }} data-testid={`testton-halle-${karte.feld}`}>{t('testton.halle')}</Button>
              )}
              {zeile === null ? null : (
                <p style={{ ...quittungStil, flexBasis: '100%' }} role="status" data-testid={`testton-feld-${karte.feld}-ergebnis`}>
                  <span aria-hidden="true" style={{ display: 'flex', color: zeile.warn ? cssVars.colors.warning : cssVars.colors.primary }}>
                    {zeile.warn ? <Icons.AlertTriangle size={iconSizeValues.sm} /> : <Icons.CheckCircle size={iconSizeValues.sm} />}
                  </span>
                  {zeile.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
