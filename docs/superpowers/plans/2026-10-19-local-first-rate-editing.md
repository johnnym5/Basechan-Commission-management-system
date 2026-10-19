# Local-First Rate Editing and Sync Basket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Admin rate edits local-first and reliable, then synchronize compact, grouped changes to Firestore and the Staff/Agent views.

**Architecture:** Persist queued mutations and optimistic Admin rates atomically in the signed-in user's IndexedDB. A foreground worker retries durable packages and sends conditional, idempotent Firestore updates through one shared projection/feed/audit/notice pipeline; the Admin dashboard shows queue status and conflict controls.

**Tech Stack:** React, TypeScript, Firebase Firestore, IndexedDB, Vitest, React Testing Library, Firestore Emulator.

**Spec:** `docs/superpowers/specs/2026-10-19-local-first-rate-editing-design.md`

## Global Constraints

- “Saved locally” is reported only after IndexedDB commits the queue entry and optimistic snapshot together.
- Queue entries are per Admin UID and are never synced by Staff or Agents.
- Admin dashboard basket is Admin-only; other roles see a change after Firestore accepts it.
- Interactive rate writes use field patches for unchanged document IDs; ID-defining edits use an explicit re-key.
- Network/quota failures retain queued mutations and operation IDs.
- Conflicts pause for explicit Admin review; they never silently overwrite a newer cloud edit.
- Imports, sheet-management, general reload-read optimization, and new server-side queue infrastructure are out of scope.

## Review Focus

- Refresh or account switch after a local save: queued data remains durable and isolated to its Admin UID.
- Multiple unsent edits to one rate: coalescing preserves the original conflict base while the last local field value wins.
- Create then delete before sync: the queue cancels the unsent pair without creating a cloud rate.
- Re-key to an existing rate ID: report a collision and preserve both the queued change and current cloud record.
- Firestore commit succeeds but the response is lost: retry with the same operation ID without duplicate feed, audit, or notification effects.

---

### Task 1: Persist local rate operations atomically

**Files:**
- Modify: `src/services/localRateDatabase.ts`
- Test: `src/services/localRateDatabase.test.ts`
- Modify: `src/hooks/useCommissionRates.ts`
- Test: `src/hooks/useCommissionRates.test.ts`
- Create: `src/services/rateWriteQueue.ts`
- Test: `src/services/rateWriteQueue.test.ts`
- Create: `src/types/rateWriteQueue.ts`

**Interfaces:**
- `PendingRateMutation` is a discriminated union: create `{ kind: 'create'; next: CommissionRate }`, update `{ kind: 'update'; id: string; nextId: string; patch: Partial<CommissionRate>; baseFields: Partial<CommissionRate> }`, delete `{ kind: 'delete'; id: string; baseFingerprint: string }`.
- `PendingRateOperation` includes `operationId`, `uid`, `adminEmail`, `mutations`, `category`, `status`, `attemptCount`, `createdAt`, `updatedAt`, and optional `lastError`.
- `status` is `'pending' | 'syncing' | 'quota-paused' | 'conflict' | 'failed'`.
- `stageRateOperation(uid, input): Promise<PendingRateOperation>` stores the queue item and applies its optimistic mutations to the local `rates` store in one IndexedDB transaction.
- `getPendingRateOperations(uid): Promise<PendingRateOperation[]>` and `subscribeToRateWriteQueue(uid, listener): () => void` expose the queue to the worker and UI.
- `subscribeToLocalRateChanges(uid, listener): () => void` notifies `useCommissionRates` to reload the optimistic UID snapshot after local stage or server acknowledgement.
- `updatePendingRateOperation(uid, operationId, patch): Promise<void>` updates sync state without changing its stable ID.
- `finishPendingRateOperation(uid, operationId, canonicalRates): Promise<void>` stores server-confirmed rates and removes the completed queue item atomically.

- [ ] **Step 1: Add failing IndexedDB tests** for queue persistence, UID isolation, queue-plus-rate atomic staging, create/edit/delete/re-key optimistic snapshots, and transaction failure leaving neither half committed.
- [ ] **Step 2: Run** `npm test -- --run src/services/localRateDatabase.test.ts src/services/rateWriteQueue.test.ts`; confirm new queue API tests fail first.
- [ ] **Step 3: Add `pendingRateOperations` to the UID database** and bump its IndexedDB version while preserving every existing store and import record.
- [ ] **Step 4: Implement `stageRateOperation`, status updates, queue reads, and same-account tab notification**. Coalesce unsent updates by rate while preserving original `baseFields`; cancel an unsent create followed by delete.
- [ ] **Step 5: Subscribe Admin's `useCommissionRates` to local snapshot changes** so the dashboard reflects queued creates, edits, deletes, and server acknowledgements without a reload.
- [ ] **Step 6: Run the focused tests**; expect all queue persistence, atomicity, coalescing, and isolation cases to pass.
- [ ] **Step 7: Commit** the local queue model and tests with `feat: persist local rate write operations`.

