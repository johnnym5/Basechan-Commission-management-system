# Executive Sheet Manager Design Specification

**Status:** Proposed
**Date:** 2026-10-09
**Target:** Sheet Card Grid Manager, Default Sheet Selection, Enable/Disable Visibility, Multi-Select Checkboxes, Renaming/Editing, and Single/Batch/Purge All Sheet Deletion.

---

## 1. Executive Summary & Purpose

Enhance the Admin System Settings page ([`SheetVisibilityTab.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/settings/SheetVisibilityTab.tsx)) with a dedicated **Sheet Manager** card grid that provides complete lifecycle management for all imported sheets and intakes:
1. **Interactive Sheet Cards:** Display sheet title, total routes count, default sheet indicator star, Staff visibility status, Agent visibility status, and intake lifecycle status (`Active`, `Closing Soon`, `Archived`).
2. **Default Sheet(s) Control:** One-click star/toggle on any sheet card to set it as a "Default Sheet" or "Main Active Intake".
3. **Enable / Disable Toggles:** Instant toggle switches on each card (or in bulk) to enable or disable sheet visibility for Staff and Agents.
4. **Multi-Select & Bulk Actions:** Individual card checkboxes, "Select All / Deselect All", and a bulk toolbar to enable, disable, or delete multiple selected sheets at once.
5. **Single, Batch & Purge All Deletion:**
   * Delete individual sheet with single-click modal confirmation.
   * Batch delete selected sheets.
   * "Purge All Sheets" action with a strict safety confirmation modal requiring typing `DELETE ALL SHEETS`.
6. **Sheet Renaming & Status Updates:** Rename sheet and update lifecycle status/deadline dates with real-time propagation to Firestore projections.

---

## 2. Component Design & Touchpoints

### A. Sheet Manager Component (`src/components/settings/SheetManager.tsx`)
* **State Management:**
  * `selectedSheetNames: string[]`
  * `isEditSheetModalOpen: boolean`, `editingSheetName: string | null`
  * `isDeleteConfirmOpen: boolean`, `sheetsToDelete: string[]`
  * `isPurgeAllConfirmOpen: boolean`, `purgeConfirmText: string`
* **Card UI Elements:**
  * Top-left checkbox for multi-select.
  * Sheet title & routes count badge.
  * "Default Sheet" Star Button (sets main active default intake).
  * Staff Visibility Toggle (Eye/EyeOff button).
  * Agent Visibility Toggle (Eye/EyeOff button).
  * Status Badge (`Active`, `Closing Soon`, `Archived`).
  * Edit & Delete action buttons on each card.

---

### B. Sheet Management Service ([`src/services/sheetManagementService.ts`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/services/sheetManagementService.ts))
* **Functions:**
  * `deleteSheets(sheetNames: string[], adminEmail: string)`: Batch purges rates matching `sourceSheet` or `intake` in `sheetNames` across `rates`, `staff_rates`, `agent_rates`, `organization_agent_rates`, `sheet_settings`, and `intake_lifecycles`.
  * `renameSheet(oldName: string, newName: string, adminEmail: string)`: Updates `sheet_settings` doc ID, `intake_lifecycles` doc ID, and updates `sourceSheet`/`intake` fields on matching rates.
  * `toggleSheetVisibility(sheetName: string, role: 'STAFF' | 'AGENT', disabled: boolean, adminEmail: string)`: Updates `sheet_settings` and syncs role projections.

---

## 3. Verification & Testing Plan

1. **Unit Tests:**
   * Test `deleteSheets` purging rates and sheet settings in `sheetManagementService.test.ts`.
   * Test multi-select, bulk delete, default sheet toggles, and single delete modal interactions in `SheetManager.test.tsx`.
2. **Production Build:**
   * Run `npm run build` to verify zero TypeScript compile errors.
