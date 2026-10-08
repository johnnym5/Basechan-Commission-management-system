import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseCommissionWorkbook } from '../utils/excelParser';
import { uploadRatesInBatches } from '../utils/firestoreBatcher';
import type { BatchUploadProgress } from '../utils/firestoreBatcher';
import type { CommissionRate } from '../types';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (count: number) => void;
}

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedRates, setParsedRates] = useState<CommissionRate[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selected);
    setError(null);
    setParsing(true);
    setStatusMessage('Reading and parsing Excel sheets in browser...');

    try {
      const buffer = await selected.arrayBuffer();
      const result = parseCommissionWorkbook(buffer);

      if (result.rates.length === 0) {
        setError('No valid commission rows could be extracted from this workbook.');
      } else {
        setParsedRates(result.rates);
        const dupMsg = result.duplicateCountPrevented > 0
          ? ` (${result.duplicateCountPrevented} duplicate rows across sheets consolidated into single canonical records)`
          : '';
        setStatusMessage(
          `Extracted ${result.rates.length} unique rates across ${result.universities.length} universities${dupMsg}. Ready to sync.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error parsing Excel file';
      setError(msg);
    } finally {
      setParsing(false);
    }
  };

  const handleStartUpload = async () => {
    if (parsedRates.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const res = await uploadRatesInBatches(parsedRates, (prog) => {
        setProgress(prog);
      });

      if (res.success) {
        onUploadComplete(res.uploadedCount);
        onClose();
      } else {
        setError(`Upload finished with errors: ${res.errors.join(', ')}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload process failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRates([]);
    setProgress(null);
    setError(null);
    setStatusMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-lg">Import Master Excel</h3>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 group"
            >
              <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mx-auto mb-3 transition" />
              <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                Click to select Excel workbook
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports .xlsx files (e.g., MASTER COMMISSION SHEET 2025 - 2026 FEB.xlsx)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                {!uploading && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
                  >
                    Change file
                  </button>
                )}
              </div>

              {parsing && (
                <div className="flex items-center justify-center gap-2 py-4 text-slate-600 dark:text-slate-300 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>Processing sheets in browser...</span>
                </div>
              )}

              {statusMessage && !parsing && (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3 flex items-start gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {uploading && progress && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>
                      Batch {progress.currentBatch} of {progress.totalBatches}
                    </span>
                    <span className="font-semibold font-mono">{progress.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 dark:bg-emerald-500 h-2.5 rounded-full transition-all duration-200"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 text-center font-mono">
                    Writing {progress.completed} / {progress.total} documents to Firestore...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartUpload}
            disabled={uploading || parsing || parsedRates.length === 0}
            className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing to Firestore...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Import {parsedRates.length > 0 ? `(${parsedRates.length} Records)` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
