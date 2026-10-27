import React, { useMemo, useState, useEffect } from 'react';
import { Search, X, Sparkles, Check, History, ChevronDown, Send, SlidersHorizontal, LayoutGrid, TableProperties, Star, Layers3, RotateCcw } from 'lucide-react';
import type { CommissionRate } from '../types';
import type { SearchToken } from '../types/search';
import { parseNaturalLanguage } from '../utils/nlpParser';
import { useTypewriter } from '../hooks/useTypewriter';
import { resolveUniversityCountry } from '../utils/groupingUtils';
import { StyledSelect } from './StyledSelect';
import type { SelectOption } from './StyledSelect';
import { useAuth } from '../context/AuthContext';

export interface SmartSearchBarProps {
  rates: CommissionRate[];
  activeTokens: SearchToken[];
  onTokensChange: (tokens: SearchToken[]) => void;
  queryText: string;
  onQueryTextChange: (query: string) => void;
  onToggleAdvanceFilters?: () => void;
  advanceFiltersOpen?: boolean;
  rolePrompts?: string[];
  totalResultCount?: number;
  selectedUniversity?: string;
  onUniversityChange?: (university: string) => void;
  selectedCountry?: string;
  onCountryChange?: (country: string) => void;
  selectedCommissionType?: string;
  onCommissionTypeChange?: (type: string) => void;
  selectedLevel?: string;
  onLevelChange?: (level: string) => void;
  selectedIntake?: string;
  onIntakeChange?: (intake: string) => void;
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  selectedAggregator?: string;
  onAggregatorChange?: (agg: string) => void;
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
  compact?: boolean;
  draftText?: string;
  onDraftTextChange?: (value: string) => void;
}

const RECENT_SEARCHES_STORAGE_KEY = 'basechan_recent_searches_v1';

