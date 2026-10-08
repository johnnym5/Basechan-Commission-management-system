import React, { useMemo, useState } from 'react';
import type { CommissionRate } from '../types';
import {
  BarChart3,
  PieChart,
  Award,
  TrendingUp,
} from 'lucide-react';

interface AnalyticsChartsProps {
  rates: CommissionRate[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ rates }) => {
  const [activeTab, setActiveTab] = useState<'aggregators' | 'distribution' | 'top10'>('aggregators');

  // 1. Aggregator Comparison Stats
  const aggregatorStats = useMemo(() => {
    const map = new Map<string, CommissionRate[]>();
    rates.forEach((r) => {
      const agg = r.aggregator || 'Direct / Other';
      if (!map.has(agg)) map.set(agg, []);
      map.get(agg)!.push(r);
    });

    const list: { name: string; count: number; avgDiff: number; maxDiff: number }[] = [];
    map.forEach((items, name) => {
      const percentItems = items.filter((i) => !i.isFlatFee);
      const avgDiff =
        percentItems.length > 0
          ? parseFloat((percentItems.reduce((s, i) => s + i.diffMargin, 0) / percentItems.length).toFixed(1))
          : 0;
      const maxDiff = items.length > 0 ? Math.max(...items.map((i) => i.diffMargin)) : 0;
      list.push({ name, count: items.length, avgDiff, maxDiff });
    });

    const maxAvg = list.length > 0 ? Math.max(...list.map((l) => l.avgDiff)) || 1 : 1;

    return {
      list: list.sort((a, b) => b.avgDiff - a.avgDiff),
      maxAvg,
    };
  }, [rates]);

  // 2. Margin Tier Distribution Stats
  const marginTiers = useMemo(() => {
    let high = 0; // 15%+
    let good = 0; // 10 - 15%
    let standard = 0; // 5 - 10%
    let low = 0; // 0 - 5%
    let flatOrZero = 0; // Flat fees / 0

    rates.forEach((r) => {
      if (r.isFlatFee || r.diffMargin <= 0) {
        flatOrZero++;
      } else if (r.diffMargin >= 15) {
        high++;
      } else if (r.diffMargin >= 10) {
        good++;
      } else if (r.diffMargin >= 5) {
        standard++;
      } else {
        low++;
      }
    });

    const total = rates.length || 1;

    return [
      { label: 'High Yield (15%+)', count: high, pct: ((high / total) * 100).toFixed(1), color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Good Margin (10–15%)', count: good, pct: ((good / total) * 100).toFixed(1), color: 'bg-teal-500', textColor: 'text-teal-600 dark:text-teal-400' },
      { label: 'Standard (5–10%)', count: standard, pct: ((standard / total) * 100).toFixed(1), color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
      { label: 'Low Margin (0–5%)', count: low, pct: ((low / total) * 100).toFixed(1), color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
      { label: 'Flat Fee / Net Route', count: flatOrZero, pct: ((flatOrZero / total) * 100).toFixed(1), color: 'bg-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400' },
    ];
  }, [rates]);

  // 3. Top 10 High-Yield University Ranking
  const top10Rates = useMemo(() => {
    return [...rates].sort((a, b) => b.diffMargin - a.diffMargin).slice(0, 10);
  }, [rates]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
      {/* Header & View Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Visual Yield & Margin Analytics
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Interactive breakdown of platform commission yields, margin distribution tiers, and top routes.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('aggregators')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'aggregators'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Platform Yields</span>
          </button>

          <button
            onClick={() => setActiveTab('distribution')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'distribution'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Margin Ranges</span>
          </button>

          <button
            onClick={() => setActiveTab('top10')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'top10'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Top 10 Routes</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Platform Yields Bar Chart */}
      {activeTab === 'aggregators' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="space-y-3">
            {aggregatorStats.list.map((agg) => {
              const barWidth = Math.max((agg.avgDiff / aggregatorStats.maxAvg) * 100, 8);
              return (
                <div key={agg.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{agg.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-[11px]">{agg.count} rates</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{agg.avgDiff}% avg</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden flex items-center">
                    <div
                      className="bg-linear-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Margin Tiers Distribution Bar */}
      {activeTab === 'distribution' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Segmented Visual Stacked Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden flex shadow-inner">
            {marginTiers.map((tier) => (
              <div
                key={tier.label}
                className={`${tier.color} h-full transition-all duration-300`}
                style={{ width: `${tier.pct}%` }}
                title={`${tier.label}: ${tier.count} rates (${tier.pct}%)`}
              />
            ))}
          </div>

          {/* Tier Legend & Counts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            {marginTiers.map((tier) => (
              <div
                key={tier.label}
                className="bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-3 rounded-xl flex flex-col justify-between space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${tier.color} shrink-0`} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{tier.label}</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100">{tier.count}</span>
                  <span className={`text-xs font-bold font-mono ${tier.textColor}`}>{tier.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Top 10 High-Yield Leaderboard */}
      {activeTab === 'top10' && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {top10Rates.map((rate, index) => (
              <div
                key={rate.id}
                className="py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full font-mono font-bold flex items-center justify-center shrink-0 text-[11px] ${
                      index === 0
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300'
                        : index === 1
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        : index === 2
                        ? 'bg-amber-700/10 text-amber-900 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    #{index + 1}
                  </span>

                  <div className="truncate">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{rate.universityName}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{rate.aggregator}</span>
                      <span>• {rate.intake} • {rate.studyLevel}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    +{rate.diffMargin}{rate.isFlatFee ? '£' : '%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
