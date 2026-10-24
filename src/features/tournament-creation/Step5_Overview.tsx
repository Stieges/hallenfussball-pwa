import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Icons } from '../../components/ui';
import { Tournament } from '../../types/tournament';
import { getFullLocationAddress } from '../../utils/locationHelpers';
import { getGroupDisplayName } from '../../utils/displayNames';
import { activeTeams } from './utils/replanTeams';
import styles from './Step5_Overview.module.css';
import { ageClassText } from '../../core/view';
import { appTranslator } from '../../lib/pdf/appTranslator';
import { buildPdfTexts, resolvePdfLocale } from '../../lib/pdf/translations';
import { summaryFacts, type SummaryFacts } from './utils/summaryFacts';

interface Step5Props {
  formData: Partial<Tournament>;
  onSave: () => void;
  /**
   * Entwurf, wie ihn die Vorschau bekommt (`createDraftTournament`). Daraus kommen Spielzahl, Zeiten und Regeln der
   * Zusammenfassung (@W1-039); ohne Entwurf zeigt sie nur die Angaben aus dem Formular.
   */
  createDraft?: () => Tournament;
}

interface InfoBoxProps {
  label: string;
  children: ReactNode;
  testId?: string;
  tone?: 'default' | 'primary' | 'warning';
}

const TONE_CLASS = { default: styles.valueDefault, primary: styles.valuePrimary, warning: styles.valueWarning };

const InfoBox: React.FC<InfoBoxProps> = ({ label, children, testId, tone = 'default' }) => (
  <div className={styles.infoBox} data-testid={testId}>
    <div className={styles.label}>{label}</div>
    <div className={TONE_CLASS[tone]}>{children}</div>
  </div>
);

/** Turniername, Sportart („Hallenfußball“), Typ, Altersklasse, Veranstalter. */
const TournamentBoxes: React.FC<{ formData: Partial<Tournament> }> = ({ formData }) => {
  const { t } = useTranslation('wizard');
  const { t: tSport } = useTranslation('sport');
  const sportId = formData.sportId ?? 'football-indoor';
  const sportName = sportId === 'football-indoor' ? tSport('name') : tSport(`name_${sportId}`, { defaultValue: t('step5.otherSport') });
  const ageClass = ageClassText(formData.ageClass);
  return (
    <>
      <InfoBox label={t('step5.tournamentName')}>
        <span className={styles.title}>{formData.title ?? t('step5.notSpecified')}</span>
      </InfoBox>
      {formData.organizer && <InfoBox label={t('step5.organizer')}>{formData.organizer}</InfoBox>}
      <div className={styles.infoGrid}>
        <InfoBox label={t('step5.sport')} tone="primary">{sportName}</InfoBox>
        <InfoBox label={t('step5.tournamentType')} tone={formData.tournamentType === 'bambini' ? 'warning' : 'primary'}>
          {formData.tournamentType === 'bambini' ? t('step5.bambiniType') : t('step5.classicType')}
        </InfoBox>
        {ageClass !== '' && <InfoBox label={t('step5.ageClass')} tone="primary" testId="step5-age-class">{ageClass}</InfoBox>}
      </div>
    </>
  );
};

/** Modus, Spielzahl, Zeiten, Felder und Regeln aus dem Entwurf (@W1-039). */
const PlanBoxes: React.FC<{ facts: SummaryFacts }> = ({ facts }) => {
  const { t } = useTranslation('wizard');
  return (
    <>
      <div className={styles.infoGrid} data-testid="step5-plan">
        <InfoBox label={t('step5.mode')} tone="primary" testId="step5-mode">{facts.mode}</InfoBox>
        {facts.matchCount !== undefined && (
          <InfoBox label={t('step5.matches')} testId="step5-matches">{t('step5.matchesCount', { count: facts.matchCount })}</InfoBox>
        )}
        <InfoBox label={t('step5.duration')} testId="step5-duration">{facts.gameDuration}</InfoBox>
        {facts.breakDuration !== undefined && (
          <InfoBox label={t('step5.breakTime')} testId="step5-break">{facts.breakDuration}</InfoBox>
        )}
        <InfoBox label={t('step5.fields')} testId="step5-fields">{facts.fields}</InfoBox>
      </div>
      {facts.ruleLines.length > 0 && (
        <InfoBox label={t('step5.rules')} testId="step5-rules">
          <ul className={styles.ruleList}>
            {facts.ruleLines.map(line => <li key={line}>{line}</li>)}
          </ul>
        </InfoBox>
      )}
    </>
  );
};

export const Step5_Overview: React.FC<Step5Props> = ({ formData, onSave, createDraft }) => {
  const { t, i18n } = useTranslation('wizard');
  const facts = useMemo(() => {
    if (!createDraft) { return undefined; }
    const locale = resolvePdfLocale(i18n.language);
    const draft = createDraft();
    return { draft, facts: summaryFacts(draft, buildPdfTexts(appTranslator(locale), locale)) };
  }, [createDraft, i18n.language]);

  return (
    <Card>
      <h2 className={styles.heading}>{t('step5.title')}</h2>

      <div className={styles.stack}>
        <TournamentBoxes formData={formData} />
        {facts ? <PlanBoxes facts={facts.facts} /> : null}

        <div className={styles.infoGrid}>
          <InfoBox label={t('step5.date')} testId="step5-date">{facts?.facts.day ?? formData.date ?? '-'}</InfoBox>
          {formData.startTime && (
            <InfoBox label={t('step5.time')} testId="step5-time">{t('step5.timeValue', { time: formData.startTime })}</InfoBox>
          )}
          <InfoBox label={t('step5.locationLabel')}>{formData.location ? getFullLocationAddress(formData) : '-'}</InfoBox>
        </div>

        <InfoBox label={t('step5.teamsLabel')}>
          {t('step5.teamsCount', { count: activeTeams(formData.teams ?? []).length })}
          {formData.teams && formData.teams.length > 0 && (
            <div className={styles.teamsContainer}>
              {formData.teams.map((team) => (
                <div key={team.id} className={styles.teamBadge}>
                  {team.name}
                  {team.group && ` (${getGroupDisplayName(team.group, formData as Tournament)})`}
                </div>
              ))}
            </div>
          )}
        </InfoBox>

        <div className={styles.buttonContainer}>
          <Button onClick={onSave} icon={<Icons.ChevronRight />} size="lg" fullWidth iconPosition="right" data-testid="wizard-show-preview">
            {t('step5.showPreview')}
          </Button>
        </div>
      </div>
    </Card>
  );
};
