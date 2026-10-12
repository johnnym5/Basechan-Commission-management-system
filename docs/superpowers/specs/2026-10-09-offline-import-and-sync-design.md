# Offline Rate Import, Manual Settings Push & Automatic Cloud Sync Design Specification

**Status:** Proposed
**Date:** 2026-10-09
**Target:** Local Offline Rate Staging, IndexedDB Pending Import Store, Offline Import UI Support, Connection Restore Detection, One-Click Cloud Push Banner, and Manual Push Button in Settings.

---

## 1. Executive Summary & Purpose

Enable Admin users to import Excel/CSV sheets even when offline (`!navigator.onLine`) or when Firestore quota limits are active:
1. **Offline Local Staging:** In [`ExcelUploadModal.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/ExcelUploadModal.tsx), when offline or in quota mode, allow importing rates directly into local IndexedDB (`rates` store and `pendingOfflineImports` store).
2. **Immediate Local Access:** Update local rates and UI immediately so the Admin can browse, search, and work with the newly imported rates offline without waiting for internet connection.
3. **Automatic Cloud Push Prompt:** When connection is restored (`online` event or quota reset), display a prominent top banner in [`AppLayout.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/AppLayout.tsx):
   `"You have school data imported offline. Connection restored! [ Push Local Import to Cloud ]"`
4. **Manual Settings Sync Button:** Add a dedicated **"Push Offline Imports to Cloud"** button in Settings ([`DataHealthTab.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/settings/DataHealthTab.tsx) & [`SheetManager.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/settings/SheetManager.tsx)).
   * **When Offline or in Quota Mode:** Greyed out (`disabled opacity-50 cursor-not-allowed`) with tooltip *"Connect online to push local imports to Cloud"*.
   * **When Online & Quota Normal:** Lights up in active color (amber/emerald) displaying pending batch count (`"Push Local Import to Cloud (N Batches)"`).
5. **One-Click Cloud Sync:** Clicking **Push Local Import to Cloud** (from banner or Settings button) uploads the staged rates in batches to Cloud Firestore, updates role projections (`staff_rates` & `agent_rates`), and clears the pending offline import queue.

---

## 2. Technical Component Design

### A. IndexedDB Pending Offline Imports Store ([`src/services/localRateDatabase.ts`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/services/localRateDatabase.ts))
* **Database Upgrade:** Upgrade DB version to `5` and add `pendingOfflineImports` objectStore.
* **Interface & Functions:**
  ```typescript
  export interface PendingOfflineImport {
    id: string;
    rates: CommissionRate[];
    sheetNames: string[];
    importedAt: string;
    importedBy: string;
  }

  export async function saveLocalOfflineImport(uid: string, item: PendingOfflineImport): Promise<void>
  export async function getPendingOfflineImports(uid: string): Promise<PendingOfflineImport[]>
  export async function clearPendingOfflineImport(uid: string, importId: string): Promise<void>
  export async function stageRatesToLocalDatabase(uid: string, newRates: CommissionRate[]): Promise<void>
  ```

---

### B. Offline Import Handling in Excel Upload Modal ([`src/components/ExcelUploadModal.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/ExcelUploadModal.tsx))
* When `!navigator.onLine` or `quotaMode`:
  * Call `saveLocalOfflineImport` and `stageRatesToLocalDatabase`.
  * Display a success notice: `"Imported ${parsedRates.length} records locally to offline database. They will sync to Cloud when connection returns."`
  * Call `onUploadComplete(parsedRates.length)` to refresh dashboard views offline.

---

### C. Connection Restored Cloud Push Banner & Manual Settings Sync Button ([`AppLayout.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/AppLayout.tsx), [`DataHealthTab.tsx`](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/src/components/settings/DataHealthTab.tsx))
* **Top Banner:** Condition `role === 'ADMIN' && navigator.onLine && !isQuotaMode && pendingOfflineImports.length > 0`.
* **Settings Manual Push Button:**
  * Enabled when `navigator.onLine && !isQuotaMode && pendingOfflineImports.length > 0`.
  * Disabled and greyed out when offline or quota mode.
* **Push Action:** `handlePushOfflineImportsToCloud()` calls `uploadRatesInBatches`, archives previous intakes if `2027 Master Baseline` was imported, clears pending import queue, and shows a success banner.

---

## 3. Verification & Testing Plan

1. **Unit Tests:**
   * Test `saveLocalOfflineImport`, `getPendingOfflineImports`, and `stageRatesToLocalDatabase` in `localRateDatabase.test.ts`.
   * Test offline import flow in `ExcelUploadModal.test.tsx`.
   * Test cloud push banner rendering and manual settings push button state in `AppLayout.test.tsx` and `DataHealthTab.test.tsx`.
2. **Production Build:**
   * Run `npm run build` to verify zero TypeScript compile errors.
