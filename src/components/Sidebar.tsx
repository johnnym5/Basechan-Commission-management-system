import React, { useState } from 'react';
import type { CommissionRate } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  X,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Users,
  Briefcase,
  Award,
  ShieldCheck,
  Calculator,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  rates: CommissionRate[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  effectiveRole?: string;
  onOpenLegal?: () => void;
}

const SHEET_NAMES = [
  'RAW DATA',
  'REAL',
  'UK - Agents',
  '2025 AGENT MASTER',
  'Master Comms',
  'Oct - Feb 2026',
  '2026 Jan BIL-AGENT COMMS',
  '2026 Sept BIL - AGENT COMMS',
  '2026 AGENT MASTER',
  'NOTES',
  'UAP Master List',
  'MASTER',
  'EDVOY Master List',
  'CRIZAC Master List',
  'SI-UK Master List',
];

interface NavItemProps {
  name: string;
  icon: any;
  isDashboard?: boolean;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  setIsOpen: (isOpen: boolean) => void;
  rates: CommissionRate[];
  isExpanded: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ 
  name, 
  icon: Icon, 
  isDashboard = false, 
  currentPage, 
  setCurrentPage, 
  setIsOpen, 
  rates,
  isExpanded,
}) => {
  const isActive = currentPage === name;
  const count = isDashboard 
    ? rates.length 
    : rates.filter((r) => r.sourceSheet === name).length;

  return (
    <button
      onClick={() => {
        setCurrentPage(name);
        setIsOpen(false);
      }}
      title={name}
      className={`group w-full flex items-center justify-between px-3.5 py-3 sm:py-2.5 text-sm sm:text-[13px] rounded-xl transition-all duration-150 cursor-pointer min-h-[44px] ${
        isActive 
          ? 'bg-blue-600 dark:bg-[#D97706] text-white dark:text-slate-950 font-bold shadow-xs'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#0E1526] hover:text-slate-900 dark:hover:text-slate-100 font-medium'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive ? 'text-white dark:text-slate-950' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
          }`}
        />
        <span
          className={`truncate text-left transition-opacity duration-150 ${
            isExpanded ? 'opacity-100' : 'lg:opacity-0 lg:w-0'
          }`}
        >
          {name}
        </span>
      </div>

      {count > 0 && isExpanded && (
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-mono transition-colors shrink-0 ml-1.5 ${
            isActive
              ? 'bg-blue-700 dark:bg-amber-600 text-white dark:text-slate-950 font-bold'
              : 'bg-slate-200 dark:bg-[#0E1526] text-slate-700 dark:text-slate-300 group-hover:bg-slate-300 dark:group-hover:bg-[#222F43]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  setCurrentPage, 
  rates,
  isOpen,
  setIsOpen,
  effectiveRole,
  onOpenLegal,
}) => {
  const { role: actualRole } = useAuth();
  const role = effectiveRole || actualRole;
  const [isHovered, setIsHovered] = useState(false);

  // On mobile when isOpen is true, always expand sidebar text
  const isExpandedDesktop = isHovered || isOpen;

  return (
    <>
      {/* Mobile Touch Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer - 1st Primary Dark Grey Obsidian Background #18181B in Dark Mode */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed inset-y-0 left-0 z-40 bg-[#F7F4EF] dark:bg-[#18181B] border-r border-slate-200 dark:border-[#222F43] flex flex-col h-screen
          transition-all duration-200 ease-in-out shadow-xl lg:shadow-xs
          ${isOpen ? 'translate-x-0 w-72 sm:w-64' : '-translate-x-full lg:translate-x-0'}
          ${isExpandedDesktop ? 'lg:w-64' : 'lg:w-18'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80 dark:border-[#222F43] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="Basechan Logo"
              className="w-9 h-9 rounded-full object-cover shrink-0 shadow-xs border border-[#D97706]/40"
            />
            <div
              className={`transition-opacity duration-150 overflow-hidden whitespace-nowrap ${
                isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0 lg:w-0'
              }`}
            >
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">Basechan CMS</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-mono">
                {role === 'ADMIN' ? 'Admin Intelligence' : role === 'STAFF' ? 'Staff Routing' : 'Agent Partner'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation sidebar"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2.5 rounded-xl lg:hidden active:bg-slate-200 dark:active:bg-slate-800 transition min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Admin Navigation */}
          {role === 'ADMIN' && (
            <>
              <div>
                <div
                  className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 transition-opacity ${
                    isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0'
                  }`}
                >
                  Admin Overview
                </div>
                <div className="space-y-1">
                  <NavItem
                    name="Dashboard"
                    icon={LayoutDashboard}
                    isDashboard
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    setIsOpen={setIsOpen}
                    rates={rates}
                    isExpanded={isExpandedDesktop}
                  />
                  <NavItem
                    name="Compare Rates"
                    icon={TrendingUp}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    setIsOpen={setIsOpen}
                    rates={rates}
                    isExpanded={isExpandedDesktop}
                  />
                  <NavItem
                    name="Deal Calculator"
                    icon={Calculator}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    setIsOpen={setIsOpen}
                    rates={[]}
                    isExpanded={isExpandedDesktop}
                  />
                  <NavItem
                    name="Users & Activity"
                    icon={Users}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    setIsOpen={setIsOpen}
                    rates={[]}
                    isExpanded={isExpandedDesktop}
                  />
                </div>
              </div>

              <div>
                <div
                  className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 transition-opacity ${
                    isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0'
                  }`}
                >
                  Excel Sheets ({SHEET_NAMES.length})
                </div>
                <div className="space-y-1">
                  {SHEET_NAMES.map((sheet) => (
                    <NavItem
                      key={sheet}
                      name={sheet}
                      icon={FileSpreadsheet}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      setIsOpen={setIsOpen}
                      rates={rates}
                      isExpanded={isExpandedDesktop}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Staff Navigation */}
          {role === 'STAFF' && (
            <div>
              <div
                className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 transition-opacity ${
                  isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0'
                }`}
              >
                Staff Navigation
              </div>
              <div className="space-y-1">
                <NavItem
                  name="Application Directory"
                  icon={Briefcase}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  setIsOpen={setIsOpen}
                  rates={[]}
                  isExpanded={isExpandedDesktop}
                />
              </div>
            </div>
          )}

          {/* Agent Navigation */}
          {role === 'AGENT' && (
            <div>
              <div
                className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 transition-opacity ${
                  isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0'
                }`}
              >
                Agent Portal
              </div>
              <div className="space-y-1">
                <NavItem 
                  name="Agent Commissions"
                  icon={Award}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  setIsOpen={setIsOpen}
                  rates={[]}
                  isExpanded={isExpandedDesktop}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Privacy Trust Button */}
        <div className="p-3 border-t border-slate-200/80 dark:border-[#222F43] shrink-0 bg-[#F7F4EF]/80 dark:bg-[#0E1526]/80 space-y-2">
          {onOpenLegal && (
            <button
              onClick={() => {
                onOpenLegal();
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 sm:py-1.5 rounded-xl bg-blue-50 dark:bg-[#18181B] border border-blue-200 dark:border-[#D97706]/30 text-blue-700 dark:text-[#D97706] text-xs font-semibold hover:bg-blue-100 dark:hover:bg-[#0E1526] transition cursor-pointer overflow-hidden whitespace-nowrap min-h-[44px] sm:min-h-[36px] ${
                isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0 lg:w-0'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-[#D97706] shrink-0" />
              <span className="truncate">Trust & Privacy Panel</span>
            </button>
          )}

          <div
            className={`flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap transition-opacity ${
              isExpandedDesktop ? 'opacity-100' : 'lg:opacity-0 lg:w-0'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-[#D97706] shrink-0" />
            <span className="truncate">Basechan CMS v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
