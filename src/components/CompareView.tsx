import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  ArrowRightLeft,
  TrendingUp,
  Award,
  History,
  RotateCcw,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { CommissionRate } from '../types';

interface CompareViewProps {
  allRates: CommissionRate[];
}

interface MatrixCell {
  rate?: CommissionRate;
  isHighest: boolean;
  isLowest: boolean;
}

interface MatrixRow {
  rowKey: string;
  intake: string;
  studyLevel: string;
  cells: Record<string, MatrixCell>;
}

export interface ComparisonHistoryItem {
  id: string;
  timestamp: string;
  universities: string[];
}

const HISTORY_STORAGE_KEY = 'basechan_compare_history_v1';

const UniversityMatrix: React.FC<{
  universityName: string;
  rates: CommissionRate[];
  onRemove: () => void;
}> = ({ universityName, rates, onRemove }) => {
  const uniRates = useMemo(
    () => rates.filter((r) => r.universityName === universityName),
    [rates, universityName]
  );

  const { aggregators, rows, bestByLevel } = useMemo(() => {
    const aggs = Array.from(new Set(uniRates.map((r) => r.aggregator)))
      .filter(Boolean)
      .sort();

    // Group by intake + studyLevel
    const rowMap = new Map<
      string,
      { intake: string; studyLevel: string; rates: CommissionRate[] }
    >();

    uniRates.forEach((r) => {
      const key = `${r.intake}__${r.studyLevel}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, { intake: r.intake, studyLevel: r.studyLevel, rates: [] });
      }
      rowMap.get(key)!.rates.push(r);
    });

    const matrixRows: MatrixRow[] = [];
    const levelBests = new Map<string, { agg: string; margin: number }>();

    Array.from(rowMap.values())
      .sort((a, b) => {
        if (a.intake !== b.intake) return a.intake.localeCompare(b.intake);
        return a.studyLevel.localeCompare(b.studyLevel);
      })
      .forEach((rowData) => {
        const cells: Record<string, MatrixCell> = {};
        let maxMargin = -Infinity;
        let minMargin = Infinity;

        // Find max/min margins for the row
        rowData.rates.forEach((r) => {
          if (r.diffMargin > maxMargin) maxMargin = r.diffMargin;
          if (r.diffMargin < minMargin) minMargin = r.diffMargin;
        });

        const hasVariety = maxMargin !== minMargin;

        aggs.forEach((agg) => {
          const rate = rowData.rates.find((r) => r.aggregator === agg);
          cells[agg] = {
            rate,
            isHighest: hasVariety && rate?.diffMargin === maxMargin,
            isLowest: hasVariety && rate?.diffMargin === minMargin,
          };
        });

        matrixRows.push({
          rowKey: `${rowData.intake}__${rowData.studyLevel}`,
          intake: rowData.intake,
          studyLevel: rowData.studyLevel,
          cells,
        });

        // Compute overall best aggregator per study level
        rowData.rates.forEach((r) => {
          const currentBest = levelBests.get(r.studyLevel);
          if (!currentBest || r.diffMargin > currentBest.margin) {
            levelBests.set(r.studyLevel, { agg: r.aggregator, margin: r.diffMargin });
          }
        });
      });

    return { aggregators: aggs, rows: matrixRows, bestByLevel: levelBests };
  }, [uniRates]);

  if (uniRates.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{universityName}</h3>
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md cursor-pointer"
          title="Remove from comparison"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2.5 bg-emerald-50/40 dark:bg-emerald-950/30 border-b border-slate-200 dark:border-slate-800">
        <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5 flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Best Margins by Level
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from(bestByLevel.entries()).map(([level, data]) => (
            <div
              key={level}
              className="bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 text-xs shadow-2xs"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-300">{level}:</span>{' '}
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{data.agg}</span>{' '}
              <span className="text-slate-400 text-[10px]">({data.margin})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-max text-xs">
          <thead>
            <tr>
              <th className="p-2.5 border-b border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Intake & Level
              </th>
              {aggregators.map((agg) => (
                <th
                  key={agg}
                  className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center"
                >
                  {agg}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.rowKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-2.5 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-xs">{row.intake}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {row.studyLevel}
                    </span>
                  </div>
                </td>
                {aggregators.map((agg) => {
                  const cell = row.cells[agg];
                  if (!cell.rate) {
                    return (
                      <td key={agg} className="p-2.5 text-center text-slate-300 dark:text-slate-600">
                        -
                      </td>
                    );
                  }

                  return (
                    <td
                      key={agg}
                      className={`p-2.5 text-center ${
                        cell.isHighest
                          ? 'bg-emerald-50 dark:bg-emerald-950/40'
                          : cell.isLowest
                          ? 'bg-rose-50/60 dark:bg-rose-950/40'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={`font-bold font-mono ${
                            cell.isHighest
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : cell.isLowest
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {cell.rate.diffMargin}
                          <span className="text-[9px] ml-0.5 font-normal">
                            {cell.rate.isFlatFee ? '£' : '%'}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {cell.rate.masterRate} / {cell.rate.agentRate}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const CompareView: React.FC<CompareViewProps> = ({ allRates }) => {
  const [selectedUnis, setSelectedUnis] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // History State
  const [history, setHistory] = useState<ComparisonHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // History pagination (10 per page)
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save comparison history:', err);
    }
  }, [history]);

  // Record history whenever 2 or more universities are compared
  const recordComparison = (unis: string[]) => {
    if (unis.length < 2) return;
    const sorted = [...unis].sort();
    setHistory((prev) => {
      const isSameAsTop =
        prev.length > 0 &&
        prev[0].universities.length === sorted.length &&
        [...prev[0].universities].sort().every((u, i) => u === sorted[i]);

      if (isSameAsTop) return prev;

      const newItem: ComparisonHistoryItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
        universities: sorted,
      };

      return [newItem, ...prev].slice(0, 50);
    });
  };

  const uniqueUnis = useMemo(() => {
    return Array.from(new Set(allRates.map((r) => r.universityName)))
      .filter(Boolean)
      .sort();
  }, [allRates]);

  const filteredUnis = useMemo(() => {
    if (!searchInput) return [];
    return uniqueUnis.filter(
      (u) =>
        u.toLowerCase().includes(searchInput.toLowerCase()) &&
        !selectedUnis.includes(u)
    );
  }, [uniqueUnis, searchInput, selectedUnis]);

  const addUniversity = (uni: string) => {
    if (selectedUnis.length >= 5) return;
    if (!selectedUnis.includes(uni)) {
      const updated = [...selectedUnis, uni];
      setSelectedUnis(updated);
      setSearchInput('');
      setShowDropdown(false);
      if (updated.length >= 2) {
        recordComparison(updated);
      }
    }
  };

  const removeUniversity = (uni: string) => {
    setSelectedUnis((prev) => prev.filter((u) => u !== uni));
  };

  const recompareHistory = (item: ComparisonHistoryItem) => {
    setSelectedUnis(item.universities);
  };

  const clearHistory = () => {
    setHistory([]);
    setHistoryPage(1);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  };

  const totalHistoryPages = Math.ceil(history.length / HISTORY_PAGE_SIZE) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return history.slice(start, start + HISTORY_PAGE_SIZE);
  }, [history, historyPage]);

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Title & Description */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Compare Universities (Up to 5)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compare profit margins side by side across platforms, intakes, and study levels.
          </p>
        </div>

        {selectedUnis.length > 0 && (
          <button
            onClick={() => setSelectedUnis([])}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Clear Selected ({selectedUnis.length})
          </button>
        )}
      </div>

      {/* University Search & Selection Area */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Selected Universities ({selectedUnis.length} / 5)
          </label>
          <span className="text-xs text-slate-400">
            {5 - selectedUnis.length} slots remaining
          </span>
        </div>

        {/* Selected Badges */}
        <div className="flex flex-wrap gap-2 min-h-8 items-center">
          {selectedUnis.map((uni) => (
            <span
              key={uni}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            >
              <span>{uni}</span>
              <button
                onClick={() => removeUniversity(uni)}
                className="hover:text-emerald-950 dark:hover:text-white transition cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}

          {selectedUnis.length === 0 && (
            <span className="text-xs text-slate-400 italic">
              Search and add universities to begin comparison...
            </span>
          )}
        </div>

        {/* Search input with autocomplete */}
        {selectedUnis.length < 5 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search university to add to comparison (e.g. Aberdeen, Leicester)..."
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />

            {showDropdown && searchInput && filteredUnis.length > 0 && (
              <ul className="absolute z-20 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mt-1 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUnis.map((u) => (
                  <li
                    key={u}
                    onMouseDown={() => addUniversity(u)}
                    className="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between transition-colors"
                  >
                    <span>{u}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Comparison Grid Area */}
      {selectedUnis.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-slate-400">
          <TrendingUp className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Universities Selected</h3>
          <p className="text-xs mt-1 text-center max-w-md text-slate-400">
            Select up to 5 universities above to view their side-by-side matrices across aggregators and study levels.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-5 items-start ${
            selectedUnis.length === 1
              ? 'grid-cols-1'
              : selectedUnis.length === 2
              ? 'grid-cols-1 xl:grid-cols-2'
              : selectedUnis.length === 3
              ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
          }`}
        >
          {selectedUnis.map((uni) => (
            <UniversityMatrix
              key={uni}
              universityName={uni}
              rates={allRates}
              onRemove={() => removeUniversity(uni)}
            />
          ))}
        </div>
      )}

      {/* Comparison History Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Comparison History ({history.length})
            </h3>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No comparisons recorded yet. Select 2 or more universities above to build comparison history.
          </div>
        ) : (
          <div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedHistory.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {item.universities.map((u) => (
                        <span
                          key={u}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{item.timestamp}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => recompareHistory(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recompare</span>
                  </button>
                </div>
              ))}
            </div>

            {totalHistoryPages > 1 && (
              <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Showing{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}
                  </span>{' '}
                  -{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {Math.min(historyPage * HISTORY_PAGE_SIZE, history.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-700 dark:text-slate-300">{history.length}</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(p - 1, 1))}
                    disabled={historyPage === 1}
                    className="p-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    Page {historyPage} of {totalHistoryPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(p + 1, totalHistoryPages))}
                    disabled={historyPage === totalHistoryPages}
                    className="p-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
