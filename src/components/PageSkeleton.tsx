import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title & subtitle skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3.5 w-72 bg-slate-200 dark:bg-slate-800/80 rounded-md" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between"
          >
            <div className="space-y-2 flex-1">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60" />
          </div>
        ))}
      </div>

      {/* Table Search & Filters Skeleton */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="h-9 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Table Body Skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex gap-6">
          <div className="h-4 w-6 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="px-4 py-3 flex items-center gap-6">
              <div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded-sm" />
              <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
