# Multi-Sheet Import System & 2027 Master Baseline Parser Design Specification

**Status:** Proposed
**Date:** 2026-10-09
**Target:** Admin Import Button Visibility, Multi-File/Multi-Sheet Import Dropzone, 2027 Master Baseline TypeScript Parser, and Previous Intake Categorization.

---

## 1. Executive Summary & Purpose

Provide a comprehensive **Multi-Sheet Import System** for Basechan CMS:
1. **Visible Admin Import Buttons:** Add high-visibility "Import Sheets" buttons on both the top Header bar ([`AppLayout.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/AppLayout.tsx)) and the Sheet Manager toolbar ([`SheetManager.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/settings/SheetManager.tsx)).
2. **Multi-File & Multi-Sheet Dropzone:** Allow drag-and-dropping or selecting multiple Excel (`.xlsx`, `.xls`) or CSV files at once. The system scans all workbooks and sheets in parallel, allowing multi-sheet selection and consolidated batch uploading.
3. **2027 AGENT CONSOLIDATED MASTER Parser:** Implement a dedicated TypeScript parser (`src/utils/agentMasterParser.ts`) that extracts KPI summary metadata and processes the 7 aggregator benchmark pairs (`Basechan`, `EDVOY`, `SI-UK`, `UAP`, `CRIZAC`, `KC OVERSEAS`, `AIMS EDUCATION`) alongside baseline rates.
4. **Automatic Previous Intake Categorization:** Upon importing the new `2027 Master Baseline`, automatically set all existing historical sheets (`RAW DATA`, `Jan 2025`, `Sept 2025`, `Jan 2026`, `Sept 2026`) as `archived` / `previous` in `intake_lifecycles`, setting `2027 Master Baseline` as the primary active default intake.

---

## 2. Technical Component Design

### A. 2027 Master Baseline Parser (`src/utils/agentMasterParser.ts`)
* **Cell Parser Logic:**
  * Percentages (`"21%"` $\rightarrow$ `21`, `0.21`).
  * Currency Fixed Fees (`"CAD 1,170.00"`, `"USD 1,200.00"` $\rightarrow$ `1170` with currency code `'CAD'`).
  * Unconfirmed (`"TBC"` $\rightarrow$ `guidance: 'DO_NOT_USE'` or note `'TBC'`).
  * Missing (`"-"`, `""`, `NaN` $\rightarrow$ skipped).
* **Aggregator Benchmarks:** Extracts pairs for `Basechan`, `EDVOY`, `SI-UK`, `UAP`, `CRIZAC`, `KC OVERSEAS`, and `AIMS EDUCATION`.

---

### B. Multi-File Excel & CSV Upload Modal (`src/components/ExcelUploadModal.tsx`)
* **Multi-File State:** Supports `files: File[]`, scanning sheets across all selected files.
* **Consolidated Preview & Progress:** Displays total extracted rate records across all files before triggering batch Firestore write operations.

---

### C. Automatic Intake Categorization (`src/services/sheetManagementService.ts`)
* Automatically sets `2027 Master Baseline` as the default intake in `system_config`, updating all older sheets to `archived` in `intake_lifecycles`.

---

## 3. Verification & Testing Plan

1. **Unit Tests:**
   * Test 2027 Master Baseline parser cell parsing and rate extraction in `src/utils/agentMasterParser.test.ts`.
   * Test multi-file workbook parsing in `ExcelUploadModal.test.tsx`.
2. **Production Build:**
   * Run `npm run build` to verify zero TypeScript compile errors.
