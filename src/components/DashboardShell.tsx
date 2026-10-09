import React, { useState } from 'react';

interface DashboardShellProps {
  role: 'ADMIN' | 'STAFF' | 'AGENT';
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ role, title, description, children }) => {
  const [overviewOpen, setOverviewOpen] = useState(false);
  return <div className="dashboard-shell space-y-5 sm:space-y-7" data-dashboard-role={role}>
    {title && <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#080b13] via-[#0e1526] to-[#141b34] p-5 text-white shadow-xl sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">{role === 'ADMIN' ? 'Admin overview' : role === 'STAFF' ? 'Staff workspace' : 'Agent workspace'}</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p>}
    </section>}
    <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#26334b] bg-[#0e1526] px-4 text-left text-sm font-bold text-slate-200 sm:hidden" aria-expanded={overviewOpen} onClick={() => setOverviewOpen(value => !value)}>
      <span>Overview & filters</span><span aria-hidden="true">{overviewOpen ? '−' : '+'}</span>
    </button>
    <div className={overviewOpen ? 'space-y-5' : 'space-y-5 [&_.dashboard-summary]:hidden sm:[&_.dashboard-summary]:block'}>{children}</div>
  </div>;
};
