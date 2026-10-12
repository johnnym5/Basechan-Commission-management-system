# Multi-Sheet Import System & 2027 Master Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Multi-Sheet/Multi-File Import System with a 2027 AGENT CONSOLIDATED MASTER parser, visible Admin Import buttons, and automatic categorization of older sheets under Previous Intakes.

**Architecture:** Create `src/utils/agentMasterParser.ts` for parsing percentages, fixed fees with currency codes, unconfirmed rates, KPI metadata, and 7 aggregator benchmark pairs. Upgrade `ExcelUploadModal.tsx` to support multi-file drag-and-drop. Add visible "Import Sheets" buttons to Header and Sheet Manager. Automatically set `2027 Master Baseline` as default intake while archiving previous intakes.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons, XLSX sheet parser, Firebase Firestore batch write.

**Spec:** `docs/superpowers/specs/2026-10-09-multi-sheet-import-and-2027-master-parser-design.md`

## Global Constraints

- Preserve role security boundaries.
- Ensure all parsed rate records include `universityId`, `universityName`, `country`, `studyLevel`, `intake`, and `sourceSheet`.
- Batch write operations must be performed in chunks of up to 450 documents.

---

### Task 1: 2027 AGENT CONSOLIDATED MASTER Parser (`agentMasterParser.ts`)

**Files:**
- Create: `src/utils/agentMasterParser.ts`
- Create: `src/utils/agentMasterParser.test.ts`

**Functions:**
- `parseRateCell(val: string | number | null | undefined)`: Parses percentage (`"21%"` $\rightarrow$ `21`), fixed fee with currency (`"CAD 1,170.00"` $\rightarrow$ `1170` CAD), unconfirmed (`"TBC"`), and missing values.
- `parseAgentMasterWorkbook(buffer: ArrayBuffer, sheetNames?: string[])`: Reads KPI summary metadata block and extracts baseline rates + 7 aggregator pairs (`Basechan`, `EDVOY`, `SI-UK`, `UAP`, `CRIZAC`, `KC OVERSEAS`, `AIMS EDUCATION`).

- [ ] **Step 1: Write unit tests in `src/utils/agentMasterParser.test.ts`**
- [ ] **Step 2: Implement `src/utils/agentMasterParser.ts`**
- [ ] **Step 3: Run `npx vitest run src/utils/agentMasterParser.test.ts` to verify.**

---

### Task 2: Multi-File & Multi-Sheet Excel Upload Modal

**Files:**
- Modify: `src/components/ExcelUploadModal.tsx`
- Test: `src/components/ExcelUploadModal.test.tsx`

- [ ] **Step 1: Update `ExcelUploadModal.tsx` to support multi-file drag-and-drop (`File[]`).**
- [ ] **Step 2: Scan sheets across all selected files and support 2027 Master Baseline parsing via `parseAgentMasterWorkbook`.**
- [ ] **Step 3: Run `npx vitest run src/components/ExcelUploadModal.test.tsx` to verify.**

---

### Task 3: Import Buttons & Previous Intakes Categorization

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/components/settings/SheetManager.tsx`
- Modify: `src/services/sheetManagementService.ts`

- [ ] **Step 1: Add visible "Import Sheets" button to top Header in `AppLayout.tsx` for Admin users.**
- [ ] **Step 2: Add visible "Import Master Sheets" button to Sheet Manager toolbar in `SheetManager.tsx`.**
- [ ] **Step 3: In `sheetManagementService.ts`, implement `archivePreviousIntakes(newActiveSheet: string, adminEmail: string)` to move older sheets to `archived` in `intake_lifecycles`.**
- [ ] **Step 4: Run `npx vitest run src/components/AppLayout.test.tsx` to verify.**

---

### Task 4: Production Build, Test Suite & Live Deployment

- [ ] **Step 1: Run `npm run build` to verify zero compile errors.**
- [ ] **Step 2: Run `npx vitest run` to verify 100% passing test suite.**
- [ ] **Step 3: Deploy live to Firebase (`npx -y firebase-tools@latest deploy --project basechan-cms`).**