### Task 2: Build the grouped, idempotent Firestore package writer

**Files:**
- Create: `src/services/rateWriteSyncService.ts`
- Test: `src/services/rateWriteSyncService.test.ts`
- Modify: `src/services/rateChangeFeed.ts`
- Test: `src/services/rateChangeFeed.test.ts`
- Modify: `src/services/rateReadModels.ts`
- Test: `src/services/rateReadModels.test.ts`
- Modify: `src/utils/auditLogger.ts`
- Test: `src/utils/auditLogger.test.ts` (create if no test exists)
- Create: `src/utils/firestoreData.ts`
- Modify: `src/services/adminRateWriteService.ts` (re-export `sanitizeFirestoreData` from `firestoreData.ts` to preserve current imports)

**Interfaces:**
- `appendRateDeltas(scope, deltas): Promise<void>` appends a bounded group of feed entries in one transaction per scope and is idempotent by each delta's existing operation marker.
- `syncRateReadModelsBatch(mutations, operationId): Promise<void>` applies Staff/eligible Agent projection updates and re-key/delete cleanup in bounded batches, then appends grouped role feed deltas.
- `syncRateOperation(operation): Promise<'synced' | 'conflict'>` checks staged base values against current canonical records and atomically applies the bounded canonical package with a Firestore transaction; it records resumable phase progress using the stable operation ID.
- `logRateChanges(entries, operationId): Promise<void>` writes deterministic audit entries for a package without one request per changed field.
- `sanitizeFirestoreData` remains exported from `adminRateWriteService.ts` for existing consumers, with implementation moved to `src/utils/firestoreData.ts` to avoid a service dependency cycle.

- [ ] **Step 1: Write failing writer tests** for guidance-only `update` payloads, conflict without writes, re-key collision, bounded package chunking, projection/feed propagation, and retry after a canonical commit with a lost response.
- [ ] **Step 2: Write failing feed tests** proving a group creates ordered sequence numbers, writes each marker once, and safely retries the same operation IDs.
- [ ] **Step 3: Run** `npm test -- --run src/services/rateWriteSyncService.test.ts src/services/rateChangeFeed.test.ts src/services/rateReadModels.test.ts`; verify the new assertions fail against current per-rate paths.
- [ ] **Step 4: Implement grouped feed and projection writes** with existing role visibility and eligible Agent payout rules; group by feed scope and keep every Firestore batch below 500 writes.
- [ ] **Step 5: Implement `syncRateOperation`**: in one Firestore transaction per bounded canonical package, compare affected documents with staged base values and atomically write the canonical patches plus phase marker; compare only fields in `baseFields` for updates and the stored fingerprint for deletes; use minimal update fields when IDs match; handle ID changes as delete-plus-create; reject a package that would exceed the transaction write limit.
- [ ] **Step 6: Implement deterministic grouped audit/notice support** and move the sanitizer without changing existing exports.
- [ ] **Step 7: Run focused writer/feed/projection tests**; expect conflict, duplicate, idempotency, and propagation assertions to pass.
- [ ] **Step 8: Commit** the package writer and tests with `feat: sync rate changes in idempotent packages`.

### Task 3: Route all interactive rate edits through the local queue

**Files:**
- Modify: `src/services/adminRateWriteService.ts`
- Test: `src/services/adminRateWriteService.test.ts`
- Modify: `src/components/AddRateModal.tsx`
- Modify: `src/components/EditRateModal.tsx`
- Modify: `src/components/BatchEditModal.tsx`
- Modify: `src/components/MasterTable.tsx`
- Test: `src/components/MasterTable.test.tsx`
- Modify: `src/components/MigrateIntakeModal.tsx`
- Modify: `src/components/settings/IntakeMigrationTab.tsx`
- Modify: `src/components/settings/DatabaseExplorer.tsx`
- Test: corresponding component tests where present; add focused tests for missing save flows.

**Interfaces:**
- `queueRateOperation(uid, input): Promise<PendingRateOperation>` stages a package locally and signals the worker; it does not wait for Firestore.
- `createRate`, `updateRate`, `updateRates`, and `deleteRates` use `queueRateOperation` for interactive Admin changes and return after durable local staging.
- `writeRateOperation` remains the online import executor for `src/utils/firestoreBatcher.ts`; imports remain outside this change.

