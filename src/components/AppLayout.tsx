import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCommissionRates } from '../hooks/useCommissionRates';
import type { CommissionRate, UserRole } from '../types';
import { DashboardView } from './DashboardView';
import { SheetView } from './SheetView';
import { CompareView } from './CompareView';
import { UserManagementView } from './UserManagementView';
import { StaffPortalView } from './StaffPortalView';
import { AgentPortalView } from './AgentPortalView';
import { DealCalculatorView } from './DealCalculatorView';
import { AddRateModal } from './AddRateModal';
import { Sidebar } from './Sidebar';
import { EditRateModal } from './EditRateModal';
import { ExcelUploadModal } from './ExcelUploadModal';
import { DeleteAllModal } from './DeleteAllModal';
import { MigrateIntakeModal } from './MigrateIntakeModal';
import { LegalModal } from './LegalModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { PageSkeleton } from './PageSkeleton';
import {
  Copy,
  LogOut,
  Menu,
  PlusCircle,
  ArrowRightLeft,
  Upload,
  ShieldCheck,
  UserCheck,
  UserX,
  Eye,
  X,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';

// Interactive Icon Button with Floating Hover/Long-Press Tooltip
const IconButtonWithTooltip: React.FC<{
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  activeClass?: string;
  inactiveClass?: string;
  className?: string;
}> = ({ title, onClick, icon, active, activeClass, inactiveClass, className }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile long-press handler
  const handleTouchStart = () => {
    touchTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 350); // 350ms touch-and-hold
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    setTimeout(() => setShowTooltip(false), 1200);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        title={title}
        className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center relative ${
          active
            ? activeClass || 'bg-[#F7F4EF] dark:bg-[#0E1526] text-amber-600 dark:text-amber-400 shadow-2xs font-bold'
            : inactiveClass || 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        } ${className || ''}`}
      >
        {icon}
      </button>

      {/* Floating Animated Tooltip Popover on Hover or Long Press */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-extrabold text-[10px] rounded-lg shadow-xl whitespace-nowrap z-[100] animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
          {title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-100" />
        </div>
      )}
    </div>
  );
};

export const AppLayout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Custom hook with real-time Firestore sync & pre-computed search indexing
  const { rates, loading } = useCommissionRates();
  
  // Offline Network Status Listener
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Admin "View As" role preview state
  const [viewAsRole, setViewAsRole] = useState<UserRole>('ADMIN');

  // Header User Profile Menu Dropdown state
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState<boolean>(false);

  // Effective role used across views and sidebar
  const effectiveRole = role === 'ADMIN' ? viewAsRole : role;

  // Dynamic page state based on effective role
  const [currentPage, setCurrentPage] = useState<string>(
    effectiveRole === 'STAFF'
      ? 'Application Directory'
      : effectiveRole === 'AGENT'
      ? 'Agent Commissions'
      : 'Dashboard'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAddRateModalOpen, setIsAddRateModalOpen] = useState<boolean>(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState<boolean>(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Keyboard shortcut listener for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Switch default page when effective role changes
  const handleViewAsChange = (newViewRole: UserRole) => {
    setViewAsRole(newViewRole);
    if (newViewRole === 'STAFF') {
      setCurrentPage('Application Directory');
    } else if (newViewRole === 'AGENT') {
      setCurrentPage('Agent Commissions');
    } else {
      setCurrentPage('Dashboard');
    }
  };

  const handleEditRate = (rate: CommissionRate) => {
    if (role !== 'ADMIN') return;
    setEditingRate(rate);
    setIsEditModalOpen(true);
  };

  const handleUploadComplete = (count: number) => {
    setBannerNotice(`Successfully synced ${count} commission rates to Firestore.`);
    setTimeout(() => setBannerNotice(null), 6000);
  };

  const handleRateAdded = (newRate: CommissionRate) => {
    setBannerNotice(`Successfully added commission rate for ${newRate.universityName} (${newRate.aggregator} - ${newRate.intake}).`);
    setTimeout(() => setBannerNotice(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#18181B] flex font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors w-full max-w-full overflow-x-hidden">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        rates={rates}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        effectiveRole={effectiveRole}
        onOpenLegal={() => setIsLegalModalOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Offline Connection Drop Banner */}
        {isOffline && (
          <div className="bg-amber-600 text-white text-xs px-4 py-2.5 flex items-center justify-center gap-2 font-semibold shadow-md animate-in fade-in sticky top-0 z-40">
            <WifiOff className="w-4 h-4 text-amber-200 shrink-0" />
            <span>You are currently working offline. Offline edits will sync when your connection restores.</span>
          </div>
        )}

        {/* Header - 2nd Color (Secondary Dark Blue #0E1526) in Dark Mode */}
        <header className="bg-[#F7F4EF]/95 dark:bg-[#0E1526]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#222F43] sticky top-0 z-30 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Open Navigation Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <img
                src="/logo.png"
                alt="Basechan Logo"
                className="w-9 h-9 rounded-full object-cover hidden sm:block shadow-xs border border-amber-400/40"
              />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Basechan CMS
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {effectiveRole === 'ADMIN'
                    ? 'Commission Rates & Profit Margins'
                    : effectiveRole === 'STAFF'
                    ? 'Staff Application Guide'
                    : 'Agent Commission Directory'}
                </p>
              </div>
              <div className="sm:hidden text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                {currentPage}
              </div>
            </div>

            {/* HEADER RIGHT: User Profile FAB Button */}
            <div className="relative">
              <button
                onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                aria-label="Toggle user profile menu"
                className="inline-flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] transition cursor-pointer shadow-2xs group min-h-[40px] select-none"
              >
                {/* User Avatar Photo or Circle Initial */}
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-blue-600 dark:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs sm:text-[10px] flex items-center justify-center shrink-0">
                    {(user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Email Address & Role Badge (Hidden on mobile <sm, Visible on sm+) */}
                <div className="hidden sm:flex items-center gap-1.5 text-left">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[140px] sm:max-w-[200px] truncate">
                    {user?.email}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                      role === 'ADMIN'
                        ? 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-400/30'
                        : role === 'STAFF'
                        ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {effectiveRole}
                  </span>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-150" />
              </button>

              {/* FAB Dropdown Menu (Icon-Only Toolbars with Tooltips on Hover/Long-Press) */}
              {isHeaderMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-[#F7F4EF] dark:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] rounded-2xl shadow-2xl z-50 p-2.5 space-y-2.5 animate-dropdown-enter text-xs select-none"
                  onMouseLeave={() => setIsHeaderMenuOpen(false)}
                >
                  {/* Section 1: Compact User Profile Card */}
                  <div className="p-2.5 bg-white dark:bg-[#18181B] rounded-xl flex items-center justify-between border border-slate-200/80 dark:border-[#222F43]">
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-xs">{user?.displayName || 'User'}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-100 dark:bg-amber-400/15 text-blue-800 dark:text-amber-400 shrink-0 border border-transparent dark:border-amber-400/30">
                      {role}
                    </span>
                  </div>

                  {/* Section 2: Management Actions (Icon-Only Horizontal Row) */}
                  {role === 'ADMIN' && effectiveRole === 'ADMIN' && (
                    <div className="p-1 bg-white dark:bg-[#18181B] rounded-xl border border-slate-200/80 dark:border-[#222F43] flex items-center justify-around">
                      <IconButtonWithTooltip
                        title="Migrate / Clone Intake Sheet"
                        onClick={() => {
                          setIsMigrateModalOpen(true);
                          setIsHeaderMenuOpen(false);
                        }}
                        icon={<Copy className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                      />

                      <IconButtonWithTooltip
                        title="Import Excel Workbook"
                        onClick={() => {
                          setIsUploadModalOpen(true);
                          setIsHeaderMenuOpen(false);
                        }}
                        icon={<Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      />

                      <IconButtonWithTooltip
                        title="Add Rate / Intake"
                        onClick={() => {
                          setIsAddRateModalOpen(true);
                          setIsHeaderMenuOpen(false);
                        }}
                        icon={<PlusCircle className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                      />

                      <IconButtonWithTooltip
                        title="Compare Rates"
                        onClick={() => {
                          setCurrentPage(currentPage === 'Compare Rates' ? 'Dashboard' : 'Compare Rates');
                          setIsHeaderMenuOpen(false);
                        }}
                        icon={<ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                      />
                    </div>
                  )}

                  {/* Section 3: Admin View Mode Switcher (Icon-Only Segmented Control) */}
                  {role === 'ADMIN' && (
                    <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-[#18181B] rounded-xl border border-slate-200/80 dark:border-[#222F43]">
                      <IconButtonWithTooltip
                        title="Preview as ADMIN"
                        onClick={() => {
                          handleViewAsChange('ADMIN');
                          setIsHeaderMenuOpen(false);
                        }}
                        active={viewAsRole === 'ADMIN'}
                        icon={<ShieldCheck className="w-4 h-4" />}
                      />

                      <IconButtonWithTooltip
                        title="Preview as STAFF"
                        onClick={() => {
                          handleViewAsChange('STAFF');
                          setIsHeaderMenuOpen(false);
                        }}
                        active={viewAsRole === 'STAFF'}
                        activeClass="bg-[#F7F4EF] dark:bg-[#0E1526] text-blue-600 dark:text-blue-400 shadow-2xs font-bold"
                        icon={<UserCheck className="w-4 h-4" />}
                      />

                      <IconButtonWithTooltip
                        title="Preview as AGENT"
                        onClick={() => {
                          handleViewAsChange('AGENT');
                          setIsHeaderMenuOpen(false);
                        }}
                        active={viewAsRole === 'AGENT'}
                        icon={<UserX className="w-4 h-4" />}
                      />
                    </div>
                  )}

                  {/* Section 4: Appearance Theme (Icon-Only Segmented Control) */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-[#18181B] rounded-xl border border-slate-200/80 dark:border-[#222F43]">
                    <IconButtonWithTooltip
                      title="Light Mode"
                      onClick={() => {
                        setTheme('light');
                        setIsHeaderMenuOpen(false);
                      }}
                      active={theme === 'light'}
                      activeClass="bg-[#F7F4EF] text-amber-500 shadow-2xs"
                      icon={<Sun className="w-4 h-4" />}
                    />

                    <IconButtonWithTooltip
                      title="Dark Mode"
                      onClick={() => {
                        setTheme('dark');
                        setIsHeaderMenuOpen(false);
                      }}
                      active={theme === 'dark'}
                      activeClass="bg-[#0E1526] text-amber-400 shadow-2xs"
                      icon={<Moon className="w-4 h-4" />}
                    />

                    <IconButtonWithTooltip
                      title="System Theme"
                      onClick={() => {
                        setTheme('system');
                        setIsHeaderMenuOpen(false);
                      }}
                      active={theme === 'system'}
                      activeClass="bg-[#F7F4EF] dark:bg-[#0E1526] text-emerald-500 shadow-2xs"
                      icon={<Monitor className="w-4 h-4" />}
                    />
                  </div>

                  <hr className="my-1 border-slate-200 dark:border-[#222F43]" />

                  {/* Section 5: Bottom Utility Actions (Icon-Only Row) */}
                  <div className="p-1 bg-white dark:bg-[#18181B] rounded-xl border border-slate-200/80 dark:border-[#222F43] flex items-center justify-around">
                    <IconButtonWithTooltip
                      title="Trust & Privacy Center"
                      onClick={() => {
                        setIsLegalModalOpen(true);
                        setIsHeaderMenuOpen(false);
                      }}
                      icon={<ShieldCheck className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                    />

                    <IconButtonWithTooltip
                      title="Sign Out"
                      onClick={() => {
                        signOut();
                        setIsHeaderMenuOpen(false);
                      }}
                      icon={<LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                      inactiveClass="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Active Preview Mode Banner for Admin */}
          {role === 'ADMIN' && viewAsRole !== 'ADMIN' && (
            <div className="bg-blue-600 dark:bg-[#0E1526] border border-blue-500 dark:border-amber-400/50 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-200 dark:text-amber-400" />
                <span className="font-semibold">
                  PREVIEW MODE: Viewing system as <span className="underline font-bold uppercase">{viewAsRole}</span>.
                </span>
              </div>
              <button
                onClick={() => handleViewAsChange('ADMIN')}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Exit Preview</span>
              </button>
            </div>
          )}

          {bannerNotice && (
            <div className="bg-emerald-600 text-white text-xs px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                <span className="font-medium">{bannerNotice}</span>
              </div>
              <button
                onClick={() => setBannerNotice(null)}
                className="text-white/80 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Animated Page Views based on Effective Role */}
          <div key={`${effectiveRole}_${currentPage}`} className="animate-page-enter">
            {loading ? (
              <PageSkeleton />
            ) : effectiveRole === 'STAFF' ? (
              <StaffPortalView rates={rates} loading={loading} />
            ) : effectiveRole === 'AGENT' ? (
              <AgentPortalView rates={rates} loading={loading} />
            ) : currentPage === 'Dashboard' ? (
              <DashboardView 
                rates={rates}
                loading={loading}
                onEditRate={handleEditRate}
              />
            ) : currentPage === 'Compare Rates' ? (
              <CompareView 
                allRates={rates}
              />
            ) : currentPage === 'Deal Calculator' ? (
              <DealCalculatorView
                rates={rates}
              />
            ) : currentPage === 'Users & Activity' ? (
              <UserManagementView />
            ) : (
              <SheetView 
                sheetName={currentPage}
                rates={rates}
                loading={loading}
                onEditRate={handleEditRate}
              />
            )}
          </div>
        </main>
      </div>

      {/* Legal Trust Center Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Admin-only modals */}
      {role === 'ADMIN' && (
        <>
          <EditRateModal
            rate={editingRate}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingRate(null);
            }}
            onSaved={() => {
              setBannerNotice('Commission rate updated successfully.');
              setTimeout(() => setBannerNotice(null), 4000);
            }}
            onDeleted={() => {
              setBannerNotice('Commission rate deleted successfully.');
              setTimeout(() => setBannerNotice(null), 4000);
            }}
          />

          <AddRateModal
            isOpen={isAddRateModalOpen}
            onClose={() => setIsAddRateModalOpen(false)}
            existingRates={rates}
            onRateAdded={handleRateAdded}
          />

          <ExcelUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
          />

          <DeleteAllModal
            isOpen={isDeleteAllModalOpen}
            onClose={() => setIsDeleteAllModalOpen(false)}
            totalRatesCount={rates.length}
            onDeletedAll={(count) => {
              setBannerNotice(`Successfully purged all ${count} records from the database.`);
              setTimeout(() => setBannerNotice(null), 6000);
            }}
          />

          <MigrateIntakeModal
            isOpen={isMigrateModalOpen}
            onClose={() => setIsMigrateModalOpen(false)}
            existingRates={rates}
            onMigratedComplete={(count, targetIntake) => {
              setBannerNotice(`Successfully cloned ${count} rates to new intake "${targetIntake}".`);
              setTimeout(() => setBannerNotice(null), 6000);
            }}
          />
        </>
      )}

      {/* Universal Command Palette (Ctrl + K) for All Roles */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        rates={rates}
        setCurrentPage={setCurrentPage}
        onOpenAddRate={role === 'ADMIN' ? () => setIsAddRateModalOpen(true) : undefined}
        onOpenUpload={role === 'ADMIN' ? () => setIsUploadModalOpen(true) : undefined}
      />
    </div>
  );
};
