import React, { useState, useMemo } from 'react';
import type { CommissionRate } from '../types';
import {
  Calculator,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface DealCalculatorViewProps {
  rates: CommissionRate[];
}

export const DealCalculatorView: React.FC<DealCalculatorViewProps> = ({ rates }) => {
  const [selectedUniName, setSelectedUniName] = useState<string>('');
  const [selectedRateId, setSelectedRateId] = useState<string>('');
  const [tuitionFee, setTuitionFee] = useState<number | ''>(16000);
  const [studentCount, setStudentCount] = useState<number>(1);

  // Unique list of universities
  const uniqueUniversities = useMemo(() => {
    return Array.from(new Set(rates.map((r) => r.universityName)))
      .filter(Boolean)
      .sort();
  }, [rates]);

  // Rates for selected university
  const availableRatesForUni = useMemo(() => {
    if (!selectedUniName) return [];
    return rates.filter((r) => r.universityName === selectedUniName);
  }, [rates, selectedUniName]);

  // Selected rate
  const activeRate = useMemo(() => {
    if (!selectedRateId) return availableRatesForUni[0] || null;
    return availableRatesForUni.find((r) => r.id === selectedRateId) || availableRatesForUni[0] || null;
  }, [availableRatesForUni, selectedRateId]);

  // Alternative higher-yielding route for the same university
  const betterRoute = useMemo(() => {
    if (!activeRate || availableRatesForUni.length <= 1) return null;
    const sorted = [...availableRatesForUni].sort((a, b) => b.diffMargin - a.diffMargin);
    if (sorted[0].id !== activeRate.id && sorted[0].diffMargin > activeRate.diffMargin) {
      return sorted[0];
    }
    return null;
  }, [activeRate, availableRatesForUni]);

  // Calculations
  const fee = typeof tuitionFee === 'number' ? tuitionFee : 0;
  const count = Math.max(1, studentCount);
  const totalTuition = fee * count;

  const masterIncomePerStudent = activeRate
    ? activeRate.isFlatFee
      ? activeRate.masterRate
      : (fee * activeRate.masterRate) / 100
    : 0;

  const agentPayoutPerStudent = activeRate
    ? activeRate.isFlatFee
      ? activeRate.agentRate
      : (fee * activeRate.agentRate) / 100
    : 0;

  const netProfitPerStudent = masterIncomePerStudent - agentPayoutPerStudent;

  const totalMasterIncome = masterIncomePerStudent * count;
  const totalAgentPayout = agentPayoutPerStudent * count;
  const totalNetProfit = netProfitPerStudent * count;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-400/30">
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span>Interactive Deal & Profit Estimator</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Student Enrollment Profit Calculator</h1>
          <p className="text-emerald-100/80 text-xs sm:text-sm leading-relaxed">
            Select a university route, tuition fee, and student count to calculate total commission income, agent payouts, and net company profit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Deal Parameters
          </h3>

          <div className="space-y-4 text-xs">
            {/* 1. Select University */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select University *
              </label>
              <select
                value={selectedUniName}
                onChange={(e) => {
                  setSelectedUniName(e.target.value);
                  setSelectedRateId('');
                }}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose University --</option>
                {uniqueUniversities.map((uni) => (
                  <option key={uni} value={uni}>
                    {uni}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Select Route / Intake */}
            {selectedUniName && availableRatesForUni.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Portal / Intake Route *
                </label>
                <select
                  value={activeRate?.id || ''}
                  onChange={(e) => setSelectedRateId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {availableRatesForUni.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.aggregator} • {r.intake} • {r.studyLevel} (Margin: +{r.diffMargin}{r.isFlatFee ? '£' : '%'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Tuition Fee */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tuition Fee Per Student (£) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">£</span>
                <input
                  type="number"
                  value={tuitionFee}
                  onChange={(e) => setTuitionFee(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 16000"
                  className="w-full pl-8 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 4. Student Count */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Number of Students
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={studentCount}
                  onChange={(e) => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-1.5">
                  {[1, 5, 10, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStudentCount(preset)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition ${
                        studentCount === preset
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Output: Calculations & Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          {!activeRate ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/80 dark:border-slate-800 border-dashed text-center text-slate-400 space-y-2">
              <Calculator className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Select a University to Model Earnings</p>
              <p className="text-xs max-w-sm mx-auto">
                Choose a partner institution from the left panel to calculate master income, agent payouts, and net retained profit.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Better Route Suggestion Alert */}
              {betterRoute && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in">
                  <Sparkles className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Higher Margin Route Available!</p>
                    <p>
                      Submitting via <strong className="underline">{betterRoute.aggregator}</strong> yields a profit margin of{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">+{betterRoute.diffMargin}{betterRoute.isFlatFee ? '£' : '%'}</strong> compared to active route (+{activeRate.diffMargin}{activeRate.isFlatFee ? '£' : '%'}).
                    </p>
                    <button
                      onClick={() => setSelectedRateId(betterRoute.id)}
                      className="mt-1 inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-100 underline cursor-pointer hover:text-amber-700"
                    >
                      <span>Switch to {betterRoute.aggregator} Route</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Earnings KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Tuition
                  </span>
                  <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                    £{totalTuition.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {count} student(s) @ £{fee.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Master Income
                  </span>
                  <p className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                    £{totalMasterIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {activeRate.isFlatFee ? `£${activeRate.masterRate} flat` : `${activeRate.masterRate}% rate`}
                  </p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/60 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs space-y-1">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Net Profit
                  </span>
                  <p className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
                    £{totalNetProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-400 font-mono font-bold">
                    +{activeRate.diffMargin}{activeRate.isFlatFee ? '£' : '%'} margin
                  </p>
                </div>
              </div>

              {/* Detailed Line Item Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Detailed Financial Breakdown</span>
                  <span className="text-slate-500 font-normal">{activeRate.universityName}</span>
                </div>

                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">Aggregator / Portal</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 text-right">{activeRate.aggregator}</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">Intake & Study Level</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 text-right">{activeRate.intake} • {activeRate.studyLevel}</td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">Master Rate (Incoming)</td>
                      <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400 text-right">
                        {activeRate.isFlatFee ? `£${activeRate.masterRate}` : `${activeRate.masterRate}%`}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-medium text-slate-600 dark:text-slate-400">Agent Rate (Payout)</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700 dark:text-slate-300 text-right">
                        {activeRate.isFlatFee ? `£${activeRate.agentRate}` : `${activeRate.agentRate}%`} (£{totalAgentPayout.toLocaleString()})
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/50 dark:bg-emerald-950/40">
                      <td className="p-3.5 font-bold text-emerald-900 dark:text-emerald-200">Net Profit Per Student</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300 text-right text-sm">
                        £{netProfitPerStudent.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