- [ ] **Step 1: Add failing component/service tests** for instant local confirmation, duplicate checks including queued creates, batch edit patch generation, and queue submission for create/edit/delete.
- [ ] **Step 2: Add failing MasterTable tests** proving university save, guidance, aggregator, selected delete, and single delete use the shared queue path and no longer call Firestore `writeBatch` directly.
- [ ] **Step 3: Run** focused component/service tests and verify they fail on current direct-write handlers.
- [ ] **Step 4: Implement queue wrappers** while keeping import callers on `writeRateOperation`; preserve existing rate IDs for edits that do not change ID-defining fields and use explicit re-key mutations when they do.
- [ ] **Step 5: Replace direct MasterTable writes** with queued mutations. Preserve the separate default-intake preference behavior; only commission rate records enter this queue.
- [ ] **Step 6: Update modal copy and completion callbacks** so forms close only after durable local staging and report “Saved locally — waiting to sync”; local persistence failure keeps the form open and visible.
- [ ] **Step 7: Run affected component/service tests** and verify no interactive rate mutation path bypasses the queue.
- [ ] **Step 8: Commit** the interactive rate entry-point changes with `feat: queue interactive rate edits locally`.

### Task 4: Add foreground sync lifecycle and Admin dashboard basket

**Files:**
- Create: `src/hooks/usePendingRateChanges.ts`
- Test: `src/hooks/usePendingRateChanges.test.ts`
- Create: `src/components/RateChangeBasket.tsx`
- Test: `src/components/RateChangeBasket.test.tsx`
- Modify: `src/components/AppLayout.tsx`
- Test: `src/components/AppLayout.test.tsx`
- Modify: `src/components/DashboardView.tsx`
- Test: `src/components/DashboardView.test.tsx`

**Interfaces:**
- `usePendingRateChanges(uid, enabled)` returns `{ operations, pendingCount, syncState, retry(operationId), discard(operationId), resolveConflict(operationId, resolution) }`, where resolution is `'keep-cloud' | 'apply-local'`.
- `RateChangeBasket` receives only Admin-owned pending operation summaries and handlers; it does not receive raw commission payloads for other roles.
- Worker calls `syncRateOperation`, records status changes, retains conflict/failed operations, and calls `finishPendingRateOperation` only after canonical, projection, feed, and audit phases are acknowledged.

- [ ] **Step 1: Add failing hook tests** for app-start/online queue flush, quota-paused retention until retry time, bounded exponential retry for temporary network errors, and conflict/failed status persistence.
- [ ] **Step 2: Add failing basket tests** for pending/syncing/quota/conflict/failed counts, retry, discard-before-sync, conflict choices, and no payload visibility outside Admin.
- [ ] **Step 3: Run** `npm test -- --run src/hooks/usePendingRateChanges.test.ts src/components/RateChangeBasket.test.tsx src/components/AppLayout.test.tsx`; verify lifecycle and basket tests fail before implementation.
- [ ] **Step 4: Implement the foreground worker** triggered by app startup, queue change, `online`, and quota retry time; prevent concurrent flushes for the same UID and retain the same operation ID after ambiguous failures.
- [ ] **Step 5: Implement Admin basket in `DashboardView`** and wire it from `AppLayout` only for Admin, including local-vs-synced copy and clear failure reasons. `keep-cloud` drops the staged change and restores the canonical cache; `apply-local` refreshes the base values from the cloud before explicit retry.
- [ ] **Step 6: Run focused hook, basket, and AppLayout tests**; expect queue lifecycle and role visibility tests to pass.
- [ ] **Step 7: Commit** the lifecycle and basket with `feat: show and sync pending rate changes`.

### Task 5: Integrated verification and recovery review

**Files:**
- Test: all new queue, writer, hook, basket, modal, and MasterTable tests.
- Review: all interactive rate mutation call sites and existing import flow.

- [ ] **Step 1: Run** `npm test -- --run`; expect all unit/component tests to pass.
- [ ] **Step 2: Run** `npm run test:rules`; expect all Firestore role-boundary tests to pass.
- [ ] **Step 3: Run** `npm run build`; expect TypeScript and Vite production build to complete.
- [ ] **Step 4: Run** `git diff --check` and search for direct `rates` writes in included UI mutation paths; only the shared writer should perform those writes.
- [ ] **Step 5: Review recovery cases**: quota errors never clear local operations, per-UID cache switch cannot leak pending content, conflicts are explicit, and retry after ambiguous success has no duplicate side effects.
- [ ] **Step 6: Commit** final integration fixes with `fix: verify local-first rate write recovery` if any are required.
