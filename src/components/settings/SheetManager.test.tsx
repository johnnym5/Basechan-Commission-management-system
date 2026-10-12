import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetManager } from './SheetManager';
import type { CommissionRate } from '../../types';
import * as sheetService from '../../services/sheetManagementService';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1', email: 'admin@basechan.com' },
    role: 'ADMIN',
  }),
}));

vi.mock('../../hooks/useSystemConfig', () => ({
  useSystemConfig: () => ({
    intakeLifecycles: {
      'Jan 2026': { sheetName: 'Jan 2026', status: 'active' },
      'Sept 2025': { sheetName: 'Sept 2025', status: 'closing' },
      'Archived Intake': { sheetName: 'Archived Intake', status: 'archived' },
    },
  }),
}));

vi.mock('../../services/sheetManagementService', () => ({
  deleteSheets: vi.fn().mockResolvedValue(undefined),
  renameSheet: vi.fn().mockResolvedValue(undefined),
  toggleSheetVisibility: vi.fn().mockResolvedValue(undefined),
  setSheetAsDefault: vi.fn().mockResolvedValue(undefined),
}));

const mockRates: CommissionRate[] = [
  {
    id: 'rate-1',
    universityId: 'u-leicester',
    universityName: 'University of Leicester',
    intake: 'Jan 2026',
    studyLevel: 'PG',
    aggregator: 'SI-UK',
    masterRate: 20,
    agentRate: 15,
    diffMargin: 5,
    isFlatFee: false,
    netOrGross: 'GROSS',
    sourceSheet: 'Jan 2026',
  },
  {
    id: 'rate-2',
    universityId: 'u-coventry',
    universityName: 'Coventry University',
    intake: 'Sept 2025',
    studyLevel: 'UG',
    aggregator: 'Edvoy',
    masterRate: 18,
    agentRate: 12,
    diffMargin: 6,
    isFlatFee: false,
    netOrGross: 'GROSS',
    sourceSheet: 'Sept 2025',
  },
];

const mockSheetSettings = {
  'Jan 2026': { STAFF: true, AGENT: true },
  'Sept 2025': { STAFF: false, AGENT: true },
  'Archived Intake': { STAFF: false, AGENT: false },
};

