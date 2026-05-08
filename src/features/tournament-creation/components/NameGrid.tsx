import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui';
import { cssVars } from '../../../design-tokens'

interface NameGridItem {
  id: string;
  defaultName: string;
  customName?: string;
  shortCode?: string;
}

interface NameGridProps {
  items: NameGridItem[];
  onUpdateItem: (id: string, updates: { customName?: string; shortCode?: string }) => void;
  checkDuplicate: (id: string, customName: string | undefined) => boolean;
  checkOriginal: (id: string, customName: string | undefined) => boolean;
  namePlaceholder: string;
  shortCodePlaceholder: string;
}

/**
 * Reusable grid component for naming items (groups, fields)
 * Extracted from Step_GroupsAndFields for reusability
 */
export const NameGrid: React.FC<NameGridProps> = ({
  items,
  onUpdateItem,
  checkDuplicate,
  checkOriginal,
  namePlaceholder,
  shortCodePlaceholder,
}) => {
  const { t } = useTranslation('wizard');

  return (
    <>
      {/* Column headers */}
      <div
        className="groups-fields-header"
        style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr 80px',
          gap: cssVars.spacing.md,
          marginBottom: cssVars.spacing.sm,
          paddingBottom: cssVars.spacing.sm,
          borderBottom: `1px solid ${cssVars.colors.border}`,
        }}
      >
        <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, fontWeight: 500 }}>
          {t('nameGrid.defaultHeader')}
        </span>
        <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, fontWeight: 500 }}>
          {t('nameGrid.customNameHeader')}
        </span>
        <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, fontWeight: 500, textAlign: 'center' }}>
          {t('nameGrid.shortCodeHeader')}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }}>
        {items.map((item) => {
          const isDuplicate = checkDuplicate(item.id, item.customName);
          const isOriginal = checkOriginal(item.id, item.customName);
          const hasError = isDuplicate || isOriginal;

          return (
            <div key={item.id}>
              <div
                className="groups-fields-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 80px',
                  gap: cssVars.spacing.md,
                  alignItems: 'center',
                }}
              >
                <span style={{
                  color: cssVars.colors.textSecondary,
                  fontSize: cssVars.fontSizes.sm,
                }}>
                  {item.defaultName}
                </span>
                <div style={{ position: 'relative' }}>
                  <Input
                    placeholder={namePlaceholder}
                    value={item.customName ?? ''}
                    onChange={(value) => onUpdateItem(item.id, { customName: value || undefined })}
                    error={hasError}
                  />
                </div>
                <Input
                  placeholder={shortCodePlaceholder}
                  value={item.shortCode ?? ''}
                  onChange={(value) => onUpdateItem(item.id, { shortCode: value.slice(0, 3).toUpperCase() || undefined })}
                  style={{ width: '80px', textAlign: 'center' }}
                />
              </div>
              {hasError && (
                <p style={{
                  margin: `${cssVars.spacing.xs} 0 0 88px`,
                  color: cssVars.colors.error,
                  fontSize: cssVars.fontSizes.xs,
                }}>
                  {t('nameGrid.duplicateName')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
