import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'STAFF' as 'ADMIN' | 'STAFF' | 'AGENT', accessState: 'staff' as string, quotaMode: false, rates: [] as any[] }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user-1', email: 'test@example.com' }, role: mocks.role, access: { role: mocks.role, accessState: mocks.accessState, organizationId: 'org-1' }, signOut: vi.fn() }) }));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('../hooks/useCommissionRates', () => ({ useCommissionRates: () => ({ rates: mocks.rates, loading: false, error: null, quotaMode: mocks.quotaMode, hasLocalCopy: mocks.rates.length > 0, lastSyncedAt: null }) }));
vi.mock('../services/firestoreOfflineMode', () => ({ isQuotaOffline: () => false, subscribeToFirestoreMode: () => () => {} }));
vi.mock('../services/chatPersistence', () => ({ markUpdateRead: vi.fn(), subscribeToUserUpdates: () => () => {} }));
vi.mock('../services/rateReadModels', () => ({ ensureRoleRateModelMigration: vi.fn(), ensureSheetVisibilityRecords: vi.fn() }));
vi.mock('./DashboardView', () => ({ DashboardView: () => <div data-testid="admin-dashboard">Admin dashboard</div> }));
vi.mock('./RoleDashboardView', () => ({ RoleDashboardView: ({ role, rates, filters }: { role: string; rates: any[]; filters: { query: string } }) => <div data-testid="role-dashboard">{role} dashboard ({rates.length} routes; query={filters.query})</div> }));
vi.mock('./ChatExperience', () => ({ ChatExperience: ({ rates, dataMayBeStale, onDashboardFiltersChange }: { rates: any[]; dataMayBeStale?: boolean; onDashboardFiltersChange: (filters: any) => void }) => <div data-testid="chat-data">Chat contents ({rates.length} routes; stale={String(dataMayBeStale)})<button onClick={() => onDashboardFiltersChange({ query: 'private', schoolIds: [], countries: [], levels: [], intakes: [], guidances: [], aggregators: [] })}>Set filter</button></div> }));
vi.mock('./Sidebar', () => ({ Sidebar: () => <nav data-testid="admin-navigation">Admin navigation</nav> }));
vi.mock('./SheetView', () => ({ SheetView: () => <div /> }));
vi.mock('./CompareView', () => ({ CompareView: () => <div /> }));
vi.mock('./UserManagementView', () => ({ UserManagementView: () => <div /> }));
vi.mock('./DealCalculatorView', () => ({ DealCalculatorView: () => <div /> }));
vi.mock('./AgentAccessGate', () => ({ AgentAccessGate: () => <div>Agent access gate</div> }));
vi.mock('./AddRateModal', () => ({ AddRateModal: () => null }));
vi.mock('./EditRateModal', () => ({ EditRateModal: () => null }));
vi.mock('./ExcelUploadModal', () => ({ ExcelUploadModal: () => null }));
vi.mock('./DeleteAllModal', () => ({ DeleteAllModal: () => null }));
vi.mock('./MigrateIntakeModal', () => ({ MigrateIntakeModal: () => null }));
vi.mock('./LegalModal', () => ({ LegalModal: () => null }));
vi.mock('./CommandPaletteModal', () => ({ CommandPaletteModal: () => null }));
vi.mock('./AuditLogsDrawer', () => ({ AuditLogsDrawer: () => null }));
vi.mock('./SheetVisibilityModal', () => ({ SheetVisibilityModal: () => null }));
vi.mock('./UserTutorialModal', () => ({ UserTutorialModal: () => null }));

import { AppLayout } from './AppLayout';

describe('role dashboard integration', () => {
  afterEach(() => { mocks.role = 'STAFF'; mocks.accessState = 'staff'; mocks.quotaMode = false; mocks.rates = []; Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
  it.each(['STAFF', 'AGENT'] as const)('%s lands on its dashboard without admin navigation and has Chat FAB', role => {
    mocks.role = role;
    mocks.accessState = role === 'AGENT' ? 'approved' : 'staff';
    render(<AppLayout />);
    expect(screen.getByTestId('role-dashboard')).toHaveTextContent(`${role} dashboard`);
    expect(screen.queryByTestId('admin-navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog', { name: 'Chat assistant' })).toBeInTheDocument();
  });
  it('Admin retains backend navigation, lands on Admin dashboard, and opens chat from FAB', () => {
    mocks.role = 'ADMIN';
    mocks.accessState = 'admin';
    render(<AppLayout />);
    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('admin-navigation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByRole('dialog', { name: 'Chat assistant' })).toBeInTheDocument();
  });
  it('quota mode keeps the same cached rates available to dashboard and Chat', () => {
    mocks.role = 'AGENT';
    mocks.accessState = 'approved';
    mocks.quotaMode = true;
    mocks.rates = [{ id: 'r1', universityId: 'u1', universityName: 'Cached School', intake: 'Jan 2027', aggregator: '', studyLevel: 'UG', masterRate: 0, agentRate: 10, diffMargin: 0, isFlatFee: false, netOrGross: 'GROSS' }];
    render(<AppLayout />);
    expect(screen.getByTestId('role-dashboard')).toHaveTextContent('AGENT dashboard (1 routes; query=)');
    expect(screen.getByRole('button', { name: /Quota limit reached/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    expect(screen.getByTestId('chat-data')).toHaveTextContent('1 routes; stale=true');
    expect(screen.getByText(/Firestore quota was reached/i)).toBeInTheDocument();
  });
  it('network-offline state stays distinct from a Firestore quota state', () => {
    mocks.role = 'STAFF';
    mocks.accessState = 'staff';
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<AppLayout />);
    expect(screen.getByRole('button', { name: /App status: Offline/i })).toBeInTheDocument();
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument();
  });
  it('changing user role clears dashboard filters and closes Chat', () => {
    mocks.role = 'STAFF';
    mocks.accessState = 'staff';
    const { rerender } = render(<AppLayout />);
    fireEvent.click(screen.getByRole('button', { name: /open chat assistant/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Set filter' }));
    expect(screen.getByTestId('role-dashboard')).toHaveTextContent('query=private');
    mocks.role = 'AGENT';
    mocks.accessState = 'approved';
    rerender(<AppLayout />);
    expect(screen.getByTestId('role-dashboard')).toHaveTextContent('query=');
    expect(screen.queryByRole('dialog', { name: 'Chat assistant' })).not.toBeInTheDocument();
  });
});

