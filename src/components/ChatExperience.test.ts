import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import type { CommissionRate } from '../types';
import { canCompareSelectedRates, selectSchoolResultRates } from './ChatExperience';
const mocks = vi.hoisted(() => ({
  loadChatProfile: vi.fn(),
  loadFavorites: vi.fn(),
  loadRecentConversations: vi.fn(),
  loadChatUsage: vi.fn(),
  saveConversation: vi.fn(),
  saveChatProfile: vi.fn(),
  saveChatUsage: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  useAuth: vi.fn(),
  saveLocalChatConversation: vi.fn(),
  saveLocalChatProfile: vi.fn(),
  saveLocalChatUsage: vi.fn(),
  saveLocalFavorite: vi.fn(),
  getLocalChatConversations: vi.fn(),
  getLocalFavoriteDeletions: vi.fn(),
  clearLocalFavoriteDeletion: vi.fn(),
  getLocalChatProfile: vi.fn(),
  getLocalChatUsage: vi.fn(),
  getLocalFavorites: vi.fn(),
  deleteLocalFavorite: vi.fn(),
  isQuotaOffline: vi.fn(),
  subscribeToFirestoreMode: vi.fn(),
  firestoreModeHandler: null as null | ((uid?: string) => void),
}));

vi.mock('../context/AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('../services/chatPersistence', () => ({
  MAX_QUERIES_PER_SESSION: 50,
  MAX_QUERIES_PER_MINUTE: 10,
  PREFERENCE_LEARNING_THRESHOLD: 10,
  loadChatProfile: mocks.loadChatProfile,
  loadFavorites: mocks.loadFavorites,
  loadRecentConversations: mocks.loadRecentConversations,
  loadChatUsage: mocks.loadChatUsage,
  saveConversation: mocks.saveConversation,
  saveChatProfile: mocks.saveChatProfile,
  saveChatUsage: mocks.saveChatUsage,
  clearChatProfile: vi.fn(),
  markUpdateRead: vi.fn(),
  removeFavorite: mocks.removeFavorite,
  saveFavorite: mocks.saveFavorite,
}));

vi.mock('./AgentAccessGate', () => ({ AgentAccessGate: () => null }));
vi.mock('../services/localRateDatabase', () => ({
  saveLocalChatConversation: mocks.saveLocalChatConversation,
  saveLocalChatProfile: mocks.saveLocalChatProfile,
  saveLocalChatUsage: mocks.saveLocalChatUsage,
  saveLocalFavorite: mocks.saveLocalFavorite,
  getLocalChatConversations: mocks.getLocalChatConversations,
  getLocalFavoriteDeletions: mocks.getLocalFavoriteDeletions,
  clearLocalFavoriteDeletion: mocks.clearLocalFavoriteDeletion,
  getLocalChatProfile: mocks.getLocalChatProfile,
  getLocalChatUsage: mocks.getLocalChatUsage,
  getLocalFavorites: mocks.getLocalFavorites,
  deleteLocalFavorite: mocks.deleteLocalFavorite,
}));
vi.mock('../services/firestoreOfflineMode', () => ({
  isQuotaOffline: mocks.isQuotaOffline,
  subscribeToFirestoreMode: mocks.subscribeToFirestoreMode,
}));

import { ChatExperience } from './ChatExperience';

const rate = (overrides: Partial<CommissionRate> = {}): CommissionRate => ({
  id: 'rate', universityId: 'uni', universityName: 'Example University', intake: 'Jan 2027',
  studyLevel: 'PG', aggregator: '', masterRate: 0, agentRate: 12, diffMargin: 0,
  isFlatFee: false, netOrGross: 'GROSS', ...overrides,
});

describe('chat result comparisons', () => {
  it('allows matching Agent percentage rates and Staff routes', () => {
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', universityId: 'two' })], 'AGENT')).toBe(true);
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', universityId: 'two' })], 'STAFF')).toBe(true);
  });

  it('rejects mixed intake, level, flat fee and percentage comparisons', () => {
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', intake: 'Sept 2027' })], 'AGENT')).toBe(false);
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', studyLevel: 'UG' })], 'AGENT')).toBe(false);
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', isFlatFee: true })], 'AGENT')).toBe(false);
    expect(canCompareSelectedRates([rate(), rate({ id: 'two', netOrGross: 'NET' })], 'AGENT')).toBe(false);
  });

  it('limits compare groups to two through four schools', () => {
    expect(canCompareSelectedRates([rate()], 'STAFF')).toBe(false);
    expect(canCompareSelectedRates(Array.from({ length: 5 }, (_, i) => rate({ id: String(i), universityId: String(i) })), 'STAFF')).toBe(false);
  });
});

