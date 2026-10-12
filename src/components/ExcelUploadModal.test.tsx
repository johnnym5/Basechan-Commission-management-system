import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { ExcelUploadModal } from './ExcelUploadModal';
import { uploadRatesInBatches } from '../utils/firestoreBatcher';
import { archivePreviousIntakes } from '../services/sheetManagementService';

// Ensure File.prototype.arrayBuffer is available in test environment
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'admin@basechan.com', displayName: 'Admin User' },
    role: 'ADMIN',
  }),
}));

vi.mock('../utils/firestoreBatcher', () => ({
  uploadRatesInBatches: vi.fn(),
}));

vi.mock('../services/sheetManagementService', () => ({
  archivePreviousIntakes: vi.fn().mockResolvedValue(undefined),
}));

function createMockExcelFile(filename: string, sheetsData: Record<string, any[][]>): File {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheetsData)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([arrayBuffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('ExcelUploadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (uploadRatesInBatches as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      uploadedCount: 3,
      errors: [],
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ExcelUploadModal
        isOpen={false}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal drop area when isOpen is true', () => {
    render(
      <ExcelUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    expect(screen.getByText('Import Master Excel')).toBeInTheDocument();
    expect(
      screen.getByText(/Click or drag & drop Excel workbooks or CSV files/i)
    ).toBeInTheDocument();
  });

  it('handles multi-file selection, sheet toggling, 2027 master parser, and standard fallback', async () => {
    const file1 = createMockExcelFile('2027_Agent_Master.xlsx', {
      '2027 Master Baseline': [
        ['2027 Master Baseline - Summary'],
        ['Total Institutions: 1', 'Target Intake: 2027'],
        [
          'Institution',
          'Country',
          'Baseline FD',
          'Baseline UG',
          'Baseline PG',
          'Basechan (UG)',
          'Basechan (PG)',
        ],
        ['University of Oxford', 'UK', '10%', '20%', '22%', '18%', '20%'],
      ],
    });

    const file2 = createMockExcelFile('Standard_Rates.xlsx', {
      'RAW DATA': [
        ['University', 'Country', 'UG Rate', 'PG Rate'],
        ['Coventry University', 'UK', '15%', '18%'],
      ],
    });

    render(
      <ExcelUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const input = screen.getByText(/Click or drag & drop/i).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    // Select multiple files
    fireEvent.change(input, { target: { files: [file1, file2] } });

    // Wait for files to be parsed and displayed
    await waitFor(() => {
      expect(screen.getByText('2027_Agent_Master.xlsx')).toBeInTheDocument();
      expect(screen.getByText('Standard_Rates.xlsx')).toBeInTheDocument();
    });

    // Check sheets rendered
    expect(screen.getByText('2027 Master Baseline')).toBeInTheDocument();
    expect(screen.getByText('RAW DATA')).toBeInTheDocument();

    // Verify extraction summary
    await waitFor(() => {
      expect(screen.getByText(/Extracted \d+ unique rates/i)).toBeInTheDocument();
    });

    // Test Sheet Toggling: Deselect 'RAW DATA'
    const rawDataSheetBtn = screen.getByText('RAW DATA').closest('button');
    expect(rawDataSheetBtn).toBeInTheDocument();
    fireEvent.click(rawDataSheetBtn!);

    // Test Deselect All
    const deselectAllBtn = screen.getByText('Deselect All');
    fireEvent.click(deselectAllBtn);

    await waitFor(() => {
      expect(screen.getByText('No sheets selected across uploaded files.')).toBeInTheDocument();
    });

    // Test Select All
    const selectAllBtn = screen.getByText('Select All');
    fireEvent.click(selectAllBtn);

    await waitFor(() => {
      expect(screen.getByText(/Extracted \d+ unique rates/i)).toBeInTheDocument();
    });

    // Test Import Button
    const importBtn = screen.getByRole('button', { name: /Import/i });
    expect(importBtn).not.toBeDisabled();

    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(uploadRatesInBatches).toHaveBeenCalledTimes(1);
      expect(archivePreviousIntakes).toHaveBeenCalledWith(
        '2027 Master Baseline',
        'admin@basechan.com'
      );
      expect(mockOnUploadComplete).toHaveBeenCalledWith(3);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('supports drag and drop file upload', async () => {
    const file = createMockExcelFile('Dropped_Master.xlsx', {
      '2027 AGENT CONSOLIDATED MASTER': [
        ['Institution', 'Country', 'Baseline FD', 'Baseline UG', 'Baseline PG', 'Basechan (UG)', 'Basechan (PG)'],
        ['University of Cambridge', 'UK', '10%', '20%', '25%', '18%', '22%'],
      ],
    });

    render(
      <ExcelUploadModal
        isOpen={true}
        onClose={mockOnClose}
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const dropZone = screen.getByText(/Click or drag & drop/i).closest('div')!;

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Dropped_Master.xlsx')).toBeInTheDocument();
      expect(screen.getByText('2027 AGENT CONSOLIDATED MASTER')).toBeInTheDocument();
    });
  });
});
