/**
 * EntrySheets – die Blätter der Eintrags-Abläufe (Aufgabe 3.4: Nummernauswahl des Tors und des Eigentors;
 * Aufgabe 3.5: Kartenart-Schritt, Nummernauswahl für Karte und Zeitstrafe, Rückfrage bei zweiter Gelber).
 *
 * Baut aus dem offenen Eintrag (`useEntryFlows`) den Nummern-Baustein: Titel mit Team, die Zeile „Eigentor (Gegner)“ nur im
 * ersten Schritt des Tors, „ohne Nummer“ gegenüber dem auslösenden Knopf (`ausloeserSeite`, @SL-020). Tastatur-Modus nach „per
 * Taste geöffnet“ oder feinem Zeiger, nie nach der Breite (Auflage 8, @SL-153). Der Kartenart-Schritt bietet nur die
 * eingeschalteten Arten an (@SL-025, @SL-026), jede mit Form und Text, damit sie ohne Farbe unterscheidbar bleiben.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../ui/Button';
import { DialogSurface } from '../../ui/molecules/DialogSurface';
import { NumberPicker } from '../../ui/molecules/NumberPicker';
import { useFeinerZeiger } from '../hooks/useFeinerZeiger';
import type { UseEntryFlowsReturn } from '../hooks/useEntryFlows';
import { EINTRAG_ZEITSTRAFE, type CardKind, type OffenerEintrag, type Side, type Uebersetzer } from '../model/cockpitTypes';

export interface EntrySheetsProps {
  flows: UseEntryFlowsReturn;
  teams: { home: { id: string; name: string }; away: { id: string; name: string } };
  /** Wo steht der Knopf des Teams auf dem Bildschirm (nach „Seiten tauschen“)? */
  ausloeserSeite: (seite: Side) => 'links' | 'rechts';
  /** Eingeschaltete Kartenarten des Turniers (@SL-025, @SL-026). */
  kartenArten: { yellow: boolean; yellowRed: boolean; red: boolean };
  t: Uebersetzer;
}

const ARTEN: { art: CardKind; flag: 'yellow' | 'yellowRed' | 'red'; form: 'rechteck' | 'geteilt' | 'rechteck-voll'; textKey: 'karte.gelb' | 'karte.gelbRot' | 'karte.rot' }[] = [
  { art: 'YELLOW', flag: 'yellow', form: 'rechteck', textKey: 'karte.gelb' },
  { art: 'YELLOW_RED', flag: 'yellowRed', form: 'geteilt', textKey: 'karte.gelbRot' },
  { art: 'RED', flag: 'red', form: 'rechteck-voll', textKey: 'karte.rot' },
];

const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const knopfStil: CSSProperties = { minHeight: cssVars.touchTargets.primary, whiteSpace: 'nowrap', width: '100%' };
const formStil = (form: 'rechteck' | 'geteilt' | 'rechteck-voll'): CSSProperties => ({
  display: 'inline-block', width: cssVars.spacing.md, height: cssVars.spacing.lg, borderRadius: cssVars.borderRadius.sm,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`,
  background: form === 'geteilt'
    ? `linear-gradient(135deg, ${cssVars.colors.accent} 50%, ${cssVars.colors.error} 50%)`
    : form === 'rechteck' ? cssVars.colors.accent : cssVars.colors.error,
});

function KartenartSchritt({ flows, name, kartenArten, t }: { flows: UseEntryFlowsReturn; name: string; kartenArten: EntrySheetsProps['kartenArten']; t: Uebersetzer }): ReactElement | null {
  const arten = ARTEN.filter((a) => kartenArten[a.flag]);
  if (arten.length === 0) { return null; }
  return (
    <DialogSurface isOpen onClose={flows.schliesse} ariaLabel={t('karte.titel', { team: name })} testId="card-kind-step">
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('karte.titel', { team: name })}</h2>
        {arten.map((a) => (
          <Button key={a.art} variant="secondary" style={knopfStil} onClick={() => { flows.waehleKartenArt(a.art); }}>
            <span data-form={a.form} style={formStil(a.form)} aria-hidden="true" />
            {t(a.textKey)}
          </Button>
        ))}
      </div>
    </DialogSurface>
  );
}

function ZweiteGelbeRueckfrage({ flows, nummer, name, t }: { flows: UseEntryFlowsReturn; nummer: number; name: string; t: Uebersetzer }): ReactElement {
  return (
    <DialogSurface isOpen onClose={flows.schliesse} role="alertdialog" ariaLabel={t('karte.schonGelb', { nummer })} testId="second-yellow-question" accent={cssVars.colors.warning}>
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{t('karte.schonGelb', { nummer })}</h2>
        <span>{name}</span>
        <Button variant="primary" style={knopfStil} onClick={() => { void flows.antworteZweiteGelbe('gelbRot'); }}>
          <span data-form="geteilt" style={formStil('geteilt')} aria-hidden="true" />{t('karte.gelbRot')}
        </Button>
        <Button variant="secondary" style={knopfStil} onClick={() => { void flows.antworteZweiteGelbe('trotzdemGelb'); }}>{t('karte.trotzdemGelb')}</Button>
      </div>
    </DialogSurface>
  );
}

export function EntrySheets({ flows, teams, ausloeserSeite, kartenArten, t }: EntrySheetsProps): ReactElement | null {
  const feinerZeiger = useFeinerZeiger();
  const offen: OffenerEintrag | null = flows.offen;
  const seite = offen?.seite ?? null;
  const art = offen?.art;
  if (!offen || seite === null || (art !== 'tor' && art !== 'karte' && art !== EINTRAG_ZEITSTRAFE)) { return null; }

  const team = seite === 'home' ? teams.home : teams.away;
  const gegner = seite === 'home' ? teams.away : teams.home;
  if (art === 'karte' && !offen.kartenArt) {
    return <KartenartSchritt flows={flows} name={team.name} kartenArten={kartenArten} t={t} />;
  }
  const rueckfrage = flows.rueckfrageZweiteGelbe;
  const karte = offen.kartenArt ? ARTEN.find((a) => a.art === offen.kartenArt) : undefined;
  const titel = art === 'tor'
    ? (offen.eigentor ? t('nummer.titelEigentor', { gegner: gegner.name }) : t('nummer.titelTor', { team: team.name }))
    : art === 'karte'
      ? t('nummer.titelKarte', { art: karte ? t(karte.textKey) : '', team: team.name })
      : t('nummer.titelZeitstrafe', { team: team.name });
  return (
    <>
      <NumberPicker
        // Mit offener Rückfrage ruht die Nummernauswahl (ihr Zeitablauf läuft nicht weiter, die Rückfrage hat den Fokus).
        isOpen={!rueckfrage}
        texte={{
          titel,
          ohneNummer: t('nummer.ohneNummer'),
          andereNummer: t('nummer.andere'),
          uebernehmen: t('nummer.uebernehmen'),
          eingabeLabel: t('nummer.eingabe'),
        }}
        ausloeserSeite={ausloeserSeite(seite)}
        onWaehle={(nummer) => { void flows.waehleNummer(nummer); }}
        onSchliesse={(grund) => { void flows.schliesseAuswahl(grund); }}
        eigentor={art === 'tor' && !offen.eigentor ? { label: t('nummer.eigentor', { gegner: gegner.name }), onWaehle: () => { void flows.waehleEigentor(); } } : undefined}
        tastatur={offen.perTaste === true || feinerZeiger}
      />
      {rueckfrage && <ZweiteGelbeRueckfrage flows={flows} nummer={rueckfrage.nummer} name={team.name} t={t} />}
    </>
  );
}
