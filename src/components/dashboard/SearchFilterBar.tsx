/**
 * SearchFilterBar Component
 *
 * Provides search and filter functionality for the dashboard:
 * - Search input with icon
 * - Filter chips for tournament categories
 * - Responsive design (stacked on mobile, inline on desktop)
 */

import { CSSProperties } from 'react';
import { Icons } from '../ui/Icons';
import { borderRadius, colors, fontFamilies, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

export type FilterChip = 'running' | 'upcoming' | 'finished' | 'draft';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: FilterChip[];
  onFilterToggle: (filter: FilterChip) => void;
  placeholder?: string;
}

interface ChipConfig {
  id: FilterChip;
  label: string;
  icon: JSX.Element;
  color: string;
}

const FILTER_CHIPS: ChipConfig[] = [
  {
    id: 'running',
    label: 'Läuft',
    icon: <Icons.Play size={14} />,
    color: colors.statusLive,
  },
  {
    id: 'upcoming',
    label: 'Bevorstehend',
    icon: <Icons.Calendar size={14} />,
    color: colors.statusUpcoming,
  },
  {
    id: 'finished',
    label: 'Beendet',
    icon: <Icons.Check size={14} />,
    color: colors.statusFinished,
  },
  {
    id: 'draft',
    label: 'Entwurf',
    icon: <Icons.Save size={14} />,
    color: colors.statusDraft,
  },
];

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterToggle,
  placeholder = 'Turniere suchen...',
}) => {
  const isMobile = useIsMobile();

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: spacing.md,
    alignItems: isMobile ? 'stretch' : 'center',
    marginBottom: spacing.lg,
  };

  const searchContainerStyle: CSSProperties = {
    flex: isMobile ? 'none' : 1,
    position: 'relative',
    maxWidth: isMobile ? 'none' : '400px',
  };

  const searchIconStyle: CSSProperties = {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    transform: 'translateY(-50%)',
    color: colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    paddingLeft: '40px', // Space for icon
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontFamily: fontFamilies.body,
    outline: 'none',
    transition: 'border-color 0.2s ease',
  };

  const clearButtonStyle: CSSProperties = {
    position: 'absolute',
    right: spacing.sm,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    padding: spacing.xs,
    cursor: 'pointer',
    color: colors.textSecondary,
    display: searchQuery ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    transition: 'color 0.2s',
  };

  const chipsContainerStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  const getChipStyle = (chip: ChipConfig, isActive: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.lg,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: `1px solid ${isActive ? chip.color : colors.border}`,
    background: isActive ? `${chip.color}15` : 'transparent',
    color: isActive ? chip.color : colors.textSecondary,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={containerStyle} data-testid="search-filter-bar">
      {/* Search Input */}
      <div style={searchContainerStyle}>
        <span style={searchIconStyle}>
          <Icons.Search size={18} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = colors.border;
          }}
          data-testid="search-input"
        />
        <button
          style={clearButtonStyle}
          onClick={() => onSearchChange('')}
          aria-label="Suche leeren"
          type="button"
          data-testid="search-clear"
        >
          <Icons.X size={16} />
        </button>
      </div>

      {/* Filter Chips */}
      <div style={chipsContainerStyle}>
        <span style={{
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          display: isMobile ? 'none' : 'flex',
          alignItems: 'center',
          gap: spacing.xs,
        }}>
          <Icons.Filter size={14} />
          Filter:
        </span>
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilters.includes(chip.id);
          return (
            <button
              key={chip.id}
              onClick={() => onFilterToggle(chip.id)}
              style={getChipStyle(chip, isActive)}
              type="button"
              aria-pressed={isActive}
              aria-label={`Filter: ${chip.label} ${isActive ? '(aktiv)' : ''}`}
              data-testid={`filter-chip-${chip.id}`}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