export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  rates,
  activeTokens,
  onTokensChange,
  queryText,
  onQueryTextChange,
  onToggleAdvanceFilters,
  advanceFiltersOpen = false,
  rolePrompts = [
    'Search for your school, level, intake or route...',
    'Try: Leicester, Sept 2026, PG...',
    'Try: Focus schools in Canada...',
    'Try: Undergraduate in UK...',
  ],
  totalResultCount,
  selectedUniversity = 'ALL',
  onUniversityChange,
  selectedCountry = 'ALL',
  onCountryChange,
  selectedCommissionType = 'ALL',
  onCommissionTypeChange,
  selectedLevel = 'ALL',
  onLevelChange,
  selectedIntake = 'ALL',
  onIntakeChange,
  selectedStatus = 'ALL',
  onStatusChange,
  selectedAggregator = 'ALL',
  onAggregatorChange,
  selectedSortBy = 'ALPHABETICAL',
  onSortByChange,
  viewMode = 'cards',
  onViewModeChange,
  onlyShowStarred = false,
  onToggleStarred,
  watchlistCount = 0,
  groupByMode = 'NONE',
  onGroupByModeChange,
  activeCurrency = 'GBP',
  onCurrencyChange,
  onResetFilters,
  compact = false,
  draftText,
  onDraftTextChange,
}) => {
  const { role } = useAuth();
  const isAgent = role === 'AGENT';
  const [isFocused, setIsFocused] = useState(false);
  const [localAdvanceOpen, setLocalAdvanceOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Local input buffer so typing DOES NOT filter in real time before Enter or Send
  const [localInput, setLocalInput] = useState(queryText);

  useEffect(() => {
    setLocalInput(draftText ?? queryText);
  }, [draftText, queryText]);

  const updateLocalInput = (value: string) => {
    setLocalInput(value);
    onDraftTextChange?.(value);
  };

  const isAdvanceOpen = advanceFiltersOpen || localAdvanceOpen;
  const toggleAdvance = () => {
    if (onToggleAdvanceFilters) {
      onToggleAdvanceFilters();
    } else {
      setLocalAdvanceOpen((prev) => !prev);
    }
  };

  // Unique country, university, intake, and aggregator lists for advance filter dropdown
  const allCountries = useMemo(() => {
    const set = new Set<string>(['UK', 'Canada', 'USA', 'Australia']);
    rates.forEach((r) => {
      const c = resolveUniversityCountry(r.universityName, r.country, rates);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [rates]);
  const allUniversities = useMemo(() => Array.from(new Set(rates.map((r) => r.universityName).filter(Boolean))).sort(), [rates]);
  const allIntakes = useMemo(() => Array.from(new Set(rates.map((r) => r.intake).filter(Boolean))).sort(), [rates]);
  const allAggregators = useMemo(() => {
    const set = new Set<string>([
      'BASECHAN',
      'EDVOY',
      'SI-UK',
      'UAP',
      'CRIZAC',
      'KC OVERSEAS',
      'AIMS EDUCATION',
      'Direct',
    ]);
    rates.forEach((r) => {
      if (r.aggregator) set.add(r.aggregator);
    });
    return Array.from(set).sort();
  }, [rates]);

  // Check if any filter is active
  const hasActiveFilters = activeTokens.length > 0 ||
    selectedUniversity !== 'ALL' ||
    selectedCountry !== 'ALL' ||
    selectedLevel !== 'ALL' ||
    selectedIntake !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedAggregator !== 'ALL' ||
    onlyShowStarred;

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch (e) {
      console.error('Failed to load recent searches:', e);
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    if (!term.trim() || term.trim().length < 2) return;
    const cleanTerm = term.trim();
    const updated = [cleanTerm, ...recentSearches.filter((s) => s.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save recent search:', e);
    }
  };

  const typewriterText = useTypewriter(rolePrompts, isFocused || Boolean(localInput) || activeTokens.length > 0);

  const parseResult = useMemo(() => {
    if (!localInput.trim()) return { tokens: [], remainingText: '', didYouMean: undefined };
    return parseNaturalLanguage(localInput, rates);
  }, [localInput, rates]);

  // Input change updates LOCAL BUFFER ONLY (no parent re-filter while typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateLocalInput(e.target.value);
  };

  // Submit search and convert entered term to active filter chip
  const handleExecuteSearch = () => {
    const value = localInput.trim();
    if (!value) {
      onQueryTextChange('');
      return;
    }

    // "All" is a request to remove a text search, not a term to match against
    // school data (for example, "ALLOWED" contains "all"). Preserve structured
    // filters such as country or intake while clearing any text-search chips.
    if (/^all(?:\s+(?:universities|university|unis|schools))?$/i.test(value)) {
      onTokensChange(activeTokens.filter((token) => token.type !== 'search'));
      updateLocalInput('');
      onQueryTextChange('');
      return;
    }

    saveRecentSearch(value);

    const parsed = parseNaturalLanguage(value, rates);
    let newTokens: SearchToken[] = [];

    if (parsed.tokens.length > 0) {
      const existingIds = new Set(activeTokens.map((t) => t.id));
      newTokens = parsed.tokens.filter((t) => !existingIds.has(t.id));
    } else {
      // Create search chip for entered term
      const searchToken: SearchToken = {
        id: `search-${Date.now()}-${value}`,
        type: 'search',
        label: value,
        value: value,
      };
      if (!activeTokens.some((t) => t.value.toLowerCase() === value.toLowerCase())) {
        newTokens = [searchToken];
      }
    }

    if (newTokens.length > 0) {
      onTokensChange([...activeTokens, ...newTokens]);
    }

    // If there were recognized tokens AND unparsed remaining text, retain the remaining text in the search input
    if (parsed.tokens.length > 0 && parsed.remainingText.trim()) {
      updateLocalInput(parsed.remainingText.trim());
      onQueryTextChange(parsed.remainingText.trim());
    } else {
      // Auto-clear search box when all terms were applied
      updateLocalInput('');
      onQueryTextChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteSearch();
    }
  };

  const handleRemoveToken = (tokenId: string) => {
    const tokenToRemove = activeTokens.find((t) => t.id === tokenId);
    const updated = activeTokens.filter((t) => t.id !== tokenId);
    onTokensChange(updated);

    if (tokenToRemove) {
      if (tokenToRemove.type === 'school' && selectedUniversity === tokenToRemove.value) {
        onUniversityChange?.('ALL');
      } else if (tokenToRemove.type === 'country' && selectedCountry === tokenToRemove.value) {
        onCountryChange?.('ALL');
      } else if (tokenToRemove.type === 'level' && selectedLevel === tokenToRemove.value) {
        onLevelChange?.('ALL');
      } else if (tokenToRemove.type === 'intake' && selectedIntake === tokenToRemove.value) {
        onIntakeChange?.('ALL');
      } else if (tokenToRemove.type === 'status' && selectedStatus === tokenToRemove.value) {
        onStatusChange?.('ALL');
      } else if (tokenToRemove.type === 'aggregator' && selectedAggregator === tokenToRemove.value) {
        onAggregatorChange?.('ALL');
      }
    }
  };

  const handleAcceptSuggestion = (token: SearchToken) => {
    if (!activeTokens.some((t) => t.id === token.id || t.value === token.value)) {
      onTokensChange([...activeTokens, token]);
    }
    updateLocalInput('');
    onQueryTextChange('');

    // Update specific filter dropdown state if applicable
    if (token.type === 'school') {
      onUniversityChange?.(token.value);
    } else if (token.type === 'country') {
      onCountryChange?.(token.value);
    } else if (token.type === 'level') {
      onLevelChange?.(token.value);
    } else if (token.type === 'intake') {
      onIntakeChange?.(token.value);
    } else if (token.type === 'status') {
      onStatusChange?.(token.value);
    } else if (token.type === 'aggregator') {
      onAggregatorChange?.(token.value);
    }
  };

  const handleSelectRecentSearch = (term: string) => {
    updateLocalInput('');
    if (/^all(?:\s+(?:universities|university|unis|schools))?$/i.test(term.trim())) {
      onTokensChange(activeTokens.filter((token) => token.type !== 'search'));
      onQueryTextChange('');
      return;
    }
    saveRecentSearch(term);

    const searchToken: SearchToken = {
      id: `recent-${Date.now()}-${term}`,
      type: 'search',
      label: term,
      value: term,
    };
    if (!activeTokens.some((t) => t.value.toLowerCase() === term.toLowerCase())) {
      onTokensChange([...activeTokens, searchToken]);
    }
    onQueryTextChange('');
  };

  const handleResetAll = () => {
    onTokensChange([]);
    updateLocalInput('');
    onQueryTextChange('');
    onUniversityChange?.('ALL');
    onCountryChange?.('ALL');
    onLevelChange?.('ALL');
    onIntakeChange?.('ALL');
    onStatusChange?.('ALL');
    onAggregatorChange?.('ALL');
    if (onlyShowStarred && onToggleStarred) {
      onToggleStarred();
    }
    onResetFilters?.();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (e) {}
  };

  return (
    <div className={`relative w-full ${compact ? '' : 'space-y-2'}`}>
      {/* Search Bar Container */}
      <div className={`relative w-full ${compact ? '' : 'space-y-2'}`}>
        <div
          className={`relative flex ${compact ? 'flex-nowrap' : 'flex-wrap'} items-center ${compact ? 'gap-1.5' : 'gap-2'} min-h-[52px] w-full rounded-2xl border ${compact ? 'px-2 py-1.5 sm:px-3.5 sm:py-2' : 'px-3.5 py-2'} text-sm text-white transition-all duration-200 ${compact ? 'bg-white/5 border-white/15' : 'bg-[#090d16]'} ${
            isFocused ? 'border-blue-400 ring-2 ring-blue-500/20 shadow-lg' : compact ? 'border-white/15 hover:border-blue-400/60' : 'border-[#33415d] hover:border-blue-400/60'
          }`}
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-0.5" />

          {/* Active Token Chips with Individual X Remove Buttons */}
          {!compact && activeTokens.map((token) => (
            <span
              key={token.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-950/80 px-2.5 py-1 text-xs font-bold text-blue-200 border border-blue-800 animate-in fade-in zoom-in-95"
            >
              <span className="text-[10px] uppercase text-blue-400 font-extrabold mr-0.5">{token.type}:</span>
              <span>{token.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveToken(token.id)}
                className="text-blue-400 hover:text-white transition p-0.5 cursor-pointer"
                aria-label={`Remove ${token.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Full-Width Search Input Field */}
          <div className={`relative flex-1 ${compact ? 'min-w-0' : 'min-w-[160px]'}`}>
            <input
              type="text"
              value={localInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              aria-label={compact ? 'Search rates' : 'Search directory'}
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-transparent font-medium"
            />

            {/* Typewriter Overlay Placeholder (Decoupled from input placeholder for A11Y) */}
            {!localInput && (compact || activeTokens.length === 0) && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 text-sm text-slate-500 font-mono select-none truncate max-w-full"
              >
                {compact ? 'Search rates...' : typewriterText || 'Search for your school, level, intake or route...'}
                <span className="animate-pulse">|</span>
              </span>
            )}
          </div>

          {/* Right Action Controls: Reset All + Advance Filter Button + Blue Send/Execute Button */}
          <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'} shrink-0 ml-auto`}>
            {!compact && hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAll}
                title="Clear All Filters & Chips"
                aria-label="Reset All"
                className="px-2.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Reset All</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleAdvance}
              aria-label={compact ? 'Open filters' : 'Advance filter'}
              title="Toggle Advance Filters"
              className={`rounded-xl border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${compact ? 'min-h-10 min-w-10 justify-center p-2' : 'p-2 sm:p-2.5'} ${
                isAdvanceOpen
                  ? 'border-blue-400 bg-blue-950/60 text-blue-200 shadow-xs'
                  : 'border-[#33415d] bg-[#18181B] text-slate-300 hover:border-blue-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
              {!compact && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isAdvanceOpen ? 'rotate-180' : ''}`} />}
            </button>

            {/* Primary Blue Submit / Send Button */}
            <button
              type="button"
              onClick={handleExecuteSearch}
              title={compact ? 'Apply search' : 'Execute Search (Enter)'}
              aria-label={compact ? 'Apply search' : undefined}
              className={`bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer ${compact ? 'min-h-10 min-w-10 p-2' : 'px-3.5 py-2'}`}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Advance Filter Dropdown Popover */}
        {isAdvanceOpen && (
          <div className={`p-4 bg-[#090d16] border border-[#33415d] rounded-2xl space-y-4 text-xs shadow-2xl animate-in fade-in duration-150 relative z-50 ${compact ? 'mt-2' : ''}`}>
            <div className="flex items-center justify-between font-bold text-slate-300 border-b border-[#26334b] pb-2">
              <span className="flex items-center gap-1.5 font-extrabold text-blue-300">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                Advanced Filters & View Mode Preferences
              </span>
              <div className="flex items-center gap-3">
                {/* View Mode Switcher for Desktop */}
                {onViewModeChange && (
                  <div className="hidden md:flex items-center gap-1 bg-[#18181B] border border-slate-700 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onViewModeChange('cards')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer ${
                        viewMode === 'cards'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Grid Cards View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange('table')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Table List View"
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                      <span>Table List</span>
                    </button>
                  </div>
                )}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All</span>
                  </button>
                )}
                <button onClick={toggleAdvance} className="text-slate-400 hover:text-white cursor-pointer ml-1">✕</button>
              </div>
            </div>

            {/* Detailed Filters Grid (University, Country, Commission Type, Level, Intake, Status, Portal, Sort By) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div>
                <label htmlFor="advance-university-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">University</label>
                <StyledSelect
                  id="advance-university-filter"
                  aria-label="University"
                  value={selectedUniversity ?? 'ALL'}
                  onChange={(val) => {
                    if (val !== 'ALL') {
                      handleAcceptSuggestion({ id: `uni-${val}`, type: 'school', label: val, value: val });
                    } else {
                      onUniversityChange?.('ALL');
                      onTokensChange(activeTokens.filter((t) => t.type !== 'school'));
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'All Universities' },
                    ...allUniversities.map((u): SelectOption => ({ value: u, label: u })),
                  ]}
                />
              </div>

              <div>
                <label htmlFor="advance-country-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
                <StyledSelect
                  id="advance-country-filter"
                  aria-label="Country"
                  value={selectedCountry ?? 'ALL'}
                  onChange={(val) => {
                    if (val !== 'ALL') {
                      handleAcceptSuggestion({ id: `country-${val}`, type: 'country', label: val, value: val });
                    } else {
                      onCountryChange?.('ALL');
                      onTokensChange(activeTokens.filter((t) => t.type !== 'country'));
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'All Countries' },
                    ...allCountries.map((c): SelectOption => ({ value: c, label: c })),
                  ]}
                />
              </div>

              <div>
                <label htmlFor="advance-commission-type-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
                <StyledSelect
                  id="advance-commission-type-filter"
                  aria-label="Commission Type"
                  value={selectedCommissionType ?? 'ALL'}
                  onChange={(val) => {
                    if (onCommissionTypeChange) onCommissionTypeChange(val);
                  }}
                  options={[
                    { value: 'ALL', label: 'All Types' },
                    { value: 'Percentage', label: 'Percentage (%)' },
                    { value: 'Fixed Fee', label: 'Fixed Fee (Cash)' },
                    { value: 'Mixed (Fee/%)', label: 'Mixed (Fee/%)' },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="advance-level-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Level</label>
                <StyledSelect
                  id="advance-level-filter"
                  aria-label="Level"
                  value={selectedLevel ?? 'ALL'}
                  onChange={(val) => {
                    if (val !== 'ALL') {
                      handleAcceptSuggestion({ id: `level-${val}`, type: 'level', label: val, value: val });
                    } else {
                      onLevelChange?.('ALL');
                      onTokensChange(activeTokens.filter((t) => t.type !== 'level'));
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'All Levels' },
                    { value: 'UG', label: 'Undergraduate (UG)' },
                    { value: 'PG', label: 'Postgraduate (PG)' },
                    { value: 'FD', label: 'Foundation (FD)' },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="advance-intake-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Intake</label>
                <StyledSelect
                  id="advance-intake-filter"
                  aria-label="Intake"
                  value={selectedIntake ?? 'ALL'}
                  onChange={(val) => {
                    if (val !== 'ALL') {
                      handleAcceptSuggestion({ id: `intake-${val}`, type: 'intake', label: val, value: val });
                    } else {
                      onIntakeChange?.('ALL');
                      onTokensChange(activeTokens.filter((t) => t.type !== 'intake'));
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'All Intakes' },
                    ...allIntakes.map((i): SelectOption => ({ value: i, label: i })),
                  ]}
                />
              </div>

              {!isAgent && (
                <div>
                  <label htmlFor="advance-status-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                  <StyledSelect
                    id="advance-status-filter"
                    aria-label="Status"
                    value={selectedStatus ?? 'ALL'}
                    onChange={(val) => {
                      if (val !== 'ALL') {
                        handleAcceptSuggestion({ id: `status-${val}`, type: 'status', label: val, value: val });
                      } else {
                        onStatusChange?.('ALL');
                        onTokensChange(activeTokens.filter((t) => t.type !== 'status'));
                      }
                    }}
                    options={[
                      { value: 'ALL', label: 'All Guidance' },
                      { value: 'FOCUS', label: 'Focus Schools' },
                      { value: 'ALLOWED', label: 'Allowed' },
                      { value: 'DO_NOT_USE', label: 'Do Not Use' },
                    ]}
                  />
                </div>
              )}

              {!isAgent && (
                <div>
                  <label htmlFor="advance-portal-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Portal</label>
                  <StyledSelect
                    id="advance-portal-filter"
                    aria-label="Application Portal"
                    value={selectedAggregator ?? 'ALL'}
                    onChange={(val) => {
                      if (val !== 'ALL') {
                        handleAcceptSuggestion({ id: `portal-${val}`, type: 'aggregator', label: val, value: val });
                      } else {
                        onAggregatorChange?.('ALL');
                        onTokensChange(activeTokens.filter((t) => t.type !== 'aggregator'));
                      }
                    }}
                    options={[
                      { value: 'ALL', label: 'All Portals' },
                      ...allAggregators.map((a): SelectOption => ({ value: a, label: a })),
                    ]}
                  />
                </div>
              )}

              <div>
                <label htmlFor="advance-sort-filter" className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort By</label>
                <StyledSelect
                  id="advance-sort-filter"
                  aria-label="Sort By"
                  value={selectedSortBy ?? 'ALPHABETICAL'}
                  onChange={(val) => {
                    if (onSortByChange) onSortByChange(val);
                    if (onGroupByModeChange) {
                      if (val === 'UNIVERSITY') {
                        onGroupByModeChange('UNIVERSITY');
                      } else if (val === 'COUNTRY') {
                        onGroupByModeChange('COUNTRY');
                      } else if (val === 'ALPHABETICAL') {
                        onGroupByModeChange('NONE');
                      }
                    }
                  }}
                  options={[
                    { value: 'ALPHABETICAL', label: 'Alphabetical (A - Z)' },
                    { value: 'COUNTRY', label: 'Sort by Country' },
                    { value: 'UNIVERSITY', label: 'Sort by University' },
                    { value: 'HIGHEST_MARGIN', label: 'Highest Yield / Payout' },
                    { value: 'MOST_ROUTES', label: 'Most Available Routes' },
                  ]}
                />
              </div>
            </div>


            {/* View Mode, Watchlist, Grouping & Currency Controls inside Advance Filters Popover */}
            <div className="pt-2.5 border-t border-[#26334b] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Switcher */}
                {onViewModeChange && (
                  <div className="flex items-center bg-[#18181B] p-1 rounded-xl border border-[#33415d]">
                    <button
                      type="button"
                      onClick={() => onViewModeChange('cards')}
                      title="Grid Cards View"
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        viewMode === 'cards'
                          ? 'bg-blue-600 text-white shadow-2xs font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange('table')}
                      title="List Table View"
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-blue-600 text-white shadow-2xs font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Watchlist Filter Toggle Button */}
                {onToggleStarred && (
                  <button
                    type="button"
                    onClick={onToggleStarred}
                    title={onlyShowStarred ? 'Show All Schools' : 'Show Starred Watchlist Only'}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                      onlyShowStarred
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-2xs'
                        : 'bg-[#18181B] text-slate-300 border-[#33415d] hover:border-amber-400'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${onlyShowStarred ? 'fill-slate-950' : 'text-amber-400'}`} />
                    <span>Watchlist</span>
                    {watchlistCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900 text-white font-mono ml-0.5">
                        {watchlistCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Group By Selector */}
                {onGroupByModeChange && (
                  <div className="flex items-center gap-1 bg-[#18181B] p-1 rounded-xl border border-[#33415d] text-xs">
                    <Layers3 className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
                    <select
                      value={groupByMode}
                      onChange={(e) => onGroupByModeChange(e.target.value)}
                      className="bg-transparent font-bold text-slate-200 text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="NONE" className="bg-slate-900 text-white">Group: None (Flat)</option>
                      <option value="UNIVERSITY" className="bg-slate-900 text-white">Group: University</option>
                      <option value="COUNTRY" className="bg-slate-900 text-white">Group: Country</option>
                      <option value="AGGREGATOR" className="bg-slate-900 text-white">Group: Portal</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-auto">
                {/* Live Currency Switcher Toggle */}
                {onCurrencyChange && (
                  <div className="flex items-center bg-[#18181B] p-0.5 rounded-xl border border-[#33415d] text-[10px] font-extrabold">
                    {['GBP', 'USD', 'EUR', 'NGN'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onCurrencyChange(code)}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          activeCurrency === code
                            ? 'bg-blue-600 text-white shadow-2xs font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                )}

                {/* Apply Filters (Enter) Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    handleExecuteSearch();
                    if (isAdvanceOpen) toggleAdvance();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95 text-xs"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>Apply Filters (Enter)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fuzzy Match "Did You Mean?" Prompt */}
        {parseResult.didYouMean && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 animate-in fade-in duration-150">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Did you mean <strong>{parseResult.didYouMean.suggestion.label}</strong>?</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                if (parseResult.didYouMean) {
                  handleAcceptSuggestion(parseResult.didYouMean.suggestion);
                }
              }}
              className="ml-auto px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer"
            >
              Apply Chip
            </button>
          </div>
        )}

        {/* Suggestion Dropdown & Recent Search History Overlay when Focused */}
        {isFocused && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-[#33415d] bg-[#090d16] p-3.5 shadow-2xl space-y-3 text-xs text-slate-300 animate-in fade-in zoom-in-95">
            {/* Recent Search History */}
            {recentSearches.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-[#26334b]">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3 text-amber-400" />
                    Recent Searches
                  </span>
                  <button
                    type="button"
                    onMouseDown={clearRecentSearches}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Clear History
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={() => handleSelectRecentSearch(term)}
                      className="px-2.5 py-1 rounded-lg bg-[#18181B] border border-[#26334b] hover:border-amber-400 text-slate-200 text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Filter Suggestions */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                <span>Quick Filter Chips</span>
                {totalResultCount !== undefined && <span>{totalResultCount} total routes</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onMouseDown={() => handleAcceptSuggestion({ id: 'PG', type: 'level', label: 'Postgraduate', value: 'PG' })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#26334b] hover:border-blue-400 bg-[#0e1526] hover:bg-blue-950/40 text-slate-200 transition cursor-pointer"
                >
                  <Check className="w-3 h-3 text-blue-400" /> Postgraduate (PG)
                </button>
                <button
                  type="button"
                  onMouseDown={() => handleAcceptSuggestion({ id: 'UG', type: 'level', label: 'Undergraduate', value: 'UG' })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#26334b] hover:border-blue-400 bg-[#0e1526] hover:bg-blue-950/40 text-slate-200 transition cursor-pointer"
                >
                  <Check className="w-3 h-3 text-blue-400" /> Undergraduate (UG)
                </button>
                <button
                  type="button"
                  onMouseDown={() => handleAcceptSuggestion({ id: 'FOCUS', type: 'status', label: 'Focus', value: 'FOCUS' })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#26334b] hover:border-emerald-400 bg-[#0e1526] hover:bg-emerald-950/40 text-slate-200 transition cursor-pointer"
                >
                  <Check className="w-3 h-3 text-emerald-400" /> Focus Schools
                </button>
                <button
                  type="button"
                  onMouseDown={() => handleAcceptSuggestion({ id: 'UK', type: 'country', label: 'United Kingdom', value: 'UK' })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#26334b] hover:border-blue-400 bg-[#0e1526] hover:bg-blue-950/40 text-slate-200 transition cursor-pointer"
                >
                  <Check className="w-3 h-3 text-blue-400" /> United Kingdom (UK)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
