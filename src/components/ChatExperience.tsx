import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentChatProfile, ChatConversation, ChatMessage, CommissionRate, FavoriteSchool, UserUpdate } from '../types';
import type { DashboardFilters } from '../types/dashboard';
import { useAuth } from '../context/AuthContext';
import {
  createInitialChatState,
  isGreetingInput,
  processGreeting,
  processChatTurn,
  buildContextualSuggestions,
  type ChatSessionState,
} from '../services/chatSession';
import { predictQueryCompletions } from '../services/chatPrediction';
import {
  loadChatProfile,
  loadFavorites,
  loadRecentConversations,
  loadChatUsage,
  markUpdateRead,
  removeFavorite,
  saveConversation,
  saveChatProfile,
  saveChatUsage,
  saveFavorite,
} from '../services/chatPersistence';
import {
  deleteLocalFavorite,
  deleteLocalChatProfile,
  clearLocalFavoriteDeletion,
  getLocalFavoriteDeletions,
  getLocalChatConversations,
  getLocalChatProfile,
  getLocalChatUsage,
  getLocalFavorites,
  saveLocalChatConversation,
  saveLocalChatProfile,
  saveLocalChatUsage,
  saveLocalFavorite,
} from '../services/localRateDatabase';
import { isQuotaOffline, subscribeToFirestoreMode } from '../services/firestoreOfflineMode';
import { AgentAccessGate } from './AgentAccessGate';
import { Bell, Check, Heart, History, Loader2, Plus, Send, Star, X, AlertTriangle } from 'lucide-react';
import { ChatUtilityPanel, type ChatUtilityPanelKind } from './ChatUtilityPanel';
import './ChatExperience.css';

const EMPTY_CHAT_PROMPTS = [
  'Ask me about any school.',
  'Find schools by country, level, or intake.',
  'Compare the routes available to you.',
  'Explore schools marked Focus.',
];

export function selectSchoolResultRates(rates: CommissionRate[], schoolId: string): CommissionRate[] {
  return rates.filter((rate) => rate.universityId === schoolId);
}

interface ChatExperienceProps {
  rates: CommissionRate[];
  loading: boolean;
  role: 'STAFF' | 'AGENT' | 'ADMIN';
  updates: UserUpdate[];
  onUpdatesChange: React.Dispatch<React.SetStateAction<UserUpdate[]>>;
  onOpenChat?: () => void;
  dataMayBeStale?: boolean;
  lastSyncedAt?: string | null;
  initialPrompt?: string;
  dashboardFilters?: DashboardFilters;
  onDashboardFiltersChange?: (filters: DashboardFilters) => void;
  onViewDashboard?: () => void;
}

const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function chooseComparableRates(rates: CommissionRate[], schoolIds: string[], level?: string): CommissionRate[] {
  const chosen = new Map<string, CommissionRate>();
  for (const rate of rates.filter((item) => schoolIds.includes(item.universityId))) {
    const existing = chosen.get(rate.universityId);
    const rank = rate.studyLevel === level ? 0 : rate.studyLevel === 'ALL' ? 1 : 2;
    const existingRank = existing ? (existing.studyLevel === level ? 0 : existing.studyLevel === 'ALL' ? 1 : 2) : Infinity;
    if (!existing || rank < existingRank) chosen.set(rate.universityId, rate);
  }
  return Array.from(chosen.values()).slice(0, 4);
}

export function canCompareSelectedRates(rates: CommissionRate[], role: 'STAFF' | 'AGENT' | 'ADMIN'): boolean {
  if (rates.length < 2 || rates.length > 4) return false;
  const sameRoute = rates.every((rate) => rate.intake === rates[0].intake && rate.studyLevel === rates[0].studyLevel);
  if (!sameRoute) return false;
  if (role === 'STAFF') return true;
  return rates.every((rate) => rate.isFlatFee === rates[0].isFlatFee && rate.netOrGross === rates[0].netOrGross);
}

