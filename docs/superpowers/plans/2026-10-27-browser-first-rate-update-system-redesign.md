# Admin Rate Change Packages Implementation Plan

> **For agentic workers:** Implement task-by-task in the current main tree using the native execution approach selected earlier. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Admin rate edits local until explicit upload, then publish selected edits as an immutable logical package that authorized devices apply to their local role-scoped data.

**Architecture:** IndexedDB stores a baseline plus individually discardable ordered changes. Admin publishes the selected change IDs to an immutable package log and advances a role-scoped head only after the payload is complete. Other clients listen to the small head, fetch only new package data, validate it, and atomically apply it locally. Package log and checkpoints become the durable source for ordinary rate edits; legacy rate collections remain for bootstrap/import/compatibility only during migration.

**Tech Stack:** React, TypeScript, Firebase Firestore Web SDK, Firestore Security Rules, IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-27-rate-update-system-redesign-design.md`

## Global Constraints

- Rate edits do not write to Firestore until an Admin confirms Upload.
- The header count represents pending local change entries, not records or Firestore writes.
- Upload and discard require confirmation and operate only on selected, unpublished changes.
- A published head never points at an incomplete package; retries reuse stable package IDs.
- Other clients listen only to their authorized package head(s), not every rate document.
- Admin, Staff, and Agent package payloads remain role-scoped; Agent data excludes master rates, margins, and Admin-only route defaults.
- Firestore document, batch, transaction, and read/write billing limits apply; one logical package is not necessarily one billed document write.
- Do not introduce Cloud Functions, callable APIs, hosted workers, or automatic upload retries.
- Preserve current IndexedDB data and pending operations during migration; do not auto-publish legacy pending items.
- Work in the current main tree and native execution approach; do not create a worktree or delegate.

## Review Focus

- Discard one earlier edit while a later edit changes the same field: recomputed local value must retain the later edit.
- An upload response is lost after head publication: retry must detect the same package and not duplicate it.
- A package payload chunk is missing or corrupt: the head must not advance and recipients must not apply partial data.
- A Staff or Agent head points to a package with a mismatched scope/schema: reject it without changing local data or leaking Admin fields.
- An offline or long-disconnected client misses several heads: catch up from its cursor/checkpoint without skipping or applying a package twice.

## File Map

- Modify `src/types/rateWriteQueue.ts`: define individually discardable local changes, selected package lifecycle, package manifest, cursor, and role-safe payload types.
- Modify `src/services/localRateDatabase.ts`: add IndexedDB stores for local changes, published package cache/cursors, and checkpoint metadata; expose atomic stage/select/discard/acknowledge/apply operations; bump DB version without dropping existing stores.
- Modify `src/services/rateWriteQueue.ts`: replace operation-level staging assumptions with ordered change-entry APIs while retaining migration/read compatibility for old queue entries.
- Create `src/services/ratePackageService.ts`: validate selected changes, build deterministic package/chunks, publish immutable payload and manifest/head, inspect ambiguous result, and expose upload result.
- Create `src/services/ratePackageDeliveryService.ts`: subscribe to authorized package heads, fetch packages after a cursor, validate scope/order/schema, and coordinate catch-up/checkpoints.
- Create `src/services/ratePackageApplyService.ts`: apply a validated package or checkpoint atomically to local role-scoped stores and advance cursor only in the same successful local transaction.
- Modify `src/services/rateSyncService.ts` and `src/hooks/useCommissionRates.ts`: keep first-time baseline bootstrap, overlay package history from its checkpoint, consume local package updates, and remove rate-feed/per-rate synchronization from ordinary package propagation.
- Modify `src/hooks/usePendingRateChanges.ts`: remove automatic flush, online-triggered upload, retry timer, and quota auto-retry; expose pending entries, selection, upload, and confirmed-discard operations.
- Modify `src/components/AppLayout.tsx` and `src/components/RateChangeBasket.tsx`: header pending badge; selectable change list; selected Upload/Discard actions; confirmations and honest local/publishing/published/catch-up states.
- Modify `firestore.rules`: authorize Admin package writes and constrain Staff/Agent reads to their safe package scope; preserve existing role and Agent organization checks.
- Modify interactive mutation entry points in `src/services/adminRateWriteService.ts`, `src/components/AddRateModal.tsx`, `src/components/EditRateModal.tsx`, `src/components/BatchEditModal.tsx`, `src/components/MasterTable.tsx`, `src/components/settings/DatabaseExplorer.tsx`, and `src/components/settings/IntakeMigrationTab.tsx` so all ordinary Admin mutations stage locally.
- Inspect direct rate readers/export paths including `src/hooks/useCommissionRates.ts`, `src/services/rateSnapshot.ts`, `src/components/settings/DatabaseExplorer.tsx`, and `src/utils/firestoreBatcher.ts`; migrate ordinary views to materialized local package state or explicitly retain a documented bootstrap/repair path.
- Preserve import, export, audit, and repair behavior while deciding and implementing how imports advance package cursors; do not leave a normal mutation bypass.

## Task 1: Define package schema, role scopes, and local change model

**Files:** `src/types/rateWriteQueue.ts`; create `src/types/ratePackages.ts`; inspect `src/types/index.ts`, `src/services/rateChangeFeed.ts`, and `firestore.rules`.

**Interfaces:** Define `RatePackageScope = 'admin' | 'staff' | 'agent' | `org_${string}` | `user_${string}``; `LocalRateChange` with stable `changeId`, `uid`, ordered `createdAt`, target ID, compact mutation, before/after patch, and `status: 'pending' | 'selected' | 'publishing'`; `RatePackageManifest` with stable `packageId`, `scope`, `baseCursor`, `cursor`, `schemaVersion`, `chunkIds`, `changeIds`, and `createdAt`; and `RatePackagePublishResult` with `packageId`, affected scopes, and cursor map.

- [ ] **Step 1: Trace mutations and role projection shapes.** Inventory create/update/delete/re-key/default/guidance/intake operations and map Admin, Staff, Agent, org override, and personal override data shapes to package-safe payload builders.
- [ ] **Step 2: Define deterministic package semantics.** Specify ordered composition for selected changes to the same rate, ID collision behavior, delete/re-key representation, package/checkpoint path names, chunk-size target below Firestore's 1 MiB document limit, and an operation-count ceiling below Firestore batch limits.
- [ ] **Step 3: Define cursor/head schema and security predicates.** Specify the minimum metadata exposed to each role and how Firestore rules validate Admin publication and Staff/Agent scope reads without exposing Admin package variants.
- [ ] **Step 4: Commit** as `feat: define rate package contracts`.

## Task 2: Persist locally staged edits and support per-change discard

**Files:** `src/services/localRateDatabase.ts`, `src/services/rateWriteQueue.ts`, `src/types/rateWriteQueue.ts`.

**Interfaces:** Add `stageLocalRateChange(uid, change): Promise<LocalRateChange>`, `getLocalRateChanges(uid): Promise<LocalRateChange[]>`, `discardLocalRateChanges(uid, changeIds): Promise<void>`, and `acknowledgePublishedRateChanges(uid, packageId, changeIds): Promise<void>`. Staging and discard update the materialized Admin local view and change log in one IndexedDB transaction; publication acknowledgment removes only the acknowledged IDs.

- [ ] **Step 1: Upgrade IndexedDB without data loss.** Add the change-log and package cursor stores; retain all existing stores and migrate old queued operations into individually recoverable local entries with no automatic upload.
- [ ] **Step 2: Implement ordered local materialization.** Apply baseline plus local changes in creation order; preserve separate change IDs even when multiple changes target the same field/rate.
- [ ] **Step 3: Implement selected discard and publication acknowledgment.** Recompute affected records from baseline plus remaining entries; keep unselected entries and later edits unchanged.
- [ ] **Step 4: Preserve cross-tab updates.** Emit local change notifications after IndexedDB commits and ensure a second tab reloads the same materialized view and pending count.
- [ ] **Step 5: Commit** as `feat: persist local rate change entries`.

## Task 3: Replace the auto-sync basket with explicit local change controls

**Files:** `src/hooks/usePendingRateChanges.ts`, `src/components/RateChangeBasket.tsx`, `src/components/AppLayout.tsx`.

**Interfaces:** `usePendingRateChanges(uid, enabled)` returns `{ changes, selectedChangeIds, pendingCount, publishingPackageId, deliveryState, selectChanges(ids), uploadSelected(), discardSelected(ids) }`. `uploadSelected` and `discardSelected` require the UI to confirm first; the hook never uploads due to mounting, local edits, browser-online events, timers, or quota state.

- [ ] **Step 1: Remove automatic flush behavior.** Delete mount/local-change/online/quota retry triggers from the Admin pending hook; retain only local change subscription and explicit upload invocation.
- [ ] **Step 2: Add selection state and actions.** Support one, several, and all pending entries; ignore already-published/actively-publishing entries.
- [ ] **Step 3: Update header badge and basket content.** Show pending entry count and each entry's school, route, fields, before/after values, local status, and creation order where available.
- [ ] **Step 4: Add confirmation and feedback.** Confirm selected count and action for Upload and Discard; close/deselect without mutating when canceled; show “Saved on this device,” “Publishing package,” “Published,” or actionable failure.
- [ ] **Step 5: Commit** as `feat: add explicit rate change basket actions`.

## Task 4: Publish immutable packages with an atomic visibility boundary

**Files:** create `src/services/ratePackageService.ts`; modify `src/services/rateChangeFeed.ts` only to retire or bridge old feed writes; modify `firestore.rules`; modify `src/types/ratePackages.ts`.

**Interfaces:** Add `publishRateChangePackage(input: { uid: string; changeIds: string[]; packageId: string }): Promise<RatePackagePublishResult>`. It reads the current authorized base/head, composes selected patches, writes immutable role-safe payload chunks, then advances each affected role head only after every required package component exists. Repeating the same `packageId` returns the already-published result.

- [ ] **Step 1: Implement package building.** Produce Admin, Staff, and Agent/org/personal variants from the selected changes; exclude protected fields from role variants and reject unsupported or colliding mutations before writing.
- [ ] **Step 2: Enforce package bounds.** Chunk deterministic payloads below the chosen document-size target and enforce package/batch operation limits. Reject oversized selection before publishing any head.
- [ ] **Step 3: Implement immutable payload and head publication.** Write payload first; publish manifest/head last. Use a stable package ID and base cursor so ambiguous responses can be inspected/retried without duplicate publication.
- [ ] **Step 4: Add package Firestore rules.** Permit only approved Admin to write payloads/manifests/heads; permit Staff/Agent reads only for role and organization scopes; deny client mutation of already-published package payloads.
- [ ] **Step 5: Record audit details with the package.** Persist actor, change IDs, and before/after patch summary in the immutable Admin package metadata without exposing that metadata to Staff/Agents.
- [ ] **Step 6: Commit** as `feat: publish role-scoped rate packages`.

## Task 5: Deliver packages to authorized clients and recover cursors

**Files:** create `src/services/ratePackageDeliveryService.ts` and `src/services/ratePackageApplyService.ts`; modify `src/services/rateSyncService.ts`, `src/hooks/useCommissionRates.ts`, and `src/services/localRateDatabase.ts`.

**Interfaces:** Add `subscribeToRatePackageHead(scope, onHead, onError): Unsubscribe`, `getRatePackagesAfter(scope, cursor): Promise<RatePackageEnvelope[]>`, `applyRatePackage(uid, scope, envelope): Promise<void>`, and `syncRatePackages(scope): Promise<void>`. Local package data and its cursor advance atomically only after full envelope validation and application.

- [ ] **Step 1: Implement head-only subscriptions.** Subscribe to only the current user's allowed role head(s); tear down on logout, role/access change, Agent organization change, or unmount.
- [ ] **Step 2: Implement cursor catch-up.** Fetch package manifests/chunks after the local cursor; detect gaps and apply in order. Use a role-authorized checkpoint when retained package history no longer covers the cursor.
- [ ] **Step 3: Validate and apply atomically.** Verify package ID, scope, cursor continuity, schema, chunk completeness, and payload field allowlists before changing local rate stores; do not advance cursor on any failure.
- [ ] **Step 4: Refresh current pages from local package state.** Ensure Admin, Staff, and Agent tables/cards read materialized local data and update after package application without reload; preserve Agent override merging and role field restrictions.
- [ ] **Step 5: Replace ordinary feed delivery.** Stop writing/reading per-mutation rate feed deltas for the new ordinary package path while retaining a guarded compatibility/catch-up path for pre-migration data.
- [ ] **Step 6: Commit** as `feat: apply published rate packages to local views`.

## Task 6: Route every ordinary Admin mutation through local staging

**Files:** `src/services/adminRateWriteService.ts`, `src/components/AddRateModal.tsx`, `src/components/EditRateModal.tsx`, `src/components/BatchEditModal.tsx`, `src/components/MasterTable.tsx`, `src/components/settings/DatabaseExplorer.tsx`, `src/components/settings/IntakeMigrationTab.tsx`, `src/utils/firestoreBatcher.ts`.

**Interfaces:** Keep public create/update/delete wrapper signatures where practical, but their ordinary Admin paths call `stageLocalRateChange` and return after the local IndexedDB commit. Only the basket's explicit Upload action calls `publishRateChangePackage`. Imports/repairs must either publish package changes through a guarded shared path or remain explicitly documented maintenance workflows with cursor reconciliation.

- [ ] **Step 1: Inventory each writer and reader.** Trace every interactive mutation and every route/rate view that reads directly from Firestore; assign it to local staging, package publishing, baseline/bootstrap, import, or repair.
- [ ] **Step 2: Route create/edit/delete/re-key and route metadata actions to staging.** Preserve validation, stable IDs, local optimistic update, edit history, and true collision errors.
- [ ] **Step 3: Route batch/default/guidance/intake actions to individually identifiable changes.** Ensure the Admin can select or discard each resulting change and upload selected entries as one package.
- [ ] **Step 4: Reconcile imports and explicit repairs.** Ensure their resulting state advances or rebuilds the package checkpoint/cursor; prevent a legacy Firestore write from silently diverging from package state.
- [ ] **Step 5: Remove ordinary per-rate and auto-flush writes.** Search all mutation call sites to confirm that a normal edit cannot write canonical rate/projection documents or publish without user confirmation.
- [ ] **Step 6: Commit** as `refactor: stage admin rate edits locally`.

## Task 7: Add checkpointing, recovery, and safe rollout

**Files:** `src/services/ratePackageService.ts`, `src/services/ratePackageDeliveryService.ts`, `src/services/rateSyncService.ts`, `src/services/localRateDatabase.ts`, `firestore.rules`, and any direct local/package readers found in Task 6.

**Interfaces:** Add `publishRatePackageCheckpoint(scope): Promise<RatePackageCheckpoint>` for an explicit/controlled maintenance path and `recoverPendingRateChanges(uid): Promise<LocalRateChange[]>` for non-destructive IndexedDB migration/recovery. Checkpoint publication advances the minimum retained cursor only after the role-scoped snapshot is readable.

- [ ] **Step 1: Implement checkpoint bootstrap and retention.** Load authorized checkpoint then replay newer packages; retain package history needed by active/known cursors and define explicit fallback for stale devices.
- [ ] **Step 2: Recover ambiguous and interrupted uploads.** On app start, reconcile local `publishing` entries against the stable package ID/head; mark published only if the head confirms it, otherwise leave changes available for explicit retry.
- [ ] **Step 3: Preserve legacy local queue entries.** Convert stale `pending`, `syncing`, `failed`, and `conflict` operations into recoverable local changes with a clear review state; do not silently discard or upload them.
- [ ] **Step 4: Inspect migration and access rules.** Confirm package path read/write constraints for Admin, Staff, Agent, and organization access; verify existing page selectors cannot bypass role-scoped local package views.
- [ ] **Step 5: Review diff and build.** Run `git diff --check` and `npm run build`; report any unrelated pre-existing warnings separately. Do not run tests unless the user separately requests test/verification work.
- [ ] **Step 6: Commit** as `feat: recover and checkpoint rate packages`.

## Execution Notes

- Package head is the publication boundary. Payload/chunks written without a head are invisible and may be cleaned up later through explicit maintenance.
- Firestore batches are atomic only within Firestore's documented limits; large logical packages require staged immutable chunks plus a final visibility boundary. Confirm the exact limits and rules implementation against the SDK/rules behavior before choosing constants.
- Firestore billed writes are per written document, even when calls are grouped. Track package payload, manifest, head, audit, and checkpoint writes separately.
- A client's local package is updated from its role-safe variant. Do not let Staff or Agent clients materialize Admin package contents.
- Offline Admin edits remain pending indefinitely until an Admin explicitly uploads or discards them.
- Use the main checkout and preserve unrelated working-tree changes.
