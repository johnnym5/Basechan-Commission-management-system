# Sheet Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete Sheet Manager card grid in Admin Settings allowing admins to list, default, enable/disable, edit/rename, multi-select, and delete single, multiple, or all sheets.

**Architecture:** Create `sheetManagementService.ts` for batch purging sheet documents across `rates`, `staff_rates`, `agent_rates`, `organization_agent_rates`, `sheet_settings`, and `intake_lifecycles`. Build `SheetManager.tsx` with card grid UI, selection checkboxes, bulk action bar, edit modal, and double-confirmation purge modal. Integrate into `SheetVisibilityTab.tsx`.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons, Firebase Firestore batch writes.

**Spec:** `docs/superpowers/specs/2026-10-09-sheet-manager-design.md`

## Global Constraints

- Preserve role security and data isolation rules.
- Batch deletes must be performed in chunks of up to 450 documents to prevent Firestore transaction overflow.
- Single, batch, and purge-all sheet deletions must show confirmation modals before execution.

---

### Task 1: Sheet Management Service (`sheetManagementService.ts`)

**Files:**
- Create: `src/services/sheetManagementService.ts`
- Create: `src/services/sheetManagementService.test.ts`

**Functions:**
- `deleteSheets(sheetNames: string[], adminEmail: string)`: Purges matching sheet settings, lifecycles, and rates across `rates`, `staff_rates`, `agent_rates`, and `organization_agent_rates`.
- `renameSheet(oldName: string, newName: string, adminEmail: string)`: Renames sheet settings and updates `sourceSheet` or `intake` on all rates.
- `toggleSheetVisibility(sheetName: string, role: 'STAFF' | 'AGENT', disabled: boolean, adminEmail: string)`: Updates `sheet_settings`.
- `setSheetAsDefault(sheetName: string, adminEmail: string)`: Updates system configuration default intake.

- [ ] **Step 1: Write `src/services/sheetManagementService.test.ts`**
- [ ] **Step 2: Implement `src/services/sheetManagementService.ts`**
- [ ] **Step 3: Run `npx vitest run src/services/sheetManagementService.test.ts` to verify.**

---

### Task 2: Build `SheetManager.tsx` Component

**Files:**
- Create: `src/components/settings/SheetManager.tsx`
- Create: `src/components/settings/SheetManager.test.tsx`

- [ ] **Step 1: Build `SheetManager.tsx` featuring:**
  - Card grid displaying all imported/registered sheets.
  - Multi-select checkboxes & "Select All / Deselect All".
  - Bulk action toolbar for selected sheets (Bulk Enable/Disable, Bulk Delete).
  - Default Sheet Star button.
  - Enable/Disable Staff and Agent visibility toggles.
  - Single sheet delete modal & "Purge All Sheets" safety modal (typing `DELETE ALL SHEETS`).
  - Edit/Rename Sheet Modal.
- [ ] **Step 2: Write unit tests in `SheetManager.test.tsx`.**
- [ ] **Step 3: Run `npx vitest run src/components/settings/SheetManager.test.tsx`.**

---

### Task 3: Embed SheetManager into SheetVisibilityTab

**Files:**
- Modify: `src/components/settings/SheetVisibilityTab.tsx`

- [ ] **Step 1: Replace/enhance sheet visibility section in `SheetVisibilityTab.tsx` with `<SheetManager />`.**
- [ ] **Step 2: Connect refresh rate callbacks.**
- [ ] **Step 3: Run `npx vitest run src/components/SettingsView.test.tsx`.**

---

### Task 4: Production Build & Deployment

- [ ] **Step 1: Run `npm run build` to verify zero compile errors.**
- [ ] **Step 2: Run `npx vitest run` to verify 100% passing unit tests.**
- [ ] **Step 3: Deploy to Firebase (`npx -y firebase-tools@latest deploy --project basechan-cms`).**
