/**
 * AusgangZeile – die Zeile „Ausgang“ in „Dieses Gerät“ (H4-11; @HT-053, @HT-054, @HT-055). Eingeklappt: Name des gewählten Ausgangs und „Ändern“;
 * offen: die Liste (Standard zuerst, „virtuell“ am Ende, Bluetooth-Hinweis, ein gewählter, aber fehlender Ausgang als „nicht verbunden“).
 * - Die Ausgänge werden erst gelesen, wenn Olli „Ändern“ tippt (`lesen`); ohne gespeicherte Wahl fragt nichts den Browser, nie ein Mikrofon-Dialog.
 * - Ohne Freigabe nur „Standard“ mit dem Text vor der Freigabe (`MikrofonHinweis`); die Freigabe fragt erst der Tipp.
 * - Nach einer Wahl: „Wechsel wirkt sofort“ und die Empfehlung Testton (nicht verpflichtend, nichts blockiert).
 * - „Ausgang bestätigen“ (`AusgangBestaetigen`) steht auch eingeklappt, solange der Ausgang unbestätigt ist.
 * - Browser ohne Ausgangswahl: nur „Standard“ mit dem Hinweis auf die Systemeinstellungen, kein „Ändern“.
 * Zustand und Handlungen kommen aus `useHallAusgang`; Name und Kennung stehen in keinem Attribut und verlassen das Gerät nie.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import type { HallAusgang } from '../useHallAusgang';
import { AusgangBestaetigen } from './AusgangBestaetigen';
import { baueAusgangOptionen, type AusgangOption } from './baueAusgangOptionen';
import { AusgangOptionen } from './AusgangOptionen';
import { MikrofonHinweis } from './MikrofonHinweis';
import { useTesttonHalleKontext } from './TesttonHalleKontext';

export interface AusgangZeileProps {
  ausgang: HallAusgang;
  /** Antippbar nur, wo geändert werden darf (nach dem Turnierende nicht, @HT-046). */
  darfAendern: boolean;
  /** Felder, für die dieses Gerät tönt: der Testton der Empfehlung geht an das erste. */
  felder: readonly number[];
}

const kopfStil: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm, minHeight: cssVars.touchTargets.minimum, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const rahmenStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.sm, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.md, backgroundColor: cssVars.colors.background };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

export function AusgangZeile({ ausgang, darfAendern, felder }: AusgangZeileProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const testton = useTesttonHalleKontext();
  const [offen, setOffen] = useState(ausgang.zustand === 'lost');
  useEffect(() => {
    if (ausgang.zustand === 'lost') {
      setOffen(true); // „verloren“: die Liste steht gleich da (die Wahl liest der Wächter ohnehin, hier wird nichts gelesen)
    }
  }, [ausgang.zustand]);
  const [gewaehltJetzt, setGewaehltJetzt] = useState(false);
  const [mikrofonFrei, setMikrofonFrei] = useState(false);
  const [mikrofonFragt, setMikrofonFragt] = useState(false);
  const optionen = useMemo(() => baueAusgangOptionen(ausgang.liste, ausgang.gewaehlt, ausgang.zustand), [ausgang.liste, ausgang.gewaehlt, ausgang.zustand]);
  const name = ausgang.gewaehlt?.name ?? t('ausgang.standard');
  const lesbar = ausgang.liste.length > 0;

  if (!ausgang.verfuegbar) {
    return (
      <div style={rahmenStil} data-testid="ausgang-zeile" data-offen="false">
        <div style={kopfStil}><Icons.SpeakerLow size={iconSizeValues.sm} /><span>{t('ausgang.label')} <strong>{t('ausgang.standard')}</strong></span></div>
        <InlineNotice tone="neutral" data-testid="ausgang-ohne-wahl">{t('ausgang.ohneWahl')}</InlineNotice>
      </div>
    );
  }

  const aendern = (): void => {
    if (!offen) {
      void ausgang.lesen(); // erst jetzt wird gelesen (kein Mikrofon-Dialog, nur die Liste, die der Browser ohne Freigabe herausgibt)
    }
    setOffen(!offen);
  };
  const waehle = (o: AusgangOption): void => {
    if (ausgang.waehle(o.id)) {
      setGewaehltJetzt(true);
    }
  };
  const erlauben = (): void => {
    setMikrofonFragt(true);
    void ausgang.mikrofonErlauben().then((ok) => { setMikrofonFrei(ok); setMikrofonFragt(false); });
  };
  const testFeld = felder[0];
  const e = testFeld === undefined ? undefined : testton?.ergebnisse[testFeld];
  const ergebnisText = e === undefined ? null : e.art === 'laeuft' ? t('testton.laeuft') : e.art === 'gespielt' ? t('testton.gespielt', { zeit: e.zeit }) : e.text;
  return (
    <div style={rahmenStil} data-testid="ausgang-zeile" data-offen={offen ? 'true' : 'false'}>
      <div style={kopfStil}>
        <span aria-hidden="true" style={{ display: 'flex' }}><Icons.SpeakerLow size={iconSizeValues.sm} /></span>
        <span style={{ flex: '1 1 10rem', minWidth: 0, overflowWrap: 'anywhere' }}>{t('ausgang.label')} <strong data-testid="ausgang-name">{name}</strong></span>
        {darfAendern ? (
          <Button variant="ghost" icon={offen ? <Icons.ChevronUp size={iconSizeValues.sm} /> : <Icons.ChevronDown size={iconSizeValues.sm} />} iconPosition="right" onClick={aendern} data-testid="ausgang-aendern">
            {offen ? t('ausgang.schliessen') : t('ausgang.aendern')}
          </Button>
        ) : null}
      </div>
      {ausgang.zustand === 'unconfirmed' ? (
        <AusgangBestaetigen onBestaetigen={ausgang.bestaetigen} onStandard={() => { ausgang.waehle(null); }} darfAendern={darfAendern} />
      ) : null}
      {offen ? (
        <>
          <AusgangOptionen optionen={optionen} onWaehle={waehle} darfAendern={darfAendern} />
          <p style={textStil} data-testid="ausgang-wirkt-sofort">{t('ausgang.wirktSofort')}</p>
          {!lesbar && darfAendern ? <MikrofonHinweis onErlauben={erlauben} beschaeftigt={mikrofonFragt} /> : null}
          {lesbar && mikrofonFrei ? <p style={textStil} data-testid="ausgang-mikrofon-frei">{t('ausgang.mikrofonFrei')}</p> : null}
          {ausgang.zustand === 'lost' ? <p style={textStil} data-testid="ausgang-verloren-hinweis">{t('ausgang.verlorenHinweis')}</p> : null}
          {gewaehltJetzt && testton !== null && testFeld !== undefined ? (
            <InlineNotice
              tone="info" icon={<Icons.SpeakerLow size={iconSizeValues.sm} />} data-testid="ausgang-testton-empfehlung"
              footer={<div><Button variant="secondary" icon={<Icons.Speaker size={iconSizeValues.sm} />} onClick={() => testton.ausloesen(testFeld)} data-testid="ausgang-testton">{t('ausgang.testton')}</Button></div>}
            >
              <strong>{t('ausgang.testtonTitel')}</strong>
              <span>{ausgang.gewaehlt === null ? t('ausgang.testtonTextStandard') : t('ausgang.testtonText', { name: ausgang.gewaehlt.name })}</span>
              {ergebnisText === null ? null : <span role="status" data-testid="ausgang-testton-ergebnis"><strong>{ergebnisText}</strong></span>}
            </InlineNotice>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
