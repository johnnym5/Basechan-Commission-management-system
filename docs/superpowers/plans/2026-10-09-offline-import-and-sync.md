# Offline Rate Import, Manual Settings Push & Automatic Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement offline local rate import to IndexedDB, automatic connection-restore cloud push banner, and a manual push button in Settings that is greyed out when offline or quota-limited.

**Architecture:** Upgrade IndexedDB in `localRateDatabase.ts` to version 5 with a `pendingOfflineImports` store. Update `ExcelUploadModal.tsx` to stage rates locally when offline. Add connection restore detection banner in `AppLayout.tsx` and manual push sync controls in `DataHealthTab.tsx` and `SheetManager.tsx`.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons, IndexedDB, Firebase Firestore batch write.

**Spec:** `docs/superpowers/specs/2026-10-09-offline-import-and-sync-design.md`

## Global Constraints

- Preserve role security boundaries.
- Offline import must immediately update local rates so the Admin can search and view them offline.
- Manual settings push button must be greyed out when `!navigator.onLine` or `isQuotaMode`.

---

### Task 1: IndexedDB Pending Offline Import Store (`localRateDatabase.ts`)

**Files:**
- Modify: `src/services/localRateDatabase.ts`
- Test: `src/services/localRateDatabase.test.ts`

**Functions:**
- `saveLocalOfflineImport(uid: string, item: PendingOfflineImport)`
- `getPendingOfflineImports(uid: string)`
- `clearPendingOfflineImports(uid: string)`
- `stageRatesToLocalDatabase(uid: string, newRates: CommissionRate[])`

- [ ] **Step 1: Write unit tests in `src/services/localRateDatabase.test.ts`**
- [ ] **Step 2: Update `src/services/localRateDatabase.ts` with `pendingOfflineImports` store**
- [ ] **Step 3: Run `npx vitest run src/services/localRateDatabase.test.ts` to verify.**

---

### Task 2: Offline Import Staging in ExcelUploadModal

**Files:**
- Modify: `src/components/ExcelUploadModal.tsx`
- Test: `src/components/ExcelUploadModal.test.tsx`

- [ ] **Step 1: Update `ExcelUploadModal.tsx` so that when `!navigator.onLine` or `quotaMode`, it calls `saveLocalOfflineImport` and `stageRatesToLocalDatabase`.**
- [ ] **Step 2: Display local import success notice and trigger `onUploadComplete`.**
- [ ] **Step 3: Run `npx vitest run src/components/ExcelUploadModal.test.tsx` to verify.**

---

### Task 3: Connection Restored Banner & Settings Manual Push Button

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/components/settings/DataHealthTab.tsx`
- Modify: `src/components/settings/SheetManager.tsx`

- [ ] **Step 1: In `AppLayout.tsx`, add top banner when connection is restored and pending offline imports exist.**
- [ ] **Step 2: In `DataHealthTab.tsx` and `SheetManager.tsx`, add manual "Push Local Imports to Cloud" button that is greyed out when offline or quota-limited.**
- [ ] **Step 3: Implement `handlePushOfflineImportsToCloud` to execute batch uploads and clear the pending import queue.**
- [ ] **Step 4: Run `npx vitest run src/components/AppLayout.test.tsx` to verify.**

---

### Task 4: Production Build & Live Deployment

- [ ] **Step 1: Run `npm run build` to verify zero compile errors.**
- [ ] **Step 2: Run `npx vitest run` to verify 100% passing test suite.**
- [ ] **Step 3: Deploy live to Firebase (`npx -y firebase-tools@latest deploy --project basechan-cms`).**
