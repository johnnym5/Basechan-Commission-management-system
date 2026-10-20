import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Star, ArrowDown } from 'lucide-react';
import { getLocalFavorites } from '../services/localRateDatabase';
import { getOrganization } from '../services/accessRequestService';
import { SmartSearchBar } from './SmartSearchBar';
import type { CommissionRate } from '../types';
import type { SearchToken } from '../types/search';

export interface PersonalWorkspaceWidgetProps {
  rates?: CommissionRate[];
  activeTokens?: SearchToken[];
  onTokensChange?: (tokens: SearchToken[]) => void;
  queryText?: string;
  onQueryTextChange?: (query: string) => void;
  favoriteCount?: number;
  onOpenChat?: () => void;
  onScrollToResults?: () => void;
  onToggleAdvanceFilters?: () => void;
  advanceFiltersOpen?: boolean;
  selectedUniversity?: string;
  onUniversityChange?: (university: string) => void;
  selectedCountry?: string;
  onCountryChange?: (country: string) => void;
  selectedLevel?: string;
  onLevelChange?: (level: string) => void;
  selectedIntake?: string;
  onIntakeChange?: (intake: string) => void;
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  selectedAggregator?: string;
  onAggregatorChange?: (agg: string) => void;
  selectedCommissionType?: string;
  onCommissionTypeChange?: (type: string) => void;
  selectedSortBy?: string;
  onSortByChange?: (sort: string) => void;
  viewMode?: 'cards' | 'table';
  onViewModeChange?: (mode: 'cards' | 'table') => void;
  onlyShowStarred?: boolean;
  onToggleStarred?: () => void;
  watchlistCount?: number;
  groupByMode?: string;
  onGroupByModeChange?: (group: string) => void;
  activeCurrency?: string;
  onCurrencyChange?: (code: string) => void;
  onResetFilters?: () => void;
  syncIndicator?: React.ReactNode;
}

export const PersonalWorkspaceWidget: React.FC<PersonalWorkspaceWidgetProps> = ({
  rates = [],
  activeTokens = [],
  onTokensChange = () => {},
  queryText = '',
  onQueryTextChange = () => {},
  favoriteCount,
  onScrollToResults,
  onToggleAdvanceFilters,
  advanceFiltersOpen = false,
  selectedUniversity,
  onUniversityChange,
  selectedCountry,
  onCountryChange,
  selectedLevel,
  onLevelChange,
  selectedIntake,
  onIntakeChange,
  selectedStatus,
  onStatusChange,
  selectedAggregator,
  onAggregatorChange,
  selectedCommissionType,
  onCommissionTypeChange,
  selectedSortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onlyShowStarred,
  onToggleStarred,
  watchlistCount,
  groupByMode,
  onGroupByModeChange,
  activeCurrency,
  onCurrencyChange,
  onResetFilters,
  syncIndicator,
}) => {
  const { user, role, access, accessRequest } = useAuth();
  const [loadedFavoriteCount, setLoadedFavoriteCount] = useState<number>(0);
  const [orgName, setOrgName] = useState<string>('');

  const effectiveName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');

  useEffect(() => {
    if (favoriteCount !== undefined) return;
    if (!user?.uid) return;
    getLocalFavorites(user.uid)
      .then((items) => setLoadedFavoriteCount(items.length))
      .catch(() => setLoadedFavoriteCount(0));
  }, [user?.uid, favoriteCount]);

  useEffect(() => {
    if (role !== 'AGENT') return;
    if (accessRequest?.requestedOrganizationName) {
      setOrgName(accessRequest.requestedOrganizationName);
      return;
    }
    if (access?.organizationId) {
      getOrganization(access.organizationId)
        .then((org) => {
          if (org?.name) setOrgName(org.name);
        })
        .catch(() => {});
    }
  }, [role, access?.organizationId, accessRequest?.requestedOrganizationName]);

  const effectiveFavoriteCount = favoriteCount ?? loadedFavoriteCount;

  const roleBadgeText = React.useMemo(() => {
    if (role === 'ADMIN') return 'Admin Intelligence';
    if (role === 'STAFF') return 'Staff Application Guide';
    if (orgName) return `${orgName} Partner`;
    return 'Partner Agent';
  }, [role, orgName]);

  const handleScrollToResults = () => {
    if (onScrollToResults) {
      onScrollToResults();
      return;
    }
    const el = document.getElementById('master-intelligence-table-container') || document.getElementById('dashboard-results');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      data-testid="personal-workspace-widget"
      className="relative z-20 overflow-visible p-4 sm:p-6 rounded-3xl bg-[#0E1526] border border-[#222F43] text-white space-y-4 shadow-xl"
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Welcome Header Row */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={effectiveName}
              className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-700 shadow-md"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 font-black text-base shadow-inner">
              {effectiveName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight leading-snug truncate">
                Welcome back, {effectiveName}
              </h2>
              <span
                data-testid="role-agency-badge"
                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0"
              >
                {roleBadgeText}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {role === 'ADMIN'
                ? 'Administrator Workspace & Rate Intelligence'
                : role === 'STAFF'
                ? 'Staff Application Route & Guidance Center'
                : 'Authorized Agency Partner Portal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 text-xs flex-wrap shrink-0">
          {syncIndicator}
          {effectiveFavoriteCount > 0 && (
            <div
              data-testid="favorite-count-badge"
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-300 font-extrabold flex items-center gap-1.5 shadow-sm"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{effectiveFavoriteCount} Favorite {effectiveFavoriteCount === 1 ? 'School' : 'Schools'}</span>
            </div>
          )}

          <button
            onClick={handleScrollToResults}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
            <span>View Rates</span>
          </button>
        </div>
      </div>

      {/* Embedded Smart Conversational Search Bar inside Welcome Card */}
      <div className="relative z-10 pt-2 border-t border-slate-800/80">
        <SmartSearchBar
          rates={rates}
          activeTokens={activeTokens}
          onTokensChange={onTokensChange}
          queryText={queryText}
          onQueryTextChange={onQueryTextChange}
          onToggleAdvanceFilters={onToggleAdvanceFilters}
          advanceFiltersOpen={advanceFiltersOpen}
          totalResultCount={rates.length}
          selectedUniversity={selectedUniversity}
          onUniversityChange={onUniversityChange}
          selectedCountry={selectedCountry}
          onCountryChange={onCountryChange}
          selectedLevel={selectedLevel}
          onLevelChange={onLevelChange}
          selectedIntake={selectedIntake}
          onIntakeChange={onIntakeChange}
          selectedStatus={selectedStatus}
          onStatusChange={onStatusChange}
          selectedAggregator={selectedAggregator}
          onAggregatorChange={onAggregatorChange}
          selectedCommissionType={selectedCommissionType}
          onCommissionTypeChange={onCommissionTypeChange}
          selectedSortBy={selectedSortBy}
          onSortByChange={onSortByChange}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onlyShowStarred={onlyShowStarred}
          onToggleStarred={onToggleStarred}
          watchlistCount={watchlistCount}
          groupByMode={groupByMode}
          onGroupByModeChange={onGroupByModeChange}
          activeCurrency={activeCurrency}
          onCurrencyChange={onCurrencyChange}
          onResetFilters={onResetFilters}
        />
      </div>
    </div>
  );
};
