import React, { useMemo } from 'react';
import type { CommissionRate } from '../../types';
import { useSheetVisibility } from '../../hooks/useSheetVisibility';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { useAuth } from '../../context/AuthContext';
import { COMMON_AGGREGATORS } from '../../constants/aggregators';
import {
  EyeOff,
  UserCheck,
  UserX,
  Layers3,
  Check,
  Star,
  SlidersHorizontal,
  Calendar,
  Layers,
  GraduationCap,
  Clock,
  Archive,
  CheckCircle2,
} from 'lucide-react';

interface SheetVisibilityTabProps {
  rates: CommissionRate[];
}

export const SheetVisibilityTab: React.FC<SheetVisibilityTabProps> = ({ rates }) => {
  const { user } = useAuth();
  const { sheetSettings, updateSheetVisibility } = useSheetVisibility();
  const {
    defaultIntake,
    defaultAggregator,
    defaultStudyLevel,
    defaultViewMode,
    defaultSortBy,
    intakeLifecycles,
    updateSystemDefaults,
    updateIntakeLifecycle,
  } = useSystemConfig();

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
    const set = new Set<string>(COMMON_AGGREGATORS);
    rates.forEach((r) => {
      if (r.aggregator) set.add(r.aggregator);
    });
    return Array.from(set).sort();
  }, [rates]);

  return (
    <div className="space-y-6">
      {/* Executive Intro Notice */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-blue-900 dark:text-blue-200 text-xs sm:text-sm flex items-start gap-3">
        <SlidersHorizontal className="w-5 h-5 text-blue-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 mb-1">
            Global Default Filters & Sheet Visibility Controls
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Configure default landing filters for all users. Admin settings can lock defaults or leave them open to <b>Any / All</b> choices. Toggling sheet visibility selectively hides/shows intake terms for Staff or Agents without altering underlying rate data.
          </p>
        </div>
      </div>

      {/* Global Default Landing Filters Grid */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222F43] pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              System Default Landing Filters
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
            GLOBAL LANDING PREFERENCES
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Default Intake */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-amber-400" />
              <span>Default Main Intake</span>
            </label>
            <select
              value={defaultIntake}
              onChange={(e) => updateSystemDefaults({ defaultIntake: e.target.value }, user?.email || 'Admin')}
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
              value={defaultAggregator}
              onChange={(e) => updateSystemDefaults({ defaultAggregator: e.target.value }, user?.email || 'Admin')}
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
              value={defaultStudyLevel}
              onChange={(e) => updateSystemDefaults({ defaultStudyLevel: e.target.value }, user?.email || 'Admin')}
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
                onClick={() => updateSystemDefaults({ defaultViewMode: 'cards' }, user?.email || 'Admin')}
                className={`flex-1 p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                  defaultViewMode === 'cards'
                    ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 border-transparent shadow-xs'
                    : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Grid Cards View</span>
                {defaultViewMode === 'cards' && <Check className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => updateSystemDefaults({ defaultViewMode: 'table' }, user?.email || 'Admin')}
                className={`flex-1 p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition ${
                  defaultViewMode === 'table'
                    ? 'bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 border-transparent shadow-xs'
                    : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Compact Table View</span>
                {defaultViewMode === 'table' && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Default Sorting Preference
            </label>
            <select
              value={defaultSortBy}
              onChange={(e) => updateSystemDefaults({ defaultSortBy: e.target.value }, user?.email || 'Admin')}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-900 dark:text-slate-100 font-extrabold text-xs cursor-pointer focus:ring-2 focus:ring-amber-400"
            >
              <option value="universityName">Sort Alphabetically by University</option>
              <option value="agentRate">Sort Highest Commission Rate First</option>
              <option value="guidance">Sort Focus Routes First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Intake Sheets Manager List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Active Intake Sheets ({sheetSummary.length}):
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Changes apply in real-time across user roles
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {sheetSummary.map((sheet) => {
            const setting = sheetSettings.find((s) => s.sheetName === sheet.name || s.id === sheet.name);
            const isHiddenStaff = setting?.disabledForStaff || false;
            const isHiddenAgents = setting?.disabledForAgents || false;
            const isDefault = defaultIntake === sheet.name;
            const lifecycle = intakeLifecycles[sheet.name]?.status || 'active';

            return (
              <div
                key={sheet.name}
                className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                  isDefault
                    ? 'bg-amber-500/10 border-amber-400/50'
                    : 'bg-white dark:bg-[#0E1526] border-slate-200 dark:border-[#222F43]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Layers3 className="w-4 h-4 text-blue-600 dark:text-amber-400 shrink-0" />
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      {sheet.name}
                    </span>
                    {isDefault && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
                        Default Intake
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        lifecycle === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : lifecycle === 'closing'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {lifecycle === 'active' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {lifecycle === 'closing' && <Clock className="w-3 h-3 text-amber-500" />}
                      {lifecycle === 'archived' && <Archive className="w-3 h-3 text-slate-500" />}
                      <span className="capitalize">{lifecycle}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Lifecycle Toggle */}
                    <select
                      value={lifecycle}
                      onChange={(e) =>
                        updateIntakeLifecycle(
                          sheet.name,
                          { status: e.target.value as 'active' | 'closing' | 'archived' },
                          user?.email || 'Admin'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#222F43] bg-slate-50 dark:bg-[#18181B] text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      <option value="active">Active Enrollment</option>
                      <option value="closing">Closing Soon</option>
                      <option value="archived">Archived</option>
                    </select>

                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-slate-300">
                      {sheet.count} {sheet.count === 1 ? 'Rate' : 'Rates'}
                    </span>
                  </div>
                </div>

                {/* Role Visibility Control Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#222F43]">
                  <button
                    type="button"
                    onClick={() =>
                      updateSheetVisibility(
                        sheet.name,
                        'STAFF',
                        !isHiddenStaff,
                        user?.email || 'Admin'
                      )
                    }
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                      isHiddenStaff
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Hide for Staff</span>
                    </span>
                    {isHiddenStaff ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateSheetVisibility(
                        sheet.name,
                        'AGENT',
                        !isHiddenAgents,
                        user?.email || 'Admin'
                      )
                    }
                    className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                      isHiddenAgents
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#222F43] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <UserX className="w-3.5 h-3.5" />
                      <span>Hide for Agents</span>
                    </span>
                    {isHiddenAgents ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