describe('chat search results flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: { uid: 'agent-1' },
      access: { role: 'AGENT', accessState: 'approved' },
    });
    mocks.loadChatProfile.mockResolvedValue(null);
    mocks.loadFavorites.mockResolvedValue([]);
    mocks.loadRecentConversations.mockResolvedValue([]);
    mocks.loadChatUsage.mockResolvedValue(null);
    mocks.saveConversation.mockResolvedValue(undefined);
    mocks.saveChatProfile.mockResolvedValue(undefined);
    mocks.saveChatUsage.mockResolvedValue(undefined);
    mocks.saveFavorite.mockResolvedValue(undefined);
    mocks.removeFavorite.mockResolvedValue(undefined);
    mocks.saveLocalChatConversation.mockResolvedValue(undefined);
    mocks.saveLocalChatProfile.mockResolvedValue(undefined);
    mocks.saveLocalChatUsage.mockResolvedValue(undefined);
    mocks.saveLocalFavorite.mockResolvedValue(undefined);
    mocks.getLocalChatConversations.mockResolvedValue([]);
    mocks.getLocalFavoriteDeletions.mockResolvedValue([]);
    mocks.clearLocalFavoriteDeletion.mockResolvedValue(undefined);
    mocks.getLocalChatProfile.mockResolvedValue(null);
    mocks.getLocalChatUsage.mockResolvedValue(null);
    mocks.getLocalFavorites.mockResolvedValue([]);
    mocks.isQuotaOffline.mockReturnValue(false);
    mocks.firestoreModeHandler = null;
    mocks.subscribeToFirestoreMode.mockImplementation((callback) => {
      mocks.firestoreModeHandler = callback;
      return () => {};
    });
  });

  it('shows an inline preview first and opens the full results only on request', async () => {
    render(React.createElement(ChatExperience, {
      rates: [rate({ id: 'aberdeen-pg', universityName: 'University of Aberdeen' })],
      loading: false,
      role: 'AGENT',
      updates: [],
      onUpdatesChange: vi.fn(),
      onViewDashboard: vi.fn(),
    }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), {
      target: { value: 'Show me University of Aberdeen postgraduate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('button', { name: 'View on dashboard' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Compare selected' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /1 matching route/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Compare selected' })).toBeTruthy());
  });

  it('triggers send when pressing Enter on PC without Shift', async () => {
    render(React.createElement(ChatExperience, {
      rates: [rate({ id: 'aberdeen-pg', universityName: 'University of Aberdeen' })],
      loading: false,
      role: 'AGENT',
      updates: [],
      onUpdatesChange: vi.fn(),
      onViewDashboard: vi.fn(),
    }));

    const composer = screen.getByRole('textbox', { name: 'Your message' });
    fireEvent.change(composer, { target: { value: 'Show me University of Aberdeen postgraduate' } });
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByRole('button', { name: 'View on dashboard' })).toBeTruthy();
  });

  it('renders the next available filter prompt with choices under the result message', async () => {
    const scopedRates = [
      rate({ id: 'uk-a', universityId: 'uk-a', universityName: 'A University', country: 'UK', intake: 'Jan 2027' }),
      rate({ id: 'uk-b', universityId: 'uk-b', universityName: 'B University', country: 'UK', intake: 'Sept 2027' }),
    ];
    render(React.createElement(ChatExperience, { rates: scopedRates, loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn() }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), { target: { value: 'show schools in UK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Would you like to narrow these results to a specific intake?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jan 2027' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sept 2027' })).toBeTruthy();
  });

  it('opens scoped school results and focuses the chat composer when the school total is clicked', async () => {
    const scopedRates = [
      rate({ id: 'uk-a-pg', universityId: 'uk-a', universityName: 'A University', country: 'UK', intake: 'Jan 2027' }),
      rate({ id: 'uk-a-ug', universityId: 'uk-a', universityName: 'A University', country: 'UK', intake: 'Jan 2027', studyLevel: 'UG' }),
      rate({ id: 'uk-b-pg', universityId: 'uk-b', universityName: 'B University', country: 'UK', intake: 'Sept 2027' }),
    ];
    render(React.createElement(ChatExperience, { rates: scopedRates, loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn() }));
    const composer = screen.getByRole('textbox', { name: 'Your message' });
    fireEvent.change(composer, { target: { value: 'show schools in UK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const schoolTotal = await screen.findByRole('button', { name: /2 unique schools/i });
    fireEvent.change(composer, { target: { value: 'keep this filter draft' } });
    fireEvent.click(schoolTotal);
    expect(await screen.findByText(/2 results · 0\/4 selected/)).toBeTruthy();
    const resultPanel = document.querySelector('.chat-results-list') as HTMLElement;
    expect(within(resultPanel).getAllByText('A University')).toHaveLength(1);
    expect(within(resultPanel).getAllByText('B University')).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(composer));
    expect(composer).toHaveValue('keep this filter draft');
  });

  it('opens scoped route results and focuses the chat composer when the route total is clicked', async () => {
    const scopedRates = [
      rate({ id: 'uk-a-pg', universityId: 'uk-a', universityName: 'A University', country: 'UK', intake: 'Jan 2027' }),
      rate({ id: 'uk-a-ug', universityId: 'uk-a', universityName: 'A University', country: 'UK', intake: 'Jan 2027', studyLevel: 'UG' }),
      rate({ id: 'uk-b-pg', universityId: 'uk-b', universityName: 'B University', country: 'UK', intake: 'Sept 2027' }),
    ];
    render(React.createElement(ChatExperience, { rates: scopedRates, loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn() }));
    const composer = screen.getByRole('textbox', { name: 'Your message' });
    fireEvent.change(composer, { target: { value: 'show schools in UK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    const routeTotal = await screen.findByRole('button', { name: /3 matching routes/i });
    fireEvent.change(composer, { target: { value: 'keep this other draft' } });
    fireEvent.click(routeTotal);
    expect(await screen.findByText(/3 results · 0\/4 selected/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(composer));
    expect(composer).toHaveValue('keep this other draft');
  });

  it('syncs locally saved conversations to the account and honors offline favorite deletions', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const favorite = { id: 'uni', universityId: 'uni', universityName: 'Example University', createdAt: '2026-10-09T10:00:00.000Z' };
    const localConversation = {
      id: 'offline-conversation', title: 'Example University', createdAt: '2026-10-09T10:00:00.000Z',
      updatedAt: '2026-10-09T11:00:00.000Z', messages: [], queryCount: 1,
    };
    mocks.getLocalChatConversations.mockResolvedValue([localConversation]);
    mocks.getLocalFavoriteDeletions.mockResolvedValue(['uni']);
    mocks.loadFavorites.mockResolvedValue([favorite]);
    render(React.createElement(ChatExperience, {
      rates: [rate()], loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn(),
    }));
    await waitFor(() => {
      expect(mocks.saveConversation).toHaveBeenCalledWith('agent-1', localConversation);
      expect(mocks.removeFavorite).toHaveBeenCalledWith('agent-1', 'uni');
      expect(mocks.clearLocalFavoriteDeletion).toHaveBeenCalledWith('agent-1', 'uni');
    });
  });

  it('lets a preview school card open only that school’s routes', () => {
    const schoolRates = [rate({ universityId: 'school-a' }), rate({ id: 'other', universityId: 'school-b' })];
    expect(selectSchoolResultRates(schoolRates, 'school-a').map((item) => item.id)).toEqual(['rate']);
  });

  it('warns when results are being served from a stale cached rate snapshot', () => {
    render(React.createElement(ChatExperience, {
      rates: [rate()],
      loading: false,
      role: 'AGENT',
      updates: [],
      onUpdatesChange: vi.fn(),
      dataMayBeStale: true,
    }));

    fireEvent.click(screen.getByRole('button', { name: /Activity/ }));
    expect(screen.getByText(/using saved school data/i)).toBeTruthy();
  });

  it('warns after Firestore switches to quota offline mode with a local copy', async () => {
    mocks.isQuotaOffline.mockReturnValue(false);
    render(React.createElement(ChatExperience, {
      rates: [rate()], loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn(),
    }));
    mocks.isQuotaOffline.mockReturnValue(true);
    const { act } = await import('@testing-library/react');
    act(() => mocks.firestoreModeHandler?.('agent-1'));

    fireEvent.click(screen.getByRole('button', { name: /Activity/ }));
    const activity = within(await screen.findByRole('dialog', { name: 'Activity' }));
    expect(activity.getByText(/quota limit reached/i)).toBeTruthy();
    expect(activity.getByText(/saved school data/i)).toBeTruthy();
  });

  it('keeps the draft in place while history opens and restores focus after Escape', async () => {
    render(React.createElement(ChatExperience, {
      rates: [rate()], loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn(),
    }));

    const composer = screen.getByRole('textbox', { name: 'Your message' });
    fireEvent.change(composer, { target: { value: 'Compare routes in Canada' } });
    const historyButton = screen.getByRole('button', { name: /Chat history/ });
    fireEvent.click(historyButton);

    const historyDialog = await screen.findByRole('dialog', { name: 'Chat history' });
    expect(historyDialog).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveValue('Compare routes in Canada');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chat history' })).toBeNull());
    expect(historyButton).toHaveFocus();

    fireEvent.click(historyButton);
    await screen.findByRole('dialog', { name: 'Chat history' });
    fireEvent.click(document.querySelector('.chat-utility-backdrop')!);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chat history' })).toBeNull());
    expect(historyButton).toHaveFocus();
  });

  it('searches a saved favorite from the Favorites overlay without replacing chat', async () => {
    const favorite = { id: 'uni', universityId: 'uni', universityName: 'Example University', createdAt: '2026-10-09T10:00:00.000Z' };
    mocks.getLocalFavorites.mockResolvedValue([favorite]);
    render(React.createElement(ChatExperience, {
      rates: [rate()], loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn(),
    }));

    const favoritesButton = screen.getByRole('button', { name: /Favorite schools/ });
    fireEvent.click(favoritesButton);
    const favoritesDialog = await screen.findByRole('dialog', { name: 'Favorite schools' });
    fireEvent.click(within(favoritesDialog).getByRole('button', { name: 'Search Example University' }));

    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveValue('Show me Example University');
    expect(screen.queryByRole('dialog', { name: 'Favorite schools' })).toBeNull();
  });

  it('opens an Activity item into chat results and closes the overlay', async () => {
    const activity = {
      id: 'update-1', title: 'Commission rates changed', summary: 'One school has updated rates.',
      type: 'rates' as const, createdAt: '2026-10-09T10:00:00.000Z', isRead: false, affectedSchoolIds: ['uni'],
    };
    render(React.createElement(ChatExperience, {
      rates: [rate()], loading: false, role: 'AGENT', updates: [activity], onUpdatesChange: vi.fn(),
    }));

    fireEvent.click(screen.getByRole('button', { name: /Activity/ }));
    const activityDialog = await screen.findByRole('dialog', { name: 'Activity' });
    fireEvent.click(within(activityDialog).getByRole('button', { name: /Commission rates changed/ }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Activity' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Compare selected' })).toBeTruthy();
  });
});

describe('dashboard filter handoff', () => {
  it('applies only resolved Chat searches to the controlled dashboard filters', async () => {
    const onDashboardFiltersChange = vi.fn();
    render(React.createElement(ChatExperience, { rates: [rate({ id: 'aberdeen-pg', universityName: 'University of Aberdeen' })], loading: false, role: 'AGENT', updates: [], onUpdatesChange: vi.fn(), dashboardFilters: { query: '', schoolIds: [], countries: [], levels: [], intakes: [], guidances: [], aggregators: [] }, onDashboardFiltersChange, onViewDashboard: vi.fn() }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your message' }), { target: { value: 'Show me University of Aberdeen postgraduate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(onDashboardFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ schoolIds: ['uni'], levels: ['PG'] })));
    expect(await screen.findByRole('button', { name: 'View on dashboard' })).toBeInTheDocument();
  });
});

