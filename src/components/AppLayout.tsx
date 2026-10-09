import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useCommissionRates } from '../hooks/useCommissionRates';
import { ensureRoleRateModelMigration, ensureSheetVisibilityRecords } from '../services/rateReadModels';
import type { CommissionRate, UserRole, UserUpdate } from '../types';
import { DashboardView } from './DashboardView';
import { SheetView } from './SheetView';
import { CompareView } from './CompareView';
import { UserManagementView } from './UserManagementView';
import { AgentAccessGate } from './AgentAccessGate';
import { ChatExperience } from './ChatExperience';
import { DealCalculatorView } from './DealCalculatorView';
import { AddRateModal } from './AddRateModal';
import { Sidebar } from './Sidebar';
import { EditRateModal } from './EditRateModal';
import { ExcelUploadModal } from './ExcelUploadModal';
import { DeleteAllModal } from './DeleteAllModal';
import { MigrateIntakeModal } from './MigrateIntakeModal';
import { LegalModal } from './LegalModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { AuditLogsDrawer } from './AuditLogsDrawer';
import { SheetVisibilityModal } from './SheetVisibilityModal';
import { UserTutorialModal } from './UserTutorialModal';
import { isQuotaOffline, subscribeToFirestoreMode } from '../services/firestoreOfflineMode';
import { markUpdateRead, subscribeToUserUpdates } from '../services/chatPersistence';
import {
  Copy,
  LogOut,
  Menu,
  PlusCircle,
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
  History,
  EyeOff,
  HelpCircle,
  MessageCircle,
  Bell,
  House,
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
    }, 350);
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
  const { user, role, access, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Custom hook with real-time Firestore sync & pre-computed search indexing
  const { rates, loading, error: ratesError, quotaMode, hasLocalCopy, lastSyncedAt } = useCommissionRates();
  const [isRatesErrorOpen, setIsRatesErrorOpen] = useState(Boolean(ratesError));
  const [isQuotaOfflineMode, setIsQuotaOfflineMode] = useState(isQuotaOffline(user?.uid));
  const [showQuotaToast, setShowQuotaToast] = useState(isQuotaOffline(user?.uid));
  const [activityUpdates, setActivityUpdates] = useState<UserUpdate[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  useEffect(() => {
    const refresh = (uid?: string) => {
      if (!uid || uid === user?.uid) setIsQuotaOfflineMode(isQuotaOffline(user?.uid));
    };
    refresh();
    return subscribeToFirestoreMode(refresh);
  }, [user?.uid]);

  useEffect(() => {
    setActivityUpdates([]);
    setIsActivityLoading(true);
    if (!user || isQuotaOfflineMode || quotaMode || (role === 'AGENT' && access.accessState !== 'approved')) {
      setActivityUpdates([]);
      setIsActivityLoading(false);
      return;
    }
    return subscribeToUserUpdates(
      user.uid,
      (updates) => {
        setActivityUpdates(updates);
        setIsActivityLoading(false);
      },
      (updateError) => {
        console.error('Could not listen to account updates:', updateError);
        setActivityUpdates([]);
        setIsActivityLoading(false);
      },
    );
  }, [user?.uid, role, access.accessState, isQuotaOfflineMode, quotaMode]);

  useEffect(() => {
    if (!isQuotaOfflineMode) return;
    setShowQuotaToast(true);
    const timeout = window.setTimeout(() => setShowQuotaToast(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [isQuotaOfflineMode]);

  useEffect(() => {
    setIsRatesErrorOpen(Boolean(ratesError));
  }, [ratesError]);

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
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState<boolean>(false);
  const [isSheetVisibilityOpen, setIsSheetVisibilityOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);

  // Effective role used across views and sidebar
  const effectiveRole = role === 'ADMIN' ? viewAsRole : role;
  const canUseAdminNavigation = role === 'ADMIN' && viewAsRole === 'ADMIN';
  const isLocalOnly = isQuotaOfflineMode || quotaMode || isOffline;
  const canWriteRates = role === 'ADMIN' && !isLocalOnly;
  const connectionState = isQuotaOfflineMode ? 'quota' : (isOffline ? 'offline' : 'online');
  const connectionRing = connectionState === 'quota'
    ? 'ring-gray-400 dark:ring-gray-500'
    : connectionState === 'offline'
      ? 'ring-rose-500 dark:ring-rose-400'
      : 'ring-emerald-500 dark:ring-emerald-400';
  const connectionLabel = connectionState === 'quota' ? 'Quota limit reached' : connectionState === 'offline' ? 'Offline' : 'Online';

  const handleActivityUpdateClick = (update: UserUpdate) => {
    if (!user || update.isRead) return;
    if (isLocalOnly) return;
    setActivityUpdates((current) => current.map((item) => item.id === update.id ? { ...item, isRead: true } : item));
    void markUpdateRead(user.uid, update.id).catch(() => {
      setActivityUpdates((current) => current.map((item) => item.id === update.id ? { ...item, isRead: false } : item));
    });
  };

  // Dynamic page state based on effective role
  const [currentPage, setCurrentPage] = useState<string>(
    effectiveRole === 'ADMIN' ? 'Dashboard' : 'Chat'
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
  const [adminChatInitialized, setAdminChatInitialized] = useState(false);
  const roleRateMigrationStarted = useRef(false);

  useEffect(() => {
    if (role !== 'ADMIN' || isLocalOnly || loading || rates.length === 0 || roleRateMigrationStarted.current) return;
    roleRateMigrationStarted.current = true;
    void ensureSheetVisibilityRecords(rates)
      .then(() => ensureRoleRateModelMigration(rates, user?.email || 'Admin'))
      .then((result) => {
        if (result.migrated) setBannerNotice(`Secure Staff and Agent rate views initialized from ${rates.length} canonical rates.`);
      })
      .catch((error) => setBannerNotice(error instanceof Error ? `Role-safe rate setup needs attention: ${error.message}` : 'Role-safe rate setup needs attention.'));
  }, [role, isLocalOnly, loading, rates, user?.email]);

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
    setCurrentPage(newViewRole === 'ADMIN' ? 'Dashboard' : 'Chat');
  };

  const switchAdminWorkspace = (workspace: 'Dashboard' | 'Chat') => {
    if (workspace === 'Chat') setAdminChatInitialized(true);
    setCurrentPage(role === 'ADMIN' && viewAsRole !== 'ADMIN' ? 'Chat' : workspace);
  };

  const navigateToPage = (page: string) => {
    if (page === 'Chat' && effectiveRole === 'ADMIN') setAdminChatInitialized(true);
    setCurrentPage(effectiveRole === 'ADMIN' ? page : 'Chat');
  };

  const handleEditRate = (rate: CommissionRate) => {
    if (role !== 'ADMIN') return;
    if (!canWriteRates) {
      setBannerNotice('Rate edits are unavailable while using saved offline data.');
      window.setTimeout(() => setBannerNotice(null), 5000);
      return;
    }
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
    role === 'AGENT' && access.accessState !== 'approved' ? <AgentAccessGate /> :
    <div className={`min-h-screen ${currentPage === 'Chat' ? 'h-[100dvh]' : ''} bg-[#FDFBF7] dark:bg-[#18181B] flex font-sans antialiased text-slate-800 dark:text-slate-100 transition-colors w-full max-w-full overflow-x-hidden`}>
      {canUseAdminNavigation && currentPage !== 'Chat' && <Sidebar
        currentPage={currentPage} 
        setCurrentPage={navigateToPage}
        rates={rates}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        effectiveRole={effectiveRole}
        onOpenLegal={() => setIsLegalModalOpen(true)}
      />}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${canUseAdminNavigation && currentPage !== 'Chat' ? 'lg:ml-[72px]' : ''}`}>
        {/* Offline Connection Drop Banner */}
        {isOffline && currentPage !== 'Chat' && (
          <div className="bg-amber-600 text-white text-xs px-4 py-2.5 flex items-center justify-center gap-2 font-semibold shadow-md animate-in fade-in sticky top-0 z-40">
            <WifiOff className="w-4 h-4 text-amber-200 shrink-0" />
            <span>You’re offline. Searches use your saved school data; changes are paused.</span>
          </div>
        )}
        {/* Header - 2nd Color (Secondary Dark Blue #0E1526) in Dark Mode */}
        <header className="flex-none bg-[#F7F4EF]/95 dark:bg-[#0E1526]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#222F43] sticky top-0 z-30 transition-colors">
          <div className="mx-auto flex h-16 w-full min-w-0 max-w-7xl items-center justify-between gap-2 px-2 sm:px-6 lg:px-8">
            <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
              {canUseAdminNavigation && currentPage !== 'Chat' && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Open Navigation Sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <img
                src="/logo.png"
                alt="Basechan Logo"
                className="w-9 h-9 rounded-full object-cover hidden sm:block shadow-xs border border-amber-400/40"
              />
              <div className="hidden min-w-0 sm:block">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Basechan CMS
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {currentPage === 'Chat'
                    ? 'Natural Language Search'
                    : effectiveRole === 'ADMIN'
                    ? 'Commission Rates & Profit Margins'
                    : effectiveRole === 'STAFF'
                    ? 'Staff Application Guide'
                    : 'Agent Commission Directory'}
                </p>
              </div>
              <div className="max-w-[160px] truncate text-base font-bold text-slate-900 dark:text-slate-100 sm:hidden">
                {currentPage}
              </div>
            </div>

            {/* HEADER RIGHT: User Tutorial Question Mark & User Profile FAB Button */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {role === 'ADMIN' && (
                <div aria-label="Admin workspace" className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-0.5 sm:p-1 dark:border-[#222F43] dark:bg-[#18181B]">
                  <button type="button" onClick={() => switchAdminWorkspace('Dashboard')} aria-label="Dashboard" title="Dashboard" aria-pressed={currentPage !== 'Chat'} className={`flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold sm:px-3 ${currentPage !== 'Chat' ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><House className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">Dashboard</span></button>
                  <button type="button" onClick={() => switchAdminWorkspace('Chat')} aria-label="Chat" title="Chat" aria-pressed={currentPage === 'Chat'} className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold sm:px-3 ${currentPage === 'Chat' ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><MessageCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Chat</span></button>
                </div>
              )}
              {/* Question Mark Onboarding Tutorial Button */}
              <button
                type="button"
                onClick={() => setIsTutorialOpen(true)}
                title="User Guide & System Onboarding"
                className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] transition cursor-pointer shadow-2xs flex items-center gap-1.5 min-h-[40px] text-xs font-bold text-slate-700 dark:text-slate-200 select-none"
              >
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Guide</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsActivityOpen((open) => !open)}
                  aria-label={`Activity center, ${activityUpdates.filter((item) => !item.isRead).length} unread updates`}
                  aria-expanded={isActivityOpen}
                  className="relative flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs transition hover:bg-slate-100 dark:border-[#222F43] dark:bg-[#18181B] dark:text-slate-200 dark:hover:bg-[#0E1526]"
                >
                  <Bell className="h-4 w-4" />
                  {activityUpdates.some((item) => !item.isRead) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#18181B]" />}
                </button>
                {isActivityOpen && (
                  <section aria-label="Activity center" className="absolute right-0 z-[80] mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F4EF] shadow-2xl dark:border-[#222F43] dark:bg-[#0E1526]">
                    <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#222F43]">
                      <div>
                        <h2 className="text-sm font-extrabold">Activity center</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Recent updates and app status</p>
                      </div>
                      <button type="button" onClick={() => setIsActivityOpen(false)} aria-label="Close activity center" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
                    </header>
                    <div className="border-b border-slate-200 px-4 py-2.5 text-xs dark:border-[#222F43]">
                      <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${connectionState === 'online' ? 'bg-emerald-500' : connectionState === 'offline' ? 'bg-rose-500' : 'bg-gray-400'}`} />
                      <span className="font-bold">{connectionLabel}</span>
                      {connectionState === 'quota' && <p className="ml-5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">Using saved data. Automatic retry in 12 hours.</p>}
                      {isLocalOnly && hasLocalCopy && <p className="ml-5 mt-1 leading-relaxed text-slate-600 dark:text-slate-300">Searches use saved school data.{lastSyncedAt && <> Last updated {new Date(lastSyncedAt).toLocaleString()}.</>}</p>}
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {isActivityLoading ? <p className="px-3 py-5 text-center text-xs text-slate-500">Loading activity…</p>
                        : activityUpdates.length === 0 ? <p className="px-3 py-5 text-center text-xs text-slate-500">No recent updates.</p>
                          : activityUpdates.slice(0, 20).map((update) => (
                            <button key={update.id} type="button" onClick={() => handleActivityUpdateClick(update)} className="flex w-full gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-white dark:hover:bg-slate-900">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${update.isRead ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-500'}`} />
                              <span className="min-w-0">
                                <span className="block text-xs font-bold">{update.title}</span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{update.summary}</span>
                                <span className="mt-1 block text-[10px] text-slate-400">{new Date(update.createdAt).toLocaleString()}</span>
                              </span>
                            </button>
                          ))}
                    </div>
                  </section>
                )}
              </div>

              {/* FAB Profile Button */}
              <div className="relative">
                <button
                  onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                  aria-label={`Toggle user profile menu. App status: ${connectionLabel}`}
                  title={connectionLabel}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-white dark:bg-[#18181B] hover:bg-slate-100 dark:hover:bg-[#0E1526] border border-slate-200 dark:border-[#222F43] ring-2 ring-offset-2 ${connectionRing} ring-offset-[#F7F4EF] dark:ring-offset-[#0E1526] transition cursor-pointer shadow-2xs group min-h-[40px] select-none`}
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

                {/* FAB Dropdown Menu (Import Excel Icon Removed) */}
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

                    {/* Section 2: Management Actions (Import Excel Icon Removed) */}
                    {role === 'ADMIN' && effectiveRole === 'ADMIN' && canWriteRates && (
                      <div className="p-1 bg-white dark:bg-[#18181B] rounded-xl border border-slate-200/80 dark:border-[#222F43] flex items-center justify-around">
                        <IconButtonWithTooltip
                          title="Sheet Visibility Manager"
                          onClick={() => {
                            setIsSheetVisibilityOpen(true);
                            setIsHeaderMenuOpen(false);
                          }}
                          icon={<EyeOff className="w-4 h-4 text-indigo-500 dark:text-amber-400" />}
                        />

                        <IconButtonWithTooltip
                          title="Migrate / Clone Intake Sheet"
                          onClick={() => {
                            setIsMigrateModalOpen(true);
                            setIsHeaderMenuOpen(false);
                          }}
                          icon={<Copy className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                        />

                        <IconButtonWithTooltip
                          title="Add Rate / Intake"
                          onClick={() => {
                            setIsAddRateModalOpen(true);
                            setIsHeaderMenuOpen(false);
                          }}
                          icon={<PlusCircle className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
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
                      {role === 'ADMIN' && (
                        <IconButtonWithTooltip
                          title="Audit History Logs"
                          onClick={() => {
                            setIsAuditLogsOpen(true);
                            setIsHeaderMenuOpen(false);
                          }}
                          icon={<History className="w-4 h-4 text-blue-600 dark:text-amber-400" />}
                        />
                      )}

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
          </div>
        </header>

        <main className={`flex-1 min-h-0 w-full min-w-0 mx-auto ${currentPage === 'Chat' ? 'flex flex-col max-w-none overflow-hidden px-0 py-0' : 'max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6'}`}>
          {loading && !ratesError && (
            <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 dark:border-[#222F43] dark:bg-[#0E1526] dark:text-slate-300">
              Loading your authorized school data…
            </div>
          )}
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
          <div key={effectiveRole} className={currentPage === 'Chat' ? 'flex min-h-0 flex-1 flex-col' : 'animate-page-enter'}>
            {effectiveRole === 'ADMIN' && (
              <div className={currentPage === 'Dashboard' ? '' : 'hidden'}>
                <DashboardView rates={rates} loading={loading} readOnly={!canWriteRates} onEditRate={handleEditRate} />
              </div>
            )}
            {effectiveRole === 'ADMIN' && adminChatInitialized && (
              <div className={currentPage === 'Chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                <ChatExperience rates={rates} loading={loading} role="ADMIN" updates={activityUpdates} onUpdatesChange={setActivityUpdates} dataMayBeStale={isLocalOnly && hasLocalCopy} lastSyncedAt={lastSyncedAt} />
              </div>
            )}
            {currentPage === 'Chat' ? (
              effectiveRole === 'ADMIN' ? null : <div className="flex min-h-0 flex-1 flex-col">
                <ChatExperience rates={rates} loading={loading} role={effectiveRole} updates={activityUpdates} onUpdatesChange={setActivityUpdates} dataMayBeStale={isLocalOnly && hasLocalCopy} lastSyncedAt={lastSyncedAt} />
              </div>
            ) : currentPage === 'Dashboard' ? (
              null
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
                readOnly={!canWriteRates}
                onEditRate={handleEditRate}
              />
            )}
          </div>
        </main>
      </div>

      {/* Role-Dynamic System Tutorial Modal */}
      <UserTutorialModal
        role={effectiveRole}
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* Sheet Visibility Modal */}
      <SheetVisibilityModal
        rates={rates}
        isOpen={isSheetVisibilityOpen && canWriteRates}
        onClose={() => setIsSheetVisibilityOpen(false)}
      />

      {/* Audit History Timeline Drawer */}
      <AuditLogsDrawer
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      {/* Legal Trust Center Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Admin-only modals */}
      {role === 'ADMIN' && canWriteRates && (
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
              setBannerNotice('Deletion completed successfully.');
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

      {showQuotaToast && isQuotaOfflineMode && currentPage !== 'Chat' && (
        <div role="status" aria-live="polite" className="fixed left-3 right-3 top-3 z-[120] mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 shadow-xl dark:border-amber-800 dark:bg-[#201b13] dark:text-amber-100 sm:left-1/2 sm:right-auto sm:w-full sm:-translate-x-1/2">
          You are using offline mode. Firestore quota was reached; we’ll check access again automatically.
        </div>
      )}

      {ratesError && !isQuotaOfflineMode && !isOffline && isRatesErrorOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsRatesErrorOpen(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="rates-error-title" aria-describedby="rates-error-description" className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-5 text-slate-900 shadow-2xl dark:border-amber-800 dark:bg-[#0E1526] dark:text-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="rates-error-title" className="text-base font-extrabold">School data unavailable</h2>
                <p id="rates-error-description" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ratesError}</p>
              </div>
              <button type="button" onClick={() => setIsRatesErrorOpen(false)} aria-label="Close error message" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Universal Command Palette (Ctrl + K) for All Roles */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        rates={rates}
        role={effectiveRole}
        setCurrentPage={navigateToPage}
        onOpenAddRate={effectiveRole === 'ADMIN' && canWriteRates ? () => setIsAddRateModalOpen(true) : undefined}
        onOpenUpload={effectiveRole === 'ADMIN' && canWriteRates ? () => setIsUploadModalOpen(true) : undefined}
      />
    </div>
  );
};
