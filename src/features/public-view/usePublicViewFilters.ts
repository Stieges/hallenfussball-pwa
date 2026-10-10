/**
 * usePublicViewFilters – URL-Zustand und „Mein Team“ der Zuschauer-Seite (B-13c).
 * Schlüssel unverändert: URL-Parameter g/p/s/tab/my, localStorage `live:<shareCode>:myTeam`.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PublicNavTab } from '../../components/ui/PublicBottomNav';
import { useHaptic } from '../../hooks/useHaptic';
import type { PhaseFilter, StatusFilter, ViewFilters } from './publicScheduleFilters';

// localStorage key for "Mein Team" selection
export const getMyTeamStorageKey = (shareCode: string) => `live:${shareCode}:myTeam`;

export interface PublicViewFilterState {
  filters: ViewFilters;
  activeTab: PublicNavTab;
  showTeamSelector: boolean;
  setShowTeamSelector: (show: boolean) => void;
  handleGroupChange: (group: string | null) => void;
  handlePhaseChange: (phase: PhaseFilter) => void;
  handleStatusChange: (status: StatusFilter) => void;
  handleTabChange: (tab: PublicNavTab) => void;
  handleShowOnlyMyTeamChange: (value: boolean) => void;
  selectMyTeam: (teamId: string | null) => void;
}

export function usePublicViewFilters(shareCode: string): PublicViewFilterState {
  const { triggerHaptic } = useHaptic();

  // URL search params for deep-linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial filter values from URL
  const urlGroup = searchParams.get('g');
  const urlPhase = searchParams.get('p') as 'all' | 'groupStage' | 'final' | null;
  const urlStatus = searchParams.get('s') as 'all' | 'scheduled' | 'live' | 'finished' | null;
  const urlTab = searchParams.get('tab') as PublicNavTab | null;
  const urlMyTeamOnly = searchParams.get('my') === '1';

  // "Mein Team" state
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [showOnlyMyTeam, setShowOnlyMyTeam] = useState(urlMyTeamOnly);

  // Filter state - initialized from URL
  const [selectedGroup, setSelectedGroup] = useState<string | null>(urlGroup);
  const [selectedPhase, setSelectedPhase] = useState<PhaseFilter>(urlPhase ?? 'all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(urlStatus ?? 'all');

  // Bottom nav tab state - initialized from URL
  const [activeTab, setActiveTab] = useState<PublicNavTab>(urlTab ?? 'schedule');

  // Update URL when filters change
  const updateUrlParams = useCallback((params: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === 'all' || value === 'schedule' || (key === 'my' && value === '0')) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper functions to update state AND URL (with haptic feedback)
  const handleGroupChange = useCallback((group: string | null) => {
    triggerHaptic('selection');
    setSelectedGroup(group);
    updateUrlParams({ g: group });
  }, [updateUrlParams, triggerHaptic]);

  const handlePhaseChange = useCallback((phase: PhaseFilter) => {
    triggerHaptic('selection');
    setSelectedPhase(phase);
    updateUrlParams({ p: phase === 'all' ? null : phase });
  }, [updateUrlParams, triggerHaptic]);

  const handleStatusChange = useCallback((status: StatusFilter) => {
    triggerHaptic('selection');
    setSelectedStatus(status);
    updateUrlParams({ s: status === 'all' ? null : status });
  }, [updateUrlParams, triggerHaptic]);

  const handleTabChange = useCallback((tab: PublicNavTab) => {
    triggerHaptic('medium');
    setActiveTab(tab);
    updateUrlParams({ tab: tab === 'schedule' ? null : tab });
  }, [updateUrlParams, triggerHaptic]);

  const handleShowOnlyMyTeamChange = useCallback((value: boolean) => {
    triggerHaptic('selection');
    setShowOnlyMyTeam(value);
    updateUrlParams({ my: value ? '1' : null });
  }, [updateUrlParams, triggerHaptic]);

  // Load "Mein Team" from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(getMyTeamStorageKey(shareCode));
    if (stored) {
      setMyTeamId(stored);
    }
  }, [shareCode]);

  // Save "Mein Team" to localStorage
  const selectMyTeam = useCallback((teamId: string | null) => {
    triggerHaptic('success');
    setMyTeamId(teamId);
    if (teamId) {
      localStorage.setItem(getMyTeamStorageKey(shareCode), teamId);
    } else {
      localStorage.removeItem(getMyTeamStorageKey(shareCode));
    }
    setShowTeamSelector(false);
  }, [shareCode, triggerHaptic]);

  const filters = useMemo<ViewFilters>(
    () => ({ showOnlyMyTeam, myTeamId, selectedGroup, selectedPhase, selectedStatus }),
    [showOnlyMyTeam, myTeamId, selectedGroup, selectedPhase, selectedStatus]
  );

  return {
    filters,
    activeTab,
    showTeamSelector,
    setShowTeamSelector,
    handleGroupChange,
    handlePhaseChange,
    handleStatusChange,
    handleTabChange,
    handleShowOnlyMyTeamChange,
    selectMyTeam,
  };
}