describe('SheetManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cards for each derived intake sheet with rate counts and status badges', () => {
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
      />
    );

    expect(screen.getByText('Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Sept 2025')).toBeInTheDocument();
    expect(screen.getByText('Archived Intake')).toBeInTheDocument();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Closing Soon')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();

    expect(screen.getAllByText('1 rate').length).toBe(2);
  });

  it('filters sheet cards based on search input query', () => {
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Filter sheet names/i);
    fireEvent.change(searchInput, { target: { value: 'Jan' } });

    expect(screen.getByText('Jan 2026')).toBeInTheDocument();
    expect(screen.queryByText('Sept 2025')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived Intake')).not.toBeInTheDocument();
  });

  it('handles multi-selection and displays bulk actions bar', () => {
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
      />
    );

    const selectAllCheckbox = screen.getByLabelText(/Select all sheets/i);
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText(/3 sheets selected/i)).toBeInTheDocument();
    expect(screen.getByText('Enable Staff')).toBeInTheDocument();
    expect(screen.getByText('Disable Staff')).toBeInTheDocument();
    expect(screen.getByText('Enable Agent')).toBeInTheDocument();
    expect(screen.getByText('Disable Agent')).toBeInTheDocument();
    expect(screen.getByText(/Delete Selected \(3\)/i)).toBeInTheDocument();
  });

  it('triggers bulk visibility toggles for selected sheets', async () => {
    const onRefreshRates = vi.fn();
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
        onRefreshRates={onRefreshRates}
      />
    );

    const selectAllCheckbox = screen.getByLabelText(/Select all sheets/i);
    fireEvent.click(selectAllCheckbox);

    const disableStaffButton = screen.getByText('Disable Staff');
    fireEvent.click(disableStaffButton);

    await waitFor(() => {
      expect(sheetService.toggleSheetVisibility).toHaveBeenCalledWith(
        'Jan 2026',
        'STAFF',
        true,
        'admin@basechan.com'
      );
      expect(sheetService.toggleSheetVisibility).toHaveBeenCalledWith(
        'Sept 2025',
        'STAFF',
        true,
        'admin@basechan.com'
      );
      expect(onRefreshRates).toHaveBeenCalled();
    });
  });

  it('calls setSheetAsDefault when clicking default star button', async () => {
    const onRefreshRates = vi.fn();
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
        onRefreshRates={onRefreshRates}
      />
    );

    const septStarButton = screen.getByRole('button', {
      name: /Set Sept 2025 as default/i,
    });
    fireEvent.click(septStarButton);

    await waitFor(() => {
      expect(sheetService.setSheetAsDefault).toHaveBeenCalledWith(
        'Sept 2025',
        'admin@basechan.com'
      );
      expect(onRefreshRates).toHaveBeenCalled();
    });
  });

  it('opens single delete modal and confirms deletion', async () => {
    const onRefreshRates = vi.fn();
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
        onRefreshRates={onRefreshRates}
      />
    );

    const janDeleteButton = screen.getByRole('button', {
      name: /Delete sheet Jan 2026/i,
    });
    fireEvent.click(janDeleteButton);

    expect(screen.getByText('Confirm Sheet Deletion')).toBeInTheDocument();
    expect(screen.getByText(/"Jan 2026"/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', {
      name: /^Delete Sheet$/i,
    });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(sheetService.deleteSheets).toHaveBeenCalledWith(
        ['Jan 2026'],
        'admin@basechan.com'
      );
      expect(onRefreshRates).toHaveBeenCalled();
    });
  });

  it('opens purge all sheets modal and enforces confirmation text before purging', async () => {
    const onRefreshRates = vi.fn();
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
        onRefreshRates={onRefreshRates}
      />
    );

    const purgeButton = screen.getByRole('button', { name: /Purge All Sheets/i });
    fireEvent.click(purgeButton);

    expect(screen.getByText(/Critical Security Safety Check/i)).toBeInTheDocument();

    const confirmPurgeBtn = screen.getByRole('button', {
      name: /Confirm purge all sheets/i,
    });
    expect(confirmPurgeBtn).toBeDisabled();

    const purgeInput = screen.getByPlaceholderText('DELETE ALL SHEETS');
    fireEvent.change(purgeInput, { target: { value: 'DELETE ALL SHEETS' } });

    expect(confirmPurgeBtn).not.toBeDisabled();
    fireEvent.click(confirmPurgeBtn);

    await waitFor(() => {
      expect(sheetService.deleteSheets).toHaveBeenCalledWith(
        expect.arrayContaining(['Jan 2026', 'Sept 2025', 'Archived Intake']),
        'admin@basechan.com'
      );
      expect(onRefreshRates).toHaveBeenCalled();
    });
  });

  it('opens rename modal and calls renameSheet on submission', async () => {
    const onRefreshRates = vi.fn();
    render(
      <SheetManager
        rates={mockRates}
        sheetSettings={mockSheetSettings}
        defaultIntake="Jan 2026"
        onRefreshRates={onRefreshRates}
      />
    );

    const renameButton = screen.getByRole('button', {
      name: /Rename sheet Jan 2026/i,
    });
    fireEvent.click(renameButton);

    expect(screen.getByText(/Rename Intake Sheet/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Enter new sheet name/i);
    fireEvent.change(nameInput, { target: { value: 'Jan 2026 Updated' } });

    const confirmRenameBtn = screen.getByRole('button', {
      name: /^Rename Sheet$/i,
    });
    fireEvent.click(confirmRenameBtn);

    await waitFor(() => {
      expect(sheetService.renameSheet).toHaveBeenCalledWith(
        'Jan 2026',
        'Jan 2026 Updated',
        'admin@basechan.com'
      );
      expect(onRefreshRates).toHaveBeenCalled();
    });
  });
});
