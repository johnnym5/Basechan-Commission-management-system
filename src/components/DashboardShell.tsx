import React from 'react';

interface DashboardShellProps {
  role: 'ADMIN' | 'STAFF' | 'AGENT';
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({ role, children }) => {
  return (
    <div className="dashboard-shell space-y-5 sm:space-y-7" data-dashboard-role={role}>
      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
};
