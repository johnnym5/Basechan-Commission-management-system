import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSheetVisibility } from '../../hooks/useSheetVisibility';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import type { CommissionRate, StudyLevel } from '../../types';
import { IntakeMigrationTab } from './IntakeMigrationTab';
import { SheetManager } from './SheetManager';
import {
  Calendar,
  Layers,
  GraduationCap,
  Check,
  Star,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  Copy,
} from 'lucide-react';

interface SheetVisibilityTabProps {
  rates: CommissionRate[];
  onRefreshRates?: () => void;
  onOpenUpload?: () => void;
  onOpenAddRate?: () => void;
  onOpenMigrateIntake?: () => void;
}

export const SheetVisibilityTab: React.FC<SheetVisibilityTabProps> = ({
  rates,
  onRefreshRates = () => {},
  onOpenUpload,
  onOpenAddRate,
  onOpenMigrateIntake,
}) => {
  const { user } = useAuth();
  const { sheetSettings } = useSheetVisibility();
  const {
    defaultIntake,
    defaultAggregator,
    defaultStudyLevel,
    defaultViewMode,
    defaultSortBy,
    activeIntakes,
    loading,
    updateSystemDefaults,
  } = useSystemConfig();

  // Local Staged State for Centralized Save Button
  const [stagedActiveIntakes, setStagedActiveIntakes] = useState<string[]>([]);
  const [stagedDefaultIntake, setStagedDefaultIntake] = useState<string>('ALL');
  const [stagedDefaultAggregator, setStagedDefaultAggregator] = useState<string>('ALL');
  const [stagedDefaultStudyLevel, setStagedDefaultStudyLevel] = useState<string>('ALL');
  const [stagedDefaultViewMode, setStagedDefaultViewMode] = useState<'cards' | 'table'>('cards');
  const [stagedDefaultSortBy, setStagedDefaultSortBy] = useState<string>('universityName');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const hasInitialized = useRef(false);

  // Sync staged state ONLY ONCE when system config initially finishes loading/fetching
  useEffect(() => {
    if (!loading && !hasInitialized.current) {
      if (activeIntakes) setStagedActiveIntakes(activeIntakes);
      if (defaultIntake) setStagedDefaultIntake(defaultIntake);
      if (defaultAggregator) setStagedDefaultAggregator(defaultAggregator);
      if (defaultStudyLevel) setStagedDefaultStudyLevel(defaultStudyLevel);
      if (defaultViewMode) setStagedDefaultViewMode(defaultViewMode);
      if (defaultSortBy) setStagedDefaultSortBy(defaultSortBy);
      hasInitialized.current = true;
    }
  }, [loading, activeIntakes, defaultIntake, defaultAggregator, defaultStudyLevel, defaultViewMode, defaultSortBy]);

  // Check if any local staged setting differs from Firestore saved config
  const isDirty = useMemo(() => {
    if (!hasInitialized.current) return false;
    const sortedStaged = [...stagedActiveIntakes].sort();
    const sortedActive = [...(activeIntakes || [])].sort();
    if (JSON.stringify(sortedStaged) !== JSON.stringify(sortedActive)) return true;
    if (stagedDefaultIntake !== (defaultIntake || 'ALL')) return true;
    if (stagedDefaultAggregator !== (defaultAggregator || 'ALL')) return true;
    if (stagedDefaultStudyLevel !== (defaultStudyLevel || 'ALL')) return true;
    if (stagedDefaultViewMode !== (defaultViewMode || 'cards')) return true;
    if (stagedDefaultSortBy !== (defaultSortBy || 'universityName')) return true;
    return false;
  }, [
    stagedActiveIntakes,
    stagedDefaultIntake,
    stagedDefaultAggregator,
    stagedDefaultStudyLevel,
    stagedDefaultViewMode,
    stagedDefaultSortBy,
    activeIntakes,
    defaultIntake,
    defaultAggregator,
    defaultStudyLevel,
    defaultViewMode,
    defaultSortBy,
  ]);

  // Reset staged draft to current persisted Firestore config
  const handleResetDraft = () => {
    setStagedActiveIntakes(activeIntakes || []);
    setStagedDefaultIntake(defaultIntake || 'ALL');
    setStagedDefaultAggregator(defaultAggregator || 'ALL');
    setStagedDefaultStudyLevel(defaultStudyLevel || 'ALL');
    setStagedDefaultViewMode(defaultViewMode || 'cards');
    setStagedDefaultSortBy(defaultSortBy || 'universityName');
  };

  // Unique intake sheets & counts
  const sheetSummary = useMemo(() => {
    const map = new Map<string, number>();
    rates.forEach((r) => {
      const sheetName = r.sourceSheet || r.intake || 'Standard Sheet';
      map.set(sheetName, (map.get(sheetName) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rates]);

  // Unique aggregators
  const uniqueAggregators = useMemo(() => {
    const set = new Set(rates.map((r) => r.aggregator || 'Direct').filter(Boolean));
    return Array.from(set).sort();
  }, [rates]);

  const toggleIntakeActiveDefault = (intakeName: string) => {
    const exists = stagedActiveIntakes.includes(intakeName);
    if (exists) {
      setStagedActiveIntakes(stagedActiveIntakes.filter((item) => item !== intakeName));
    } else {
      setStagedActiveIntakes([...stagedActiveIntakes, intakeName]);
    }
  };

  const handleSaveSystemPreferences = async () => {
    try {
      setIsSaving(true);
      setSaveSuccessNotice(null);

      await updateSystemDefaults(
        {
          activeIntakes: stagedActiveIntakes,
          defaultIntake: stagedDefaultIntake,
          defaultAggregator: stagedDefaultAggregator,
          defaultStudyLevel: stagedDefaultStudyLevel as StudyLevel | 'ALL',
          defaultViewMode: stagedDefaultViewMode,
          defaultSortBy: stagedDefaultSortBy,
        },
        user?.email || 'Admin'
      );

      setSaveSuccessNotice('System landing preferences saved and synchronized globally across all user roles.');
    } catch (err) {
      console.error('Error saving system defaults:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Save Success Notice Banner */}
      {saveSuccessNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessNotice(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Explanation Banner with Quick Action Buttons */}
      <div className="p-4 sm:p-5 rounded-3xl bg-blue-950/40 border border-blue-800/80 text-blue-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-slate-100">
              Sheet, Intake & Default Filter Administration
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Configure default landing filters, manage active intake sheets, control role visibility for Staff/Agents, and perform batch intake rate cloning or deadline configurations in one unified dashboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onOpenAddRate && (
            <button
              type="button"
              onClick={onOpenAddRate}
              className="px-3.5 py-2 rounded-xl bg-blue-600 dark:bg-amber-400 hover:bg-blue-500 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Rate / Intake</span>
            </button>
          )}

          {onOpenMigrateIntake && (
            <button
              type="button"
              onClick={onOpenMigrateIntake}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Clone Intake Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Default Landing Filters Grid */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4 relative">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              System Default Landing Filters
            </h3>
            {isDirty && (
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3" />
                Unsaved Changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleResetDraft}
                className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Draft</span>
              </button>
            )}

            {/* Centralized Save Preferences Button */}
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={handleSaveSystemPreferences}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                isDirty
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 ring-2 ring-amber-400/40 font-extrabold'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Intake Default Selector Pills */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="font-extrabold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Active Default Intakes (Multi-Select Support)</span>
            </label>
            <button
              type="button"
              onClick={() => setStagedActiveIntakes([])}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-200 underline cursor-pointer"
            >
              Clear Intakes (Show All)
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Select one or multiple intakes to serve as active system defaults. Users landing on the dashboard will filter by these active intakes automatically.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStagedActiveIntakes([])}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                stagedActiveIntakes.length === 0
                  ? 'bg-amber-400 text-slate-950 border-amber-400 font-extrabold shadow-2xs'
                  : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-amber-400/60'
              }`}
            >
              <span>Show All Intakes (Open)</span>
              {stagedActiveIntakes.length === 0 && <Check className="w-3.5 h-3.5" />}
            </button>
            {sheetSummary.map((s) => {
              const isSelected = stagedActiveIntakes.includes(s.name);
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => toggleIntakeActiveDefault(s.name)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-2xs'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-amber-400/60'
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-[10px] opacity-75">({s.count})</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
          {/* Primary Default Intake Dropdown */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400" />
              <span>Primary Default Main Intake</span>
            </label>
            <select
              value={stagedDefaultIntake}
              onChange={(e) => setStagedDefaultIntake(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer focus:ring-2 focus:ring-amber-400"
            >
              <option value="ALL">Open to Any / Show All Intakes</option>
              {sheetSummary.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count} rates)
                </option>
              ))}
            </select>
          </div>

          {/* Default Aggregator */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400" />
              <span>Default Aggregator</span>
            </label>
            <select
              value={stagedDefaultAggregator}
              onChange={(e) => setStagedDefaultAggregator(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer focus:ring-2 focus:ring-amber-400"
            >
              <option value="ALL">Open to Any / Show All Aggregators</option>
              {uniqueAggregators.map((agg) => (
                <option key={agg} value={agg}>
                  {agg}
                </option>
              ))}
            </select>
          </div>

          {/* Default Study Level */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400" />
              <span>Default Study Level</span>
            </label>
            <select
              value={stagedDefaultStudyLevel}
              onChange={(e) => setStagedDefaultStudyLevel(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer focus:ring-2 focus:ring-amber-400"
            >
              <option value="ALL">Open to Any / All Levels</option>
              <option value="UG">Undergraduate (UG)</option>
              <option value="PG">Postgraduate (PG)</option>
              <option value="FD">Foundation / Diploma (FD)</option>
            </select>
          </div>
        </div>

        {/* View Mode & Default Sorting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-[#222F43] text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Agent Portal Default Display
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStagedDefaultViewMode('cards')}
                className={`flex-1 p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                  stagedDefaultViewMode === 'cards'
                    ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 border-transparent shadow-xs font-black'
                    : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Grid Cards View</span>
                {stagedDefaultViewMode === 'cards' && <Check className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setStagedDefaultViewMode('table')}
                className={`flex-1 p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                  stagedDefaultViewMode === 'table'
                    ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 border-transparent shadow-xs font-black'
                    : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Compact Table View</span>
                {stagedDefaultViewMode === 'table' && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Default Sorting Preference
            </label>
            <select
              value={stagedDefaultSortBy}
              onChange={(e) => setStagedDefaultSortBy(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer focus:ring-2 focus:ring-amber-400"
            >
              <option value="universityName">Sort Alphabetically by University</option>
              <option value="agentRate">Sort by Agent Rate (Highest First)</option>
              <option value="diffMargin">Sort by Master Margin / Yield</option>
            </select>
          </div>
        </div>

        {/* Bottom Action Bar when Changes Exist */}
        {isDirty && (
          <div className="pt-3 border-t border-slate-100 dark:border-[#222F43] flex items-center justify-between flex-wrap gap-2 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              You have unsaved landing filter preferences. Click Save Preferences to apply globally.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDraft}
                className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveSystemPreferences}
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded SheetManager Card Grid Component */}
      <SheetManager
        rates={rates}
        sheetSettings={useMemo(() => {
          const record: Record<string, { STAFF: boolean; AGENT: boolean }> = {};
          sheetSettings.forEach((s) => {
            record[s.sheetName] = {
              STAFF: !s.disabledForStaff,
              AGENT: !s.disabledForAgents,
            };
          });
          return record;
        }, [sheetSettings])}
        defaultIntake={stagedDefaultIntake !== 'ALL' ? stagedDefaultIntake : defaultIntake}
        onRefreshRates={onRefreshRates}
        onOpenUpload={onOpenUpload}
        onOpenAddRate={onOpenAddRate}
        onOpenMigrateIntake={onOpenMigrateIntake}
      />

      {/* Merged Intake Rate Cloning & Migration Tools Section */}
      <IntakeMigrationTab rates={rates} onRefreshRates={onRefreshRates} />
    </div>
  );
};
