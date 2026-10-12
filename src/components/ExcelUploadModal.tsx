import React, { useRef, useState, useCallback } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Layers,
  CheckSquare,
  Square,
  Trash2,
  Plus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseCommissionWorkbook, getWorkbookSheets } from '../utils/excelParser';
import { parseAgentMasterSheet, is2027AgentMasterSheet } from '../utils/agentMasterParser';
import { uploadRatesInBatches } from '../utils/firestoreBatcher';
import type { BatchUploadProgress } from '../utils/firestoreBatcher';
import type { CommissionRate } from '../types';
import { useAuth } from '../context/AuthContext';
import { archivePreviousIntakes } from '../services/sheetManagementService';
import { isQuotaOffline } from '../services/firestoreOfflineMode';
import { saveLocalOfflineImport, stageRatesToLocalDatabase } from '../services/localRateDatabase';

export interface UploadedFile {
  id: string;
  file: File;
  buffer: ArrayBuffer;
  sheets: string[];
  selectedSheets: string[];
}

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
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedRates, setParsedRates] = useState<CommissionRate[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<BatchUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const parseAndSetRates = (filesToParse: UploadedFile[]) => {
    setParsing(true);
    setError(null);

    try {
      const combinedRateMap = new Map<string, CommissionRate>();
      const uniSet = new Set<string>();
      let rawCount = 0;
      let totalSheetsParsed = 0;

      for (const item of filesToParse) {
        if (item.selectedSheets.length === 0) continue;

        const workbook = XLSX.read(item.buffer, { type: 'array', cellStyles: true });

        for (const sheetName of item.selectedSheets) {
          totalSheetsParsed++;
          const ws = workbook.Sheets[sheetName];
          if (!ws) continue;

          const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

          let sheetRates: CommissionRate[] = [];
          if (is2027AgentMasterSheet(sheetName, rows)) {
            sheetRates = parseAgentMasterSheet(rows, sheetName);
          } else {
            const result = parseCommissionWorkbook(item.buffer, [sheetName]);
            sheetRates = result.rates;
          }

          for (const rate of sheetRates) {
            rawCount++;
            uniSet.add(rate.universityId);
            const existing = combinedRateMap.get(rate.id);
            if (!existing) {
              combinedRateMap.set(rate.id, rate);
            } else {
              const updated: CommissionRate = {
                ...existing,
                ...rate,
                masterRate: rate.masterRate > 0 ? rate.masterRate : existing.masterRate,
                agentRate: rate.agentRate > 0 ? rate.agentRate : existing.agentRate,
                country: rate.country && rate.country !== '-' ? rate.country : existing.country,
                updatedAt: new Date().toISOString(),
              };
              updated.diffMargin = parseFloat((updated.masterRate - updated.agentRate).toFixed(2));
              combinedRateMap.set(rate.id, updated);
            }
          }
        }
      }

      const finalRates = Array.from(combinedRateMap.values());
      setParsedRates(finalRates);

      if (finalRates.length === 0) {
        if (totalSheetsParsed === 0) {
          setStatusMessage('No sheets selected across uploaded files.');
        } else {
          setError('No valid commission rows found in the selected sheet(s).');
          setStatusMessage('');
        }
      } else {
        const duplicateCountPrevented = Math.max(0, rawCount - finalRates.length);
        const dupMsg =
          duplicateCountPrevented > 0
            ? ` (${duplicateCountPrevented} duplicates consolidated into canonical records)`
            : '';
        setStatusMessage(
          `Extracted ${finalRates.length} unique rates across ${uniSet.size} universities from ${totalSheetsParsed} sheet(s) in ${filesToParse.length} file(s)${dupMsg}.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error parsing Excel sheets';
      setError(msg);
      setParsedRates([]);
    } finally {
      setParsing(false);
    }
  };

  const handleProcessRawFiles = async (fileList: File[]) => {
    const validFiles = fileList.filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
    });

    if (validFiles.length === 0) {
      setError('Please select valid Excel (.xlsx, .xls) or CSV (.csv) files.');
      return;
    }

    setParsing(true);
    setStatusMessage('Reading workbook sheets...');
    setError(null);

    try {
      const newItems: UploadedFile[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const buffer = await file.arrayBuffer();
        const sheets = getWorkbookSheets(buffer);
        const fileId = `${file.name}-${file.size}-${Date.now()}-${i}`;

        newItems.push({
          id: fileId,
          file,
          buffer,
          sheets,
          selectedSheets: [...sheets], // All sheets checked by default
        });
      }

      const updatedFiles = [...uploadedFiles, ...newItems];
      setUploadedFiles(updatedFiles);
      parseAndSetRates(updatedFiles);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reading file(s)';
      setError(msg);
      setParsing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 0) {
      handleProcessRawFiles(selected);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length > 0) {
        handleProcessRawFiles(droppedFiles);
      }
    },
    [uploadedFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  if (!isOpen) return null;

  const handleSheetToggle = (fileId: string, sheetName: string) => {
    const updated = uploadedFiles.map((item) => {
      if (item.id !== fileId) return item;
      const exists = item.selectedSheets.includes(sheetName);
      const updatedSheets = exists
        ? item.selectedSheets.filter((s) => s !== sheetName)
        : [...item.selectedSheets, sheetName];
      return { ...item, selectedSheets: updatedSheets };
    });

    setUploadedFiles(updated);
    parseAndSetRates(updated);
  };

  const handleSelectAllSheets = () => {
    const updated = uploadedFiles.map((item) => ({
      ...item,
      selectedSheets: [...item.sheets],
    }));
    setUploadedFiles(updated);
    parseAndSetRates(updated);
  };

  const handleDeselectAllSheets = () => {
    const updated = uploadedFiles.map((item) => ({
      ...item,
      selectedSheets: [],
    }));
    setUploadedFiles(updated);
    setParsedRates([]);
    setStatusMessage('No sheets selected across uploaded files.');
  };

  const handleRemoveFile = (fileId: string) => {
    const updated = uploadedFiles.filter((item) => item.id !== fileId);
    setUploadedFiles(updated);
    if (updated.length > 0) {
      parseAndSetRates(updated);
    } else {
      handleReset();
    }
  };

  const handleStartUpload = async () => {
    if (parsedRates.length === 0) return;
    setUploading(true);
    setError(null);

    const userId = user?.uid || 'admin';
    const isOffline = !navigator.onLine || isQuotaOffline(user?.uid);

    try {
      if (isOffline) {
        const importId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const sheetNames = Array.from(
          new Set([
            ...uploadedFiles.flatMap((f) => f.selectedSheets),
            ...parsedRates.map((r) => r.sourceSheet || r.intake).filter(Boolean) as string[],
          ])
        );
        const importedAt = new Date().toISOString();
        const importedBy = user?.email || 'Admin';

        await saveLocalOfflineImport(userId, {
          id: importId,
          rates: parsedRates,
          sheetNames,
          importedAt,
          importedBy,
        });

        await stageRatesToLocalDatabase(userId, parsedRates);

        setStatusMessage(
          `Imported ${parsedRates.length} records locally to offline database. They will sync to Cloud when connection returns.`
        );

        setTimeout(() => {
          onUploadComplete(parsedRates.length);
          onClose();
        }, 1500);
        return;
      }

      const res = await uploadRatesInBatches(
        parsedRates,
        (prog) => {
          setProgress(prog);
        },
        user?.email || 'Admin'
      );

      if (res.success) {
        const importedSheetNames = Array.from(
          new Set([
            ...uploadedFiles.flatMap((f) => f.selectedSheets),
            ...parsedRates.map((r) => r.sourceSheet || r.intake).filter(Boolean) as string[],
          ])
        );

        const adminEmail = user?.email || 'Admin';
        for (const sheetName of importedSheetNames) {
          const clean = sheetName.trim();
          if (
            clean.toUpperCase() === '2027 MASTER BASELINE' ||
            clean.toUpperCase() === '2027 AGENT CONSOLIDATED MASTER'
          ) {
            try {
              await archivePreviousIntakes(clean, adminEmail);
            } catch (archiveErr) {
              console.error(`Error archiving previous intakes for ${clean}:`, archiveErr);
            }
          }
        }

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
    setUploadedFiles([]);
    setParsedRates([]);
    setProgress(null);
    setError(null);
    setStatusMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalSheetsAcrossFiles = uploadedFiles.reduce((acc, item) => acc + item.sheets.length, 0);
  const totalSelectedSheetsAcrossFiles = uploadedFiles.reduce(
    (acc, item) => acc + item.selectedSheets.length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {uploadedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition group ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20'
              }`}
            >
              <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mx-auto mb-3 transition" />
              <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                Click or drag & drop Excel workbooks or CSV files
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports multiple .xlsx, .xls, and .csv files with multiple sheets (e.g. 2027 Master Baseline, RAW DATA)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* File list header & controls */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  Uploaded Files ({uploadedFiles.length})
                </p>
                {!uploading && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Files
                    </button>
                    <span className="text-slate-400">·</span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-rose-500 hover:underline font-medium cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Individual File Cards */}
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {uploadedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[260px]">
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {(item.file.size / 1024).toFixed(1)} KB · {item.sheets.length} Sheet(s)
                          </p>
                        </div>
                      </div>
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Sheet Toggling for this file */}
                    {item.sheets.length > 0 && !uploading && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {item.sheets.map((sheet) => {
                          const isChecked = item.selectedSheets.includes(sheet);
                          return (
                            <button
                              key={sheet}
                              type="button"
                              onClick={() => handleSheetToggle(item.id, sheet)}
                              className={`p-1.5 rounded-lg border text-left text-[11px] font-semibold transition flex items-center justify-between cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                              }`}
                            >
                              <span className="truncate mr-1">{sheet}</span>
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Global Sheet Selection Toolbar */}
              {totalSheetsAcrossFiles > 0 && !uploading && (
                <div className="flex items-center justify-between px-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Selected {totalSelectedSheetsAcrossFiles} / {totalSheetsAcrossFiles} sheets
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSheets}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllSheets}
                      className="text-[11px] text-slate-400 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {parsing && (
                <div className="flex items-center justify-center gap-2 py-4 text-slate-600 dark:text-slate-300 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>Parsing selected sheet(s) in browser...</span>
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
