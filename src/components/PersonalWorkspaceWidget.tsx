import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Star, ArrowDown, Search } from 'lucide-react';
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
  onShowAllRates?: () => void;
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
  onShowAllRates,
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
  const [draftSearch, setDraftSearch] = useState(queryText);
  const [showSearchDock, setShowSearchDock] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchBarSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftSearch(queryText);
  }, [queryText]);

  useEffect(() => {
    const sentinel = searchBarSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      const headerBottom = 64;
      setShowSearchDock(!entry.isIntersecting && entry.boundingClientRect.bottom <= headerBottom);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!showSearchDock) setIsMobileSearchOpen(false);
  }, [showSearchDock]);

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
    if (onShowAllRates) onShowAllRates();
    else onResetFilters?.();
    if (onScrollToResults) {
      onScrollToResults();
      return;
    }
    const el = document.getElementById('master-intelligence-table-container') || document.getElementById('dashboard-results');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const smartSearchProps = {
    rates,
    activeTokens,
    onTokensChange,
    queryText,
    onQueryTextChange,
    draftText: draftSearch,
    onDraftTextChange: setDraftSearch,
    onToggleAdvanceFilters,
    totalResultCount: rates.length,
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
            type="button"
            aria-label="Show all available rates"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Show All Rates</span>
          </button>
        </div>
      </div>

      {/* Embedded Smart Conversational Search Bar inside Welcome Card */}
      <div ref={searchBarSentinelRef} className="relative z-10 pt-2 border-t border-slate-800/80">
        <SmartSearchBar
          {...smartSearchProps}
          advanceFiltersOpen={showSearchDock ? false : advanceFiltersOpen}
        />
      </div>

      {typeof document !== 'undefined' && document.getElementById('header-search-slot') && createPortal(
        showSearchDock ? (
          <button
            type="button"
            aria-label="Open search"
            aria-expanded={isMobileSearchOpen}
            aria-controls="mobile-search-panel"
            onClick={() => setIsMobileSearchOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-700 shadow-sm transition duration-150 hover:bg-white active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : null,
        document.getElementById('header-search-slot')!
      )}

      {typeof document !== 'undefined' && document.getElementById('header-search-desktop-slot') && createPortal(
        showSearchDock ? (
          <div className="header-search-entry mx-auto w-full max-w-3xl rounded-2xl border border-white/15 bg-slate-900/75 p-1 shadow-lg shadow-slate-950/15 backdrop-blur-sm">
            <SmartSearchBar
              {...smartSearchProps}
              compact
              advanceFiltersOpen={advanceFiltersOpen}
            />
          </div>
        ) : null,
        document.getElementById('header-search-desktop-slot')!
      )}

      {typeof document !== 'undefined' && isMobileSearchOpen && createPortal(
        <>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setIsMobileSearchOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/15 lg:hidden"
          />
          <div
            id="mobile-search-panel"
            role="dialog"
            aria-label="Search rates and filters"
            className="mobile-search-panel fixed inset-x-3 top-[4.5rem] z-50 rounded-2xl border border-white/20 bg-slate-900/95 p-1.5 shadow-xl shadow-slate-950/25 backdrop-blur-sm lg:hidden"
          >
            <SmartSearchBar
              {...smartSearchProps}
              compact
              advanceFiltersOpen={advanceFiltersOpen}
            />
          </div>
        </>,
        document.body
      )}

    </div>
  );
};