export const ChatExperience: React.FC<ChatExperienceProps> = ({ rates, loading, role, initialPrompt, updates, onUpdatesChange, dataMayBeStale = false, dashboardFilters, onDashboardFiltersChange, onViewDashboard }) => {
  const { user, access } = useAuth();
  const [session, setSession] = useState<ChatSessionState>(() => createInitialChatState(user?.uid || ''));
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [profile, setProfile] = useState<AgentChatProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteSchool[]>([]);
  const [input, setInput] = useState('');
  const [welcomePromptIndex, setWelcomePromptIndex] = useState(0);
  const [welcomePromptVisible, setWelcomePromptVisible] = useState(true);
  const [activePanel, setActivePanel] = useState<'chat' | 'results'>('chat');
  const [utilityPanel, setUtilityPanel] = useState<ChatUtilityPanelKind | null>(null);
  const [renderedUtilityPanel, setRenderedUtilityPanel] = useState<ChatUtilityPanelKind | null>(null);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(false);
  const [selectedResults, setSelectedResults] = useState<CommissionRate[]>([]);
  const [visibleResultCount, setVisibleResultCount] = useState(24);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [startingOptions, setStartingOptions] = useState<{ resume: ChatConversation | null; recent: ChatConversation[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [quotaMode, setQuotaMode] = useState(() => isQuotaOffline(user?.uid));
  const [cloudSyncRevision, setCloudSyncRevision] = useState(0);
  const [cloudUsageRevision, setCloudUsageRevision] = useState(0);
  const lastSyncedCloudUsageRevision = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const utilityPanelRef = useRef<HTMLElement | null>(null);
  const utilityCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const utilityOpenerRef = useRef<HTMLButtonElement | null>(null);
  const utilityCloseTimerRef = useRef<number | null>(null);
  const utilityOpenFrameRef = useRef<number | null>(null);
  const previousUtilityPanelRef = useRef<ChatUtilityPanelKind | null>(null);

  const localOnly = isOffline || quotaMode || dataMayBeStale;
  const localOnlyMessage = quotaMode
    ? 'Quota limit reached. Chat is using saved school data and will check for access again automatically.'
    : isOffline
      ? 'Offline. Chat is using saved school data until your connection returns.'
      : 'Using saved school data. It may be out of date.';

  const availableSchoolCount = useMemo(
    () => new Set(rates.map((rate) => rate.universityId).filter(Boolean)).size,
    [rates]
  );

  const messages = session.conversation.messages.map((message) => {
    if (message.role !== 'assistant' || !message.resultIds?.length) return message;
    return { ...message, resultRates: rates.filter((rate) => message.resultIds?.includes(rate.id)) };
  });

  const closeUtilityPanel = () => {
    setUtilityPanel(null);
    setUtilityPanelOpen(false);
    if (utilityCloseTimerRef.current !== null) window.clearTimeout(utilityCloseTimerRef.current);
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    utilityCloseTimerRef.current = window.setTimeout(() => {
      setRenderedUtilityPanel(null);
      utilityCloseTimerRef.current = null;
    }, reducedMotion ? 0 : 180);
  };

  const openUtilityPanel = (panel: ChatUtilityPanelKind, opener: HTMLButtonElement) => {
    if (utilityCloseTimerRef.current !== null) window.clearTimeout(utilityCloseTimerRef.current);
    if (utilityOpenFrameRef.current !== null) window.cancelAnimationFrame(utilityOpenFrameRef.current);
    utilityOpenerRef.current = opener;
    setRenderedUtilityPanel(panel);
    setUtilityPanel(panel);
    setUtilityPanelOpen(false);
    utilityOpenFrameRef.current = window.requestAnimationFrame(() => setUtilityPanelOpen(true));
  };

  useEffect(() => {
    if (!utilityPanel) return;
    utilityCloseButtonRef.current?.focus();
    const handlePanelKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeUtilityPanel();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = utilityPanelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handlePanelKeyDown);
    return () => document.removeEventListener('keydown', handlePanelKeyDown);
  }, [utilityPanel]);

  useEffect(() => {
    if (utilityPanel) {
      previousUtilityPanelRef.current = utilityPanel;
      return;
    }
    if (!previousUtilityPanelRef.current) return;
    previousUtilityPanelRef.current = null;
    utilityOpenerRef.current?.focus();
  }, [utilityPanel]);

  useEffect(() => () => {
    if (utilityCloseTimerRef.current !== null) window.clearTimeout(utilityCloseTimerRef.current);
    if (utilityOpenFrameRef.current !== null) window.cancelAnimationFrame(utilityOpenFrameRef.current);
  }, []);

  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    const online = () => setIsOffline(false);
    const offline = () => setIsOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  useEffect(() => subscribeToFirestoreMode((uid) => {
    if (!uid || uid === user?.uid) setQuotaMode(isQuotaOffline(user?.uid));
  }), [user?.uid]);

  useEffect(() => {
    if (messages.length > 0 || activePanel !== 'chat' || startingOptions) return;
    let revealTimeout: number | undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setWelcomePromptVisible(false);
        revealTimeout = window.setTimeout(() => {
          setWelcomePromptIndex((current) => (current + 1) % EMPTY_CHAT_PROMPTS.length);
          setWelcomePromptVisible(true);
        }, 180);
      }
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      if (revealTimeout !== undefined) window.clearTimeout(revealTimeout);
    };
  }, [activePanel, messages.length, startingOptions]);

  useEffect(() => {
    setSession(createInitialChatState(user?.uid || ''));
    setConversations([]);
    setProfile(null);
    setFavorites([]);
    setSelectedResults([]);
    setNotice('');
    setStartingOptions(null);
    setActivePanel('chat');
    setWelcomePromptVisible(true);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([getLocalChatConversations(user.uid), getLocalChatProfile(user.uid), getLocalFavorites(user.uid), getLocalChatUsage(user.uid), getLocalFavoriteDeletions(user.uid)])
      .then(async ([localRecent, localProfile, localFavorites, localUsage, deletedFavoriteIds]) => {
        if (!mounted) return;
        let recent = localRecent;
        let storedProfile = localProfile;
        let storedFavorites = localFavorites;
        let usage = localUsage;
        if (!localOnly && navigator.onLine) {
          try {
            const [cloudRecent, cloudProfile, cloudFavorites, cloudUsage] = await Promise.all([
              loadRecentConversations(user.uid), loadChatProfile(user.uid), loadFavorites(user.uid), loadChatUsage(user.uid),
            ]);
            if (!mounted) return;
            await Promise.all(deletedFavoriteIds.map((schoolId) => removeFavorite(user.uid, schoolId)));
            await Promise.all(deletedFavoriteIds.map((schoolId) => clearLocalFavoriteDeletion(user.uid, schoolId)));
            const cloudById = new Map(cloudRecent.map((item) => [item.id, item]));
            const byId = new Map(cloudRecent.map((item) => [item.id, item]));
            const localConversationsToUpload: ChatConversation[] = [];
            for (const conversation of localRecent) {
              const cloud = cloudById.get(conversation.id);
              if (!cloud || conversation.updatedAt > cloud.updatedAt) {
                byId.set(conversation.id, conversation);
                localConversationsToUpload.push(conversation);
              }
            }
            recent = Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
            storedProfile = !cloudProfile || (localProfile && localProfile.updatedAt > cloudProfile.updatedAt) ? localProfile : cloudProfile;
            const deleted = new Set(deletedFavoriteIds);
            const cloudFavoriteIds = new Set(cloudFavorites.map((item) => item.universityId));
            const favoritesBySchool = new Map([...cloudFavorites.filter((item) => !deleted.has(item.universityId)), ...localFavorites].map((item) => [item.universityId, item]));
            storedFavorites = Array.from(favoritesBySchool.values());
            usage = cloudUsage || localUsage;
            for (const conversation of [...localConversationsToUpload].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))) await saveConversation(user.uid, conversation);
            if (localProfile && (!cloudProfile || localProfile.updatedAt > cloudProfile.updatedAt)) await saveChatProfile(user.uid, localProfile);
            await Promise.all(localFavorites.filter((favorite) => !deleted.has(favorite.universityId) && !cloudFavoriteIds.has(favorite.universityId)).map((favorite) => saveFavorite(user.uid, favorite)));
            await Promise.all([
              ...recent.map((conversation) => saveLocalChatConversation(user.uid, conversation)),
              ...(storedProfile ? [saveLocalChatProfile(user.uid, storedProfile)] : []),
              ...storedFavorites.map((favorite) => saveLocalFavorite(user.uid, favorite)),
              ...(usage ? [saveLocalChatUsage(user.uid, usage)] : []),
            ]);
          } catch {
            if (mounted) setNotice('Cloud history could not sync. Your saved chat data is still available on this device.');
          }
        }
        if (!mounted) return;
        setConversations(recent);
        setProfile(storedProfile);
        setFavorites(storedFavorites);
        if (usage) {
          setSession((current) => ({
            ...current,
            queryCount: recent[0]?.queryCount || usage.queriesThisSession,
            queryTimestamps: usage.queryTimestamps.filter((timestamp) => Date.now() - timestamp < 60_000),
          }));
        }
        if (recent[0]) setStartingOptions({ resume: recent[0], recent });
      })
      .catch(async () => {
        if (!mounted) return;
        setNotice('Your saved chat data is unavailable on this device right now.');
      });
    return () => { mounted = false; };
  }, [user?.uid, localOnly]);

  useEffect(() => {
    if (!user || !cloudSyncRevision || localOnly || !navigator.onLine) return;
    let mounted = true;
    const current = { ...session, profile: profile || session.profile };
    const usage = {
      currentConversationId: current.conversation.id,
      queriesThisSession: current.conversation.queryCount || 0,
      queryTimestamps: current.queryTimestamps,
      updatedAt: new Date().toISOString(),
    };
    const writes: Promise<void>[] = [
      saveConversation(user.uid, current.conversation),
      saveChatProfile(user.uid, current.profile),
    ];
    const shouldSyncUsage = cloudUsageRevision > lastSyncedCloudUsageRevision.current;
    if (shouldSyncUsage) writes.push(saveChatUsage(user.uid, usage));
    Promise.all(writes).then(() => {
      if (shouldSyncUsage) lastSyncedCloudUsageRevision.current = cloudUsageRevision;
      if (mounted) setNotice((value) => value.startsWith('Cloud history could not sync') || value.startsWith('Chat saved on this device') ? '' : value);
    }).catch(() => {
      if (mounted) setNotice('Chat saved on this device. Cloud sync will retry when available.');
    });
    return () => { mounted = false; };
  }, [user?.uid, cloudSyncRevision, cloudUsageRevision, localOnly]);

  useEffect(() => {
    if (!user || updates.length === 0 || notice) return;
    const unread = updates.filter((item) => !item.isRead);
    if (unread.length > 0) setNotice(`${unread.length} update${unread.length === 1 ? '' : 's'} since your last visit: ${unread.slice(0, 3).map((item) => item.title).join('; ')}`);
  }, [user, updates, notice]);

  const unreadUpdates = updates.filter((item) => !item.isRead);
  const contextualSuggestions = useMemo(() => buildContextualSuggestions(session, rates, role), [session, rates, role]);
  const queryCompletions = useMemo(() => predictQueryCompletions(input, rates, role), [input, rates, role]);
  if (role === 'AGENT' && access.accessState !== 'approved') return <AgentAccessGate />;

  const pickConversation = (conversation: ChatConversation) => {
    setSession((current) => ({ ...current, conversation, queryCount: conversation.queryCount || 0 }));
    setStartingOptions(null);
    setActivePanel('chat');
    const lastResultsMessage = [...conversation.messages].reverse().find((message) => message.resultIds?.length);
    setSelectedResults(lastResultsMessage?.resultIds?.length
      ? rates.filter((rate) => lastResultsMessage.resultIds?.includes(rate.id))
      : []);
  };

  const startNewConversation = () => {
    setSession((current) => ({ ...createInitialChatState(user?.uid || ''), queryTimestamps: current.queryTimestamps, profile: profile || current.profile }));
    if (profile) setProfile((current) => current || profile);
    setSelectedResults([]);
    setStartingOptions(null);
    setActivePanel('chat');
    setInput('');
    setError('');
    setWelcomePromptVisible(true);
  };

  const sendMessage = async (event: React.FormEvent, messageInput = input) => {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError('');
    try {
      const currentSession = { ...session, profile: profile || session.profile };
      const greeting = isGreetingInput(messageInput);
      const now = Date.now();
      const result = greeting
        ? { state: processGreeting(currentSession, messageInput, new Date(now)), matchingRates: [] as CommissionRate[] }
        : processChatTurn(currentSession, messageInput, rates, now, role, dashboardFilters);
      const usage = {
        currentConversationId: result.state.conversation.id,
        queriesThisSession: result.state.conversation.queryCount || 0,
        queryTimestamps: result.state.queryTimestamps,
        updatedAt: new Date(now).toISOString(),
      };
      await Promise.all([
        saveLocalChatConversation(user.uid, result.state.conversation),
        saveLocalChatProfile(user.uid, result.state.profile),
        ...(!greeting ? [saveLocalChatUsage(user.uid, usage)] : []),
      ]);
      setSession(result.state);
      if (!greeting && 'dashboardFilters' in result && result.dashboardFilters) onDashboardFiltersChange?.(result.dashboardFilters);
      setConversations((current) => [result.state.conversation, ...current.filter((conversation) => conversation.id !== result.state.conversation.id)].slice(0, 5));
      setProfile(result.state.profile);
      setCloudSyncRevision((revision) => revision + 1);
      if (!greeting) setCloudUsageRevision((revision) => revision + 1);
      setInput('');
      if (result.matchingRates.length) {
        setSelectedResults(result.matchingRates);
        setVisibleResultCount(24);
        setActivePanel('chat');
      } else {
        setSelectedResults([]);
        setActivePanel('chat');
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send your question.');
    } finally {
      setBusy(false);
    }
  };

  const submitPrompt = (prompt: string) => {
    setInput(prompt);
    void sendMessage({ preventDefault: () => {} } as React.FormEvent, prompt);
  };

  const toggleFavorite = async (rate: CommissionRate) => {
    if (!user) return;
    setError('');
    try {
      const exists = favorites.some((item) => item.universityId === rate.universityId);
      if (exists) {
        await deleteLocalFavorite(user.uid, rate.universityId);
        if (!localOnly && navigator.onLine) void removeFavorite(user.uid, rate.universityId).catch(() => setNotice('Favorite removed here. Cloud sync will retry when available.'));
        setFavorites((current) => current.filter((item) => item.universityId !== rate.universityId));
        return;
      }
      const favorite: FavoriteSchool = { id: rate.universityId, universityId: rate.universityId, universityName: rate.universityName, createdAt: new Date().toISOString() };
      await saveLocalFavorite(user.uid, favorite);
      if (!localOnly && navigator.onLine) void saveFavorite(user.uid, favorite).catch(() => setNotice('Favorite saved here. Cloud sync will retry when available.'));
      setFavorites((current) => [...current, favorite]);
      const currentProfile = profile || session.profile;
      const nextProfile: AgentChatProfile = {
        ...currentProfile,
        frequentSchoolIds: {
          ...currentProfile.frequentSchoolIds,
          [rate.universityId]: (currentProfile.frequentSchoolIds[rate.universityId] || 0) + 1,
        },
        updatedAt: new Date().toISOString(),
      };
      if (nextProfile.queryCount >= 10) {
        const suggestion = `${rate.universityName} is one of your favorites. Ask for it with a level or intake to narrow the results.`;
        nextProfile.suggestionTerms = Array.from(new Set([...nextProfile.suggestionTerms, suggestion])).slice(-12);
      }
      setProfile(nextProfile);
      setSession((current) => ({ ...current, profile: nextProfile }));
      await saveLocalChatProfile(user.uid, nextProfile);
      setCloudSyncRevision((revision) => revision + 1);
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : 'Could not update your favorites.');
    }
  };

  const removeSavedFavorite = async (universityId: string) => {
    if (!user) return;
    try {
      await deleteLocalFavorite(user.uid, universityId);
      if (!localOnly && navigator.onLine) {
        try {
          await removeFavorite(user.uid, universityId);
          await clearLocalFavoriteDeletion(user.uid, universityId);
        } catch {
          setNotice('Favorite removed here. Cloud sync will retry when available.');
        }
      }
      setFavorites((items) => items.filter((item) => item.universityId !== universityId));
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : 'Could not remove this favorite.');
    }
  };

  const openUpdate = async (update: UserUpdate) => {
    setActivePanel('results');
    setSelectedResults(rates.filter((rate) => update.affectedSchoolIds?.includes(rate.universityId)));
    setVisibleResultCount(24);
    if (localOnly) return;
    if (!user || update.isRead) return;
    try {
      await markUpdateRead(user.uid, update.id);
      onUpdatesChange((current) => current.map((item) => item.id === update.id ? { ...item, isRead: true } : item));
      setNotice('');
    } catch (readError) {
      setError(readError instanceof Error ? `This update is still unread: ${readError.message}` : 'This update is still unread because it could not be marked read.');
    }
  };

  const openMessageResults = (message: ChatMessage, schoolId?: string) => {
    let matched = rates.filter((rate) => message.resultIds?.includes(rate.id));
    if (schoolId) matched = matched.filter((rate) => rate.universityId === schoolId);
    if (!matched.length && message.resultRates?.length) {
      matched = message.resultRates.map((r) => ({
        ...r,
        aggregator: r.aggregator || '',
        agentRate: r.agentRate || 0,
        masterRate: 0,
        diffMargin: 0,
        isFlatFee: r.isFlatFee || false,
        netOrGross: 'GROSS' as const,
      }));
      if (schoolId) matched = matched.filter((rate) => rate.universityId === schoolId);
    }
    if (!matched.length) return;
    setSelectedResults(matched);
    setVisibleResultCount(24);
    setActivePanel('results');
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openMessageSchoolResults = (message: ChatMessage) => {
    let matched = rates.filter((rate) => message.resultIds?.includes(rate.id));
    if (!matched.length && message.resultRates?.length) {
      matched = message.resultRates.map((r) => ({
        ...r,
        aggregator: r.aggregator || '',
        agentRate: r.agentRate || 0,
        masterRate: 0,
        diffMargin: 0,
        isFlatFee: r.isFlatFee || false,
        netOrGross: 'GROSS' as const,
      }));
    }
    if (!matched.length) return;
    const uniqueSchools = new Map<string, CommissionRate>();
    for (const rate of matched) {
      if (!uniqueSchools.has(rate.universityId)) uniqueSchools.set(rate.universityId, rate);
    }
    const schoolResults = Array.from(uniqueSchools.values());
    setSelectedResults(schoolResults);
    setVisibleResultCount(24);
    setActivePanel('results');
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const clearPreferences = async () => {
    if (!user) return;
    try {
      await deleteLocalChatProfile(user.uid);
      await saveLocalChatProfile(user.uid, createInitialChatState(user.uid).profile);
      if (!localOnly && navigator.onLine) void saveChatProfile(user.uid, createInitialChatState(user.uid).profile).catch(() => setNotice('Preferences reset here. Cloud sync will retry when available.'));
      const freshProfile = createInitialChatState(user.uid).profile;
      setProfile(freshProfile);
      setSession((current) => ({ ...current, profile: freshProfile }));
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear learned preferences.');
    }
  };

  const hasLearnedProfile = Boolean((profile?.queryCount || session.profile.queryCount) > 0);
  const lastSyncedAt = null;

  return (
    <div className="chat-experience">
      <section className="chat-surface">
        <header className="chat-header">
          <div className="min-w-0">
            <b className="block truncate">{session.conversation.title}</b>
            <p className="text-xs text-slate-500">{session.queryCount}/50 questions</p>
          </div>
          <div className="chat-header-actions">
            <button onClick={(event) => openUtilityPanel('favorites', event.currentTarget)} aria-expanded={utilityPanel === 'favorites'} aria-controls={utilityPanel ? 'chat-utility-panel' : undefined} aria-label={`Favorite schools, ${favorites.length}`} title="Favorite schools" className="chat-header-button"><Star className="h-4 w-4" /></button>
            <button onClick={(event) => openUtilityPanel('history', event.currentTarget)} aria-expanded={utilityPanel === 'history'} aria-controls={utilityPanel ? 'chat-utility-panel' : undefined} aria-label={`Chat history, ${conversations.length}`} title="Chat history" className="chat-header-button"><History className="h-4 w-4" /></button>
            <button onClick={(event) => openUtilityPanel('activity', event.currentTarget)} aria-expanded={utilityPanel === 'activity'} aria-controls={utilityPanel ? 'chat-utility-panel' : undefined} aria-label={`Activity, ${unreadUpdates.length} unread`} title="Activity" className="chat-header-button chat-activity-button">
              <Bell className="h-4 w-4" />
              {unreadUpdates.length > 0 && <span className="chat-unread-dot"></span>}
            </button>
            <button onClick={startNewConversation} aria-label="Start new chat" title="New chat" className="chat-header-button"><Plus className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="chat-transcript">
          {error && <div role="alert" className="chat-error">{error}</div>}
          {startingOptions && activePanel === 'chat' && messages.length === 0 && (
            <section className="chat-resume-card">
              <p className="font-bold">Welcome back. Continue where you stopped?</p>
              <p className="mt-1">{startingOptions.resume?.title} · {startingOptions.resume ? shortDate(startingOptions.resume.updatedAt) : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => startingOptions.resume && pickConversation(startingOptions.resume)} className="chat-primary-button">Continue chat</button>
                <button onClick={startNewConversation} className="chat-secondary-button">Start new</button>
              </div>
            </section>
          )}

          {activePanel === 'results' && (
            <section className="chat-results-list">
              <div className="mb-3 flex justify-between text-xs">
                <span>{selectedResults.length} results · {compareIds.length}/4 selected</span>
                <button disabled={compareIds.length < 2} onClick={() => { const selected = chooseComparableRates(selectedResults, compareIds, session.conversation.activeLevel); if (!canCompareSelectedRates(selected, role)) setCompareNotice(role === 'STAFF' ? 'Choose schools with the same intake and study level before comparing.' : 'Choose schools with the same intake, study level, and fee type before comparing. Percentage and flat fee payouts cannot be compared directly.'); else { setCompareNotice(''); setShowCompare(true); } }} className="chat-primary-button" style={{ minHeight: 38 }}>Compare selected</button>
              </div>
              {compareNotice && <p role="status" className="mb-3 rounded-lg border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-100">{compareNotice}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedResults.slice(0, visibleResultCount).map((rate) => (
                  <RateResultCard key={rate.id} rate={rate} role={role} favorite={favorites.some((item) => item.universityId === rate.universityId)} selected={compareIds.includes(rate.universityId)} onFavorite={() => void toggleFavorite(rate)} onCompare={() => { setCompareIds((current) => { if (current.includes(rate.universityId)) return current.filter((id) => id !== rate.universityId); if (current.length >= 4) { setCompareNotice('You can compare up to four schools at a time.'); return current; } setCompareNotice(''); return [...current, rate.universityId]; }); }} />
                ))}
              </div>
              {visibleResultCount < selectedResults.length && <button onClick={() => setVisibleResultCount((count) => count + 24)} className="chat-secondary-button mt-4">Show more results</button>}
            </section>
          )}

          {messages.length === 0 && activePanel === 'chat' && !startingOptions && (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 px-3 text-center" aria-live="off">
              <p className={`text-lg font-semibold text-slate-600 transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none dark:text-slate-300 ${welcomePromptVisible ? 'opacity-100' : 'opacity-0'}`}>{EMPTY_CHAT_PROMPTS[welcomePromptIndex]}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Loading your available routes…' : rates.length === 0 ? 'No routes are currently available for your account.' : `Choose from ${rates.length.toLocaleString()} routes across ${availableSchoolCount.toLocaleString()} schools.`}</p>
              <div className="mt-2 flex max-w-2xl flex-wrap justify-center gap-2">
                {contextualSuggestions.map((suggestion) => <button key={suggestion.label} onClick={() => submitPrompt(suggestion.prompt)} className="chat-suggestion-button">{suggestion.label}</button>)}
              </div>
              {hasLearnedProfile && <button onClick={() => void clearPreferences()} className="min-h-11 text-xs text-slate-400 underline">Clear learned preferences</button>}
            </div>
          )}

          {messages.map((message) => (
            <React.Fragment key={message.id}>
              <ChatBubble message={message} onContinue={submitPrompt} />
              {message.role === 'assistant' && Boolean(message.resultRates?.length) && (
                <InlineResultPreview message={message} role={role} favorites={favorites} onFavorite={(rate) => void toggleFavorite(rate)} onOpen={() => openMessageResults(message)} onOpenSchool={(schoolId) => openMessageResults(message, schoolId)} onOpenSchools={() => openMessageSchoolResults(message)} onViewDashboard={onViewDashboard} />
              )}
            </React.Fragment>
          ))}

          {messages.length > 0 && (
            <div className="flex flex-wrap gap-2 py-1" aria-label="Suggested follow-up questions">
              {contextualSuggestions.map((suggestion) => <button key={suggestion.label} onClick={() => submitPrompt(suggestion.prompt)} className="chat-suggestion-button">{suggestion.label}</button>)}
            </div>
          )}
        </div>

        <div className="chat-composer">
          <ChatComposer inputRef={composerRef} value={input} onChange={setInput} onSubmit={sendMessage} busy={busy || loading} placeholder="Type your question…" completions={queryCompletions} onChooseCompletion={(completion) => setInput(completion)} />
        </div>
      </section>

      {renderedUtilityPanel && (
        <div className={`chat-utility-backdrop${utilityPanelOpen ? ' is-open' : ''}`} onClick={(event) => { if (event.target === event.currentTarget && utilityPanel) closeUtilityPanel(); }}>
          <section
            ref={utilityPanelRef}
            id="chat-utility-panel"
            className="chat-utility-dialog"
            role="dialog"
            aria-modal={utilityPanel ? true : undefined}
            aria-hidden={utilityPanel ? undefined : true}
            aria-label={renderedUtilityPanel === 'history' ? 'Chat history' : renderedUtilityPanel === 'favorites' ? 'Favorite schools' : 'Activity'}
            tabIndex={-1}
            inert={!utilityPanel}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="chat-utility-toolbar">
              <div><p className="chat-utility-eyebrow">Your workspace</p><h2>{renderedUtilityPanel === 'history' ? 'Chat history' : renderedUtilityPanel === 'favorites' ? 'Favorite schools' : 'Activity'}</h2></div>
              <button ref={utilityCloseButtonRef} type="button" className="chat-header-button" onClick={closeUtilityPanel} aria-label={`Close ${renderedUtilityPanel === 'history' ? 'chat history' : renderedUtilityPanel === 'favorites' ? 'favorite schools' : 'activity'}`}><X aria-hidden="true" /></button>
            </header>
            <div className="chat-utility-body">
              <ChatUtilityPanel
                panel={renderedUtilityPanel}
                conversations={conversations}
                favorites={favorites}
                updates={updates}
                notice={notice}
                localOnly={localOnly}
                localOnlyMessage={localOnlyMessage}
                lastSyncedAt={lastSyncedAt || null}
                onSelectConversation={(conversation) => { closeUtilityPanel(); pickConversation(conversation); }}
                onNewConversation={() => { closeUtilityPanel(); startNewConversation(); }}
                onSearchFavorite={(schoolName) => { closeUtilityPanel(); setInput(`Show me ${schoolName}`); setActivePanel('chat'); }}
                onRemoveFavorite={(universityId) => void removeSavedFavorite(universityId)}
                onOpenUpdate={(update) => { closeUtilityPanel(); void openUpdate(update); }}
                onDismissNotice={() => setNotice('')}
              />
            </div>
          </section>
        </div>
      )}

      {showCompare && <CompareMatrix rates={chooseComparableRates(selectedResults, compareIds, session.conversation.activeLevel)} role={role} onClose={() => setShowCompare(false)} />}
    </div>
  );
};

const ChatBubble: React.FC<{ message: ChatMessage; onContinue: (reply: string) => void }> = ({ message, onContinue }) => (
  <div className={`chat-message ${message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`}>
    <p className="whitespace-pre-wrap">{message.text}</p>

    {/* Staged Command Confirmation Box */}
    {Boolean(message.role === 'assistant' && message.stagedCommand) && (
      <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-900 dark:text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Confirm Administrative Action</span>
        </div>
        <p className="font-medium leading-relaxed">{message.stagedCommand?.description}</p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onContinue(`CONFIRM_STAGED_${message.stagedCommand?.id}`)}
            className="px-3 py-1.5 bg-amber-500 text-slate-950 font-extrabold rounded-xl hover:bg-amber-400 transition cursor-pointer shadow-xs"
          >
            Proceed & Execute
          </button>
          <button
            onClick={() => onContinue('CANCEL_STAGED')}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )}

    {/* Clarification Choices */}
    {Boolean(message.status === 'clarifying' && message.role === 'assistant' && message.clarification?.choices.length) && (
      <div className="mt-2 flex flex-wrap gap-2">
        {message.clarification?.choices.map(({ label, value }) => (
          <button key={`${label}-${value}`} onClick={() => onContinue(value)} className="chat-suggestion-button">
            {label}
          </button>
        ))}
      </div>
    )}

    {/* Follow up result filter */}
    {Boolean(message.role === 'assistant' && message.followUpFilter) && (
      <div className="mt-2" aria-label="Available result filters">
        <p className="mb-2 text-xs text-slate-400">{message.followUpFilter?.question}</p>
        <div className="flex flex-wrap gap-2">
          {message.followUpFilter?.choices.map(({ label, value }) => (
            <button key={`${label}-${value}`} onClick={() => onContinue(value)} className="chat-suggestion-button">
              {label}
            </button>
          ))}
        </div>
      </div>
    )}

    <p className="mt-1 text-[10px] text-slate-400">
      {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
    </p>
  </div>
);

const InlineResultPreview: React.FC<{ message: ChatMessage; role: 'STAFF' | 'AGENT' | 'ADMIN'; favorites: FavoriteSchool[]; onFavorite: (rate: CommissionRate) => void; onOpen: () => void; onOpenSchool: (schoolId: string) => void; onOpenSchools: () => void; onViewDashboard?: () => void }> = ({ message, role, favorites, onFavorite, onOpen, onOpenSchool, onOpenSchools, onViewDashboard }) => {
  const results = message.resultRates || [];
  const schoolCount = new Set(results.map((rate) => rate.universityId)).size;
  return (
    <section aria-label="Search results preview" className="chat-result-preview">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onOpenSchools} aria-label={`Open results for ${schoolCount} unique schools`} className="text-left text-xs font-bold text-slate-700 underline decoration-slate-400 underline-offset-2 dark:text-slate-100">{schoolCount} unique schools</button>
          <button type="button" onClick={onOpen} aria-label={`Open all ${results.length} matching routes`} className="text-left text-xs font-bold text-slate-700 underline decoration-slate-400 underline-offset-2 dark:text-slate-100">{results.length} matching routes</button>
        </div>
        <div className="flex gap-2">
          {onViewDashboard ? (
            <button onClick={onViewDashboard} className="chat-primary-button" style={{ minHeight: 36, padding: '0 12px', fontSize: 11 }}>View on dashboard</button>
          ) : (
            <button onClick={onOpen} className="chat-primary-button" style={{ minHeight: 36, padding: '0 12px', fontSize: 11 }}>View on dashboard</button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{results.slice(0, 4).map((partial) => {
        const rate = { ...partial, aggregator: partial.aggregator || '', agentRate: partial.agentRate || 0, masterRate: 0, diffMargin: 0, isFlatFee: partial.isFlatFee || false, netOrGross: 'GROSS' as const };
        const favorite = favorites.some((item) => item.universityId === rate.universityId);
        return <article key={rate.id} className="chat-result-card flex items-start justify-between gap-2"><button onClick={() => onOpenSchool(rate.universityId)} aria-label={`Open ${rate.universityName} results`} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{rate.universityName}</b><span className="mt-1 block text-[10px] text-slate-400">{rate.intake} · {rate.studyLevel}{role !== 'AGENT' && rate.aggregator ? ` · ${rate.aggregator}` : ''}</span><span className="mt-2 inline-block rounded-full bg-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-100">{rate.guidance || 'ALLOWED'}</span>{role !== 'STAFF' && typeof rate.agentRate === 'number' && <span className="mt-2 block text-xs font-black text-emerald-400">{rate.isFlatFee ? `£${rate.agentRate}` : `${rate.agentRate}%`}</span>}</button><button onClick={() => onFavorite(rate)} aria-label={`${favorite ? 'Remove' : 'Add'} ${rate.universityName} ${favorite ? 'from' : 'to'} favorites`} className={`rounded-lg p-1.5 ${favorite ? 'text-rose-400' : 'text-slate-400 hover:text-rose-300'}`}><Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /></button></article>;
      })}</div>
    </section>
  );
};

const RateResultCard: React.FC<{ rate: CommissionRate; role: 'STAFF' | 'AGENT' | 'ADMIN'; favorite: boolean; onFavorite: () => void; onCompare?: () => void; selected?: boolean; readOnly?: boolean }> = ({ rate, role, favorite, onFavorite, onCompare, selected, readOnly = false }) => <article className={`chat-route-card ${selected ? 'is-selected' : ''}`}><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-extrabold leading-snug">{rate.universityName}</h3><p className="mt-1 text-[11px] text-slate-400">{rate.intake} · {rate.studyLevel}{role !== 'AGENT' && rate.aggregator ? ` · ${rate.aggregator}` : ''}</p></div><div className="flex"><button onClick={onCompare} aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Select'} ${rate.universityName} ${selected ? 'for' : 'from'} comparison`} className={`rounded-lg p-1.5 ${selected ? 'text-blue-300' : 'text-slate-400 hover:text-blue-300'}`}><Check className="h-4 w-4" /></button><button disabled={readOnly} onClick={onFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${rate.universityName} ${favorite ? 'from' : 'to'} favorites`} className={`rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${favorite ? 'text-rose-400' : 'text-slate-400 hover:text-rose-300'}`}><Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /></button></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${rate.guidance === 'FOCUS' ? 'bg-emerald-900/60 text-emerald-200' : rate.guidance === 'DO_NOT_USE' ? 'bg-rose-950 text-rose-200' : 'bg-slate-700 text-slate-100'}`}>{rate.guidance || 'ALLOWED'}</span>{role !== 'STAFF' && typeof rate.agentRate === 'number' && <span className="text-sm font-black text-emerald-400">{rate.isFlatFee ? `£${rate.agentRate}` : `${rate.agentRate}%`}</span>}</div></article>;

const CompareMatrix: React.FC<{ rates: CommissionRate[]; role: 'STAFF' | 'AGENT' | 'ADMIN'; onClose: () => void }> = ({ rates, role, onClose }) => {
  const compatible = rates.length > 0 && rates.every((rate) => rate.intake === rates[0].intake && rate.studyLevel === rates[0].studyLevel);
  const payoutLabel = (rate: CommissionRate) => role === 'STAFF' || typeof rate.agentRate !== 'number' ? 'Unavailable' : `${rate.isFlatFee ? '£' : ''}${rate.agentRate}${rate.isFlatFee ? '' : '%'}`;
  const routingLabel = (rate: CommissionRate) => role === 'AGENT' ? 'Unavailable' : rate.aggregator || 'Unavailable';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-label="School comparison" className="chat-compare-dialog max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-extrabold">Compare schools</h2><p className="text-xs text-slate-400">{rates.length} of up to 4 schools</p></div><button onClick={onClose} aria-label="Close comparison" className="chat-header-button"><X className="h-4 w-4" /></button></div>{!compatible ? <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">Select schools with the same intake and study level to compare them fairly.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead><tr><th className="p-3">Field</th>{rates.map((rate) => <th key={rate.id} className="p-3">{rate.universityName}</th>)}</tr></thead><tbody>{[['Intake', (r: CommissionRate) => r.intake], ['Study level', (r: CommissionRate) => r.studyLevel], ['Guidance', (r: CommissionRate) => r.guidance || 'ALLOWED'], ['Payout', payoutLabel], ['Routing', routingLabel]].map(([label, get]) => <tr key={label as string} className="border-t border-slate-700"><th className="p-3 text-xs text-slate-400">{label as string}</th>{rates.map((rate) => <td key={rate.id} className="p-3 font-semibold">{(get as (rate: CommissionRate) => string)(rate)}</td>)}</tr>)}</tbody></table></div>}</section></div>;
};

const ChatComposer: React.FC<{ value: string; onChange: (value: string) => void; onSubmit: (event: React.FormEvent) => void; busy: boolean; placeholder: string; completions: Array<{ label: string; completion: string }>; onChooseCompletion: (completion: string) => void; inputRef?: React.Ref<HTMLTextAreaElement> }> = ({ value, onChange, onSubmit, busy, placeholder, completions, onChooseCompletion, inputRef }) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (value.trim() && !busy) {
        onSubmit(event as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="chat-composer-form">
      <div className="chat-composer-row">
        <textarea
          ref={inputRef}
          value={value}
          maxLength={500}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Your message"
          placeholder={placeholder}
          rows={2}
          className="chat-composer-input"
        />
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-slate-400">{value.length}/500</span>
          <button type="submit" disabled={!value.trim() || busy} aria-label={busy ? 'Sending message' : 'Send message'} className="chat-send-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Send</span>
          </button>
        </div>
      </div>
      {completions.length > 0 && (
        <div className="chat-suggestions" aria-label="Suggested query completions">
          <span className="text-[10px] text-slate-400">Suggestions</span>
          {completions.map(({ label, completion }) => (
            <button key={completion} type="button" onClick={() => onChooseCompletion(completion)} className="chat-suggestion-button">
              {label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
};
