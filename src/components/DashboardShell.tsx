import React, { useState } from 'react';

interface DashboardShellProps {
  role: 'ADMIN' | 'STAFF' | 'AGENT';
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ role, children }) => {
  const [overviewOpen, setOverviewOpen] = useState(false);
  return (
    <div className="dashboard-shell space-y-5 sm:space-y-7" data-dashboard-role={role}>
      {role !== 'ADMIN' && (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#26334b] bg-[#0e1526] px-4 text-left text-sm font-bold text-slate-200 sm:hidden"
          aria-expanded={overviewOpen}
          onClick={() => setOverviewOpen((value) => !value)}
        >
          <span>Overview & filters</span>
          <span aria-hidden="true">{overviewOpen ? '−' : '+'}</span>
        </button>
      )}
      <div className={overviewOpen ? 'space-y-5' : 'space-y-5 [&_.dashboard-summary]:hidden sm:[&_.dashboard-summary]:block'}>
        {children}
      </div>
    </div>
  );
};
