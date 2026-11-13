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
import { formatUhrzeit } from './uhrzeit';

/** So lange wartet die Anzeige auf die Quittung, bevor sie „keine Antwort“ sagt (der Lautsprecher meldet alle 5 s). */
export const QUITTUNG_WARTEN_MS = 15_000;

type Ergebnis = { art: 'laeuft'; testId: string } | { art: 'text'; text: string; warn: boolean };

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

function gespielteZeit(antwort: HallStatusAntwort | null, feld: number, sprache: string, testId?: string): string | null {
  if (antwort?.sicht !== 'voll') {
    return null;
  }
  const test = antwort.speakers.find((s) => s.field === feld)?.test;
  const gespielt = test?.playedAt ?? null;
  if (!test || gespielt === null) {
    return null;
  }
  return testId === undefined || test.testId === testId ? formatUhrzeit(gespielt, sprache) : null;
}

export function TesttonAbschnitt({ karten, status, hierAnhoeren, geraetName }: TesttonAbschnittProps): ReactElement {
  const { t, i18n } = useTranslation('hallenton');
  const [ergebnisse, setErgebnisse] = useState<Readonly<Record<number, Ergebnis>>>({});
  const setze = useCallback((feld: number, e: Ergebnis) => setErgebnisse((alt) => ({ ...alt, [feld]: e })), []);

  const laufende = Object.entries(ergebnisse).filter(([, e]) => e.art === 'laeuft').map(([feld]) => Number(feld)).join(',');
  useEffect(() => {
    if (laufende === '') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setErgebnisse((alt) => Object.fromEntries(Object.entries(alt).map(([f, e]) => [f, e.art === 'laeuft' ? { art: 'text', text: t('testton.keineAntwort'), warn: true } : e])));
    }, QUITTUNG_WARTEN_MS);
    return () => window.clearTimeout(timer);
  }, [laufende, t]);

  const ausloesen = async (karte: FeldKarte): Promise<void> => {
    const grund = nichtGespielt(karte, t);
    if (status.stand !== 'aktuell') {
      setze(karte.feld, { art: 'text', text: t('testton.keinNetz'), warn: true });
    } else if (grund !== null) {
      setze(karte.feld, { art: 'text', text: grund, warn: true });
    } else {
      const antwort = await status.testtonAnfordern(karte.feld);
      if (!antwort.ok) {
        setze(karte.feld, { art: 'text', text: t(FEHLER_TEXT[antwort.grund]), warn: true });
      } else if (antwort.status === 'requested') {
        setze(karte.feld, { art: 'laeuft', testId: antwort.testId });
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
          const quittung = gespielteZeit(status.antwort, karte.feld, i18n.language, e?.art === 'laeuft' ? e.testId : undefined);
          const zeile = kein ? null : status.stand === 'unbekannt' ? { text: t('testton.keinNetz'), warn: true }
            : quittung !== null ? { text: t('testton.gespielt', { zeit: quittung }), warn: false }
            : e?.art === 'laeuft' ? { text: t('testton.laeuft'), warn: false }
            : e?.art === 'text' ? { text: e.text, warn: e.warn } : null;
          return (
            <div key={karte.feld} style={zeileStil} data-testid={`testton-feld-${karte.feld}`}>
              <div style={{ minWidth: 0 }}>
                <h4 style={titelStil}>{t('feld.titel', { feld: karte.feld })}</h4>
                <p style={textStil}>{kein || karte.geraet === undefined ? t('testton.keinLautsprecherKein') : t('testton.lautsprecher', { name: karte.geraet.name })}</p>
              </div>
              {kein ? null : (
                <Button variant="secondary" icon={<Icons.Speaker size={iconSizeValues.sm} />} onClick={() => { void ausloesen(karte); }} data-testid={`testton-halle-${karte.feld}`}>{t('testton.halle')}</Button>
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
