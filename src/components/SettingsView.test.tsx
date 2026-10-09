import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsView } from './SettingsView';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1', email: 'admin@basechaninternational.com' },
    role: 'ADMIN',
  }),
}));

vi.mock('../hooks/useSheetVisibility', () => ({
  useSheetVisibility: () => ({
    sheetSettings: [],
    updateSheetVisibility: vi.fn(),
  }),
}));

vi.mock('../hooks/useSystemConfig', () => ({
  useSystemConfig: () => ({
    defaultIntake: 'ALL',
    defaultAggregator: 'ALL',
    defaultStudyLevel: 'ALL',
    defaultViewMode: 'cards',
    defaultSortBy: 'universityName',
    intakeLifecycles: {},
    updateSystemDefaults: vi.fn(),
    updateIntakeLifecycle: vi.fn(),
  }),
}));

describe('SettingsView', () => {
  it('renders 5 setting tabs for Admin users', () => {
    render(<SettingsView rates={[]} onRefreshRates={() => {}} />);
    expect(screen.getByRole('tab', { name: /Sheet & Default Filters/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Users & Agencies/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Intake & Migration/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Announcements/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Data Health & Audit/i })).toBeDefined();
  });
});
