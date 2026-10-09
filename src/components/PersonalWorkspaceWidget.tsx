import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Star, ArrowDown } from 'lucide-react';
import { getLocalFavorites } from '../services/localRateDatabase';
import { getOrganization } from '../services/accessRequestService';

export interface PersonalWorkspaceWidgetProps {
  favoriteCount?: number;
  onOpenChat?: () => void;
  onScrollToResults?: () => void;
}

export const PersonalWorkspaceWidget: React.FC<PersonalWorkspaceWidgetProps> = ({
  favoriteCount,
  onOpenChat,
  onScrollToResults,
}) => {
  const { user, role, access, accessRequest } = useAuth();
  const [loadedFavoriteCount, setLoadedFavoriteCount] = useState<number>(0);
  const [orgName, setOrgName] = useState<string>('');

  const effectiveName = user?.displayName || (user?.email ? user.email.split('@')[0] : 'User');

  useEffect(() => {
    if (favoriteCount !== undefined) return;
    if (!user?.uid) return;
    getLocalFavorites(user.uid)
      .then((items) => setLoadedFavoriteCount(items.length))
      .catch(() => setLoadedFavoriteCount(0));
  }, [user?.uid, favoriteCount]);

  useEffect(() => {
    if (role !== 'AGENT') return;
    if (accessRequest?.requestedOrganizationName) {
      setOrgName(accessRequest.requestedOrganizationName);
      return;
    }
    if (access?.organizationId) {
      getOrganization(access.organizationId)
        .then((org) => {
          if (org?.name) setOrgName(org.name);
        })
        .catch(() => {});
    }
  }, [role, access?.organizationId, accessRequest?.requestedOrganizationName]);

  const effectiveFavoriteCount = favoriteCount ?? loadedFavoriteCount;

  const roleBadgeText = React.useMemo(() => {
    if (role === 'ADMIN') return 'Admin Intelligence';
    if (role === 'STAFF') return 'Staff Application Guide';
    if (orgName) return `${orgName} Partner`;
    return 'SI-UK Ghana Partner';
  }, [role, orgName]);

  const handleScrollToResults = () => {
    if (onScrollToResults) {
      onScrollToResults();
      return;
    }
    const el = document.getElementById('master-intelligence-table-container') || document.getElementById('dashboard-results');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenChat = () => {
    if (onOpenChat) {
      onOpenChat();
      return;
    }
    const chatTrigger = (document.querySelector('[data-testid="chat-launcher-button"]') as HTMLButtonElement | null)
      || (document.querySelector('button[aria-label="Open Chat Assistant"]') as HTMLButtonElement | null)
      || (document.querySelector('button[aria-label="Ask AI Assistant"]') as HTMLButtonElement | null);
    if (chatTrigger) {
      chatTrigger.click();
    }
  };

  return (
    <div
      data-testid="personal-workspace-widget"
      className="relative overflow-hidden p-4 sm:p-6 rounded-3xl bg-[#0E1526] border border-[#222F43] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3.5">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={effectiveName}
            className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-700 shadow-md"
          />
        ) : (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 font-black text-base shadow-inner">
            {effectiveName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight leading-snug truncate">
              Welcome back, {effectiveName}
            </h2>
            <span
              data-testid="role-agency-badge"
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0"
            >
              {roleBadgeText}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {role === 'ADMIN'
              ? 'Administrator Workspace & Rate Intelligence'
              : role === 'STAFF'
              ? 'Staff Application Route & Guidance Center'
              : 'Authorized Agency Partner Portal'}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 text-xs flex-wrap">
        {effectiveFavoriteCount > 0 && (
          <div
            data-testid="favorite-count-badge"
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-300 font-extrabold flex items-center gap-1.5 shadow-sm"
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>{effectiveFavoriteCount} Favorite {effectiveFavoriteCount === 1 ? 'School' : 'Schools'}</span>
          </div>
        )}

        <button
          onClick={handleOpenChat}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Ask AI</span>
        </button>

        <button
          onClick={handleScrollToResults}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          <span>View Rates</span>
        </button>
      </div>
    </div>
  );
};
