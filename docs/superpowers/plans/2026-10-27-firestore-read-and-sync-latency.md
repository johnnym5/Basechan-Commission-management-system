# Firestore Read and Sync Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate routine full-collection reads for cached Admins, remove full rate-cache rebuilds from ordinary edits, and make the first online sync attempt start immediately.

**Architecture:** Reuse the existing Admin-scoped `rate_change_feeds/admin` sequence feed and the local rate snapshot instead of introducing another feed. New or legacy caches without a trustworthy Admin cursor take one full canonical snapshot and establish a cursor; valid caches read only delta pages and apply included canonical records. Rate mutations update only affected sheet buckets and existing role projections/feeds; retries remain only for failed attempts and their next retry is visible in the basket.

**Tech Stack:** React hooks, TypeScript, Firebase Firestore transactions/queries/security rules, IndexedDB, Vitest, Firebase Rules Unit Testing.

**Spec:** `docs/superpowers/specs/2026-10-27-firestore-read-and-sync-latency-design.md`

## Global Constraints

- Local-first edits remain durable in IndexedDB before being reported as saved.
- A successful local save is visible immediately to the Admin; other users see it only after Firestore accepts and publishes the change.
- Normal cached startup must not read `rates` or all `rate_sheets`.
- A single edit must not call `partitionMasterIntoRateSheets` or read the full `rates` collection.
- The first sync attempt starts immediately when online and not quota-paused; automatic backoff applies only after an actual failure.
- Only Admins can read canonical `rates` and the Admin change feed; Staff and Agents remain on their role-specific authorized projections.
- Agent projections must not expose master rates, margins, or Admin-only default metadata.
- Keep full snapshot/rebuild as explicit bootstrap or repair behavior, not routine sync behavior.

## Review Focus

- Existing IndexedDB cache has no trustworthy Admin cursor: bootstrap once, avoid skipping changes during snapshot, and persist the recovered cursor.
- Feed entry is an upsert but its embedded record is absent or malformed: do not advance the local cursor past unapplied data; report/recover safely.
- A re-key or source-sheet move touches two IDs or buckets: remove the old value and apply the new value exactly once, including on retry.
- Two Admin operations touch the same bucket concurrently: transaction/version protection prevents lost bucket updates.
- Admin feed access is denied to Staff and Agents, and feed payloads preserve the Agent/Staff field boundaries.

---

## File Map

- Modify `src/services/rateSyncService.ts`: Admin cursor bootstrap, delta-only cached sync, and full snapshot recovery.
- Modify `src/services/rateChangeFeed.ts`: use embedded canonical Admin records without a redundant `getDoc`; preserve role-feed hydration behavior.
- Modify `src/services/localRateDatabase.ts`: persist Admin feed initialization/cursor atomically with the applied local snapshot and deltas.
- Modify `src/hooks/useCommissionRates.ts`: route Admin startup/refresh through the local snapshot and delta sync; retain legacy cache fallback only during migration/recovery.
- Modify `src/services/rateReadModels.ts`: add idempotent transaction-based updates for only affected `rate_sheets` buckets; retain `partitionMasterIntoRateSheets` for Data Health repair.
- Modify `src/services/rateWriteSyncService.ts`: use targeted bucket maintenance in normal operation and remove the unconditional full collection rebuild.
- Modify `src/types/rateWriteQueue.ts`, `src/hooks/usePendingRateChanges.ts`, and `src/components/RateChangeBasket.tsx`: track/display attempt time and next automatic retry; preserve immediate first attempt and immediate manual retry.
- Modify `src/utils/groupingUtils.ts` and `src/components/RoleDashboardView.tsx`: preserve safe zero-valued Staff route rows in grouped dashboard cards.
- Modify `src/services/adminRateWriteService.ts` and `src/services/userUpdates.ts`: classify Admin default-route changes as Staff recommended-route notices without changing Agent-visible notifications.
- Extend `src/services/rateSyncService.test.ts`, `src/services/rateChangeFeed.test.ts`, `src/services/rateWriteSyncService.test.ts`, `src/hooks/usePendingRateChanges.test.ts`, and `src/components/RateChangeBasket.test.tsx` for the behaviors owned by those modules.
- Extend `src/utils/groupingUtils.test.ts`, `src/components/RoleDashboardView.test.tsx`, `src/services/adminRateWriteService.test.ts`, and `src/services/userUpdates.test.ts` for Staff route visibility and recommended-route notices.
- Extend `tests/firestoreRules.test.ts` only if the existing Admin-only feed rule lacks direct role assertions; no new permission surface is intended.

## Task 1: Admin Delta Sync and Safe Cache Bootstrap

**Files:** `src/services/rateSyncService.ts`, `src/services/localRateDatabase.ts`, `src/hooks/useCommissionRates.ts`, `src/services/rateSyncService.test.ts`, `src/services/localRateDatabase.test.ts`.

**Interfaces:** Reuse `syncLocalRateData(scope: RateScope)` and existing `RateDelta`/`LocalRateMetadata`. Add one explicit Admin feed cursor initialization field or equivalent metadata marker; do not add a second feed collection.

- [ ] **Step 1: Add tests for cached Admin startup.** Assert a complete cache with a matching cursor reads only the Admin feed cursor, does not call `getDocs(collection(db, 'rates'))` or read `rate_sheets`, and returns local rates. Assert a changed cursor reads only delta pages and applies them locally.
- [ ] **Step 2: Add a bootstrap race test.** For an incomplete or legacy cache without a trusted cursor, assert the service reads the cursor before fetching the canonical snapshot, then applies feed entries after that cursor before declaring the local snapshot complete.
- [ ] **Step 3: Run the focused tests and confirm the new assertions fail.** Run `npm test -- src/services/rateSyncService.test.ts` and the local database test file covering snapshot metadata.
- [ ] **Step 4: Implement the Admin bootstrap/cursor path.** Make cached Admin sync use `syncLocalRateData`; keep full canonical reads only for absent/incomplete cache or explicit recovery. Apply snapshot and cursor initialization consistently so a crash cannot mark a partial snapshot complete.
- [ ] **Step 5: Route Admin refresh through that path.** Update `useCommissionRates` so a valid local Admin rates snapshot is shown immediately and refresh performs cursor/delta sync rather than `syncRateSheetsCacheFirst`. Preserve role scoping and existing Agent/Staff paths.
- [ ] **Step 6: Run focused tests.** Run `npm test -- src/services/rateSyncService.test.ts` plus the affected local database tests. Expected: unchanged cache makes no canonical or sheet collection read; changed cache applies only feed deltas; bootstrap catches concurrent changes.
- [ ] **Step 7: Commit.** `git add src/services/rateSyncService.ts src/services/localRateDatabase.ts src/hooks/useCommissionRates.ts src/services/rateSyncService.test.ts <affected local database test>` then commit as `perf: sync cached admin rates from change feed`.

## Task 2: Avoid Per-Delta Canonical Reads and Preserve Role Boundaries

**Files:** `src/services/rateChangeFeed.ts`, `src/services/rateChangeFeed.test.ts`, `src/services/localRateDatabase.ts`, `tests/firestoreRules.test.ts` if needed.

**Interfaces:** Keep `readRateDeltas(scope, after, pageSize)` and `hydrateRateDelta(scope, delta)` signatures unless a clear typed split is needed. Admin feed upserts already carry canonical records from `adminRateWriteService`; Staff/Agent feeds may continue hydrating when needed.

- [ ] **Step 1: Add a test for embedded Admin records.** Assert an Admin upsert with a full embedded record hydrates without calling `getDocFromServer`; a delete stays read-free.
- [ ] **Step 2: Add a regression test for role feeds.** Assert a role feed entry without an embedded record still uses the authorized projection lookup and existing normalization behavior.
- [ ] **Step 3: Implement the fast path.** Return a valid embedded record directly for Admin scope; keep missing/malformed Admin records from being silently skipped or cursor-committed.
- [ ] **Step 4: Verify access rules.** Assert Admin can read `rate_change_feeds/admin/changes/*`, while Staff and Agent cannot read Admin feed records. Assert existing Staff/Agent feed rules and payload field restrictions still pass.
- [ ] **Step 5: Run focused tests.** Run `npm test -- src/services/rateChangeFeed.test.ts` and `npm run test:rules` if rule assertions changed. Expected: Admin delta sync adds no per-rate document reads and role separation remains enforced.
- [ ] **Step 6: Commit.** `git add src/services/rateChangeFeed.ts src/services/rateChangeFeed.test.ts tests/firestoreRules.test.ts` (only if changed), commit as `perf: apply embedded admin rate deltas without extra reads`.

## Task 3: Incremental Sheet Bucket Updates During Rate Writes

**Files:** `src/services/rateReadModels.ts`, `src/services/rateWriteSyncService.ts`, `src/services/rateWriteSyncService.test.ts`, rate-read-model tests.

**Interfaces:** Add `updateRateSheetBucketsForMutations(mutations: RateWriteMutation[], userEmail: string): Promise<void>` in `rateReadModels.ts`. It updates bucket arrays transactionally by `sourceSheet || intake`, removes old IDs, upserts next records, and updates `rateCount`/metadata. It is idempotent for retries. Keep `partitionMasterIntoRateSheets()` for explicit Data Health repair only.

- [ ] **Step 1: Add tests for targeted bucket behavior.** Cover same-sheet field update, delete, re-key, source-sheet move, repeated operation retry, absent bucket behavior, and two mutations sharing one bucket. Assert unrelated bucket documents are never read or written.
- [ ] **Step 2: Run the focused rate-read-model tests and confirm failures.** Run `npm test -- src/services/rateReadModels.test.ts` (or the existing test file containing bucket helpers).
- [ ] **Step 3: Implement the transaction helper.** Group mutations by old/new sheet keys, read only those bucket documents, apply remove/upsert by canonical rate ID, and write each affected bucket once. Use a Firestore transaction to avoid concurrent lost updates; handle an absent bucket without fabricating an incomplete full-sheet snapshot.
- [ ] **Step 4: Replace the full rebuild in `syncRateOperation`.** Call the targeted helper after canonical commit and before clearing the local queue. Do not call `partitionMasterIntoRateSheets` in the ordinary sync path. Keep queue status failed if bucket maintenance or required projections fail so the idempotent operation can resume.
- [ ] **Step 5: Update sync tests.** Assert one mutation invokes the targeted helper for only its affected sheet, and `partitionMasterIntoRateSheets` is never called. Assert a targeted bucket failure leaves the operation queued.
- [ ] **Step 6: Run focused tests.** Run the rate-read-model and `rateWriteSyncService` tests. Expected: normal edit has no full `rates` read; repair function remains callable from Data Health.
- [ ] **Step 7: Commit.** Commit as `perf: update only affected rate sheet buckets`.

## Task 4: Immediate First Attempt and Understandable Retry State

**Files:** `src/types/rateWriteQueue.ts`, `src/hooks/usePendingRateChanges.ts`, `src/components/RateChangeBasket.tsx`, their tests.

**Interfaces:** Add optional `lastAttemptAt?: string` and `nextRetryAt?: string` to `PendingRateOperation` and its patch type. Queue status remains `pending | syncing | quota-paused | conflict | failed | cancelled` unless implementation demonstrates a distinct retry-scheduled status is required. Manual retry clears `nextRetryAt` and starts immediately.

- [ ] **Step 1: Add hook tests.** Assert a newly staged local change triggers `syncRateOperation` without fake-timer advancement; assert a failed first attempt records `lastAttemptAt`, `lastError`, and a future `nextRetryAt`; assert manual retry invokes sync immediately and clears scheduled retry.
- [ ] **Step 2: Add basket tests.** Assert the popover displays a concise retry countdown or next retry time and the last error for failed/pending retry operations; pending-success behavior remains unchanged.
- [ ] **Step 3: Run the focused hook and basket tests and confirm failures.** Run `npm test -- src/hooks/usePendingRateChanges.test.ts src/components/RateChangeBasket.test.tsx`.
- [ ] **Step 4: Implement first-attempt and retry metadata.** Ensure local-change notifications start `flush` without waiting for a separate timer; persist attempt timestamps and next retry deadline only after a failed online attempt. Quota pause uses quota retry timing and does not schedule normal exponential retries. Manual retry bypasses backoff.
- [ ] **Step 5: Run focused tests.** Run the hook and basket test files. Expected: first attempt needs no timer advance; automatic retry follows the existing bounded backoff; manual retry is immediate; quota remains paused.
- [ ] **Step 6: Commit.** Commit as `feat: expose rate sync retry timing`.


## Task 5: Staff Route Visibility and Recommended-Route Notices

**Files:** `src/utils/groupingUtils.ts`, `src/utils/groupingUtils.test.ts`, `src/components/RoleDashboardView.tsx`, `src/components/RoleDashboardView.test.tsx`, `src/services/adminRateWriteService.ts`, `src/services/adminRateWriteService.test.ts`, `src/services/userUpdates.ts`, `src/services/userUpdates.test.ts`.

**Interfaces:** Add an optional `includeUnpricedRoutes?: boolean` argument to `groupRatesByUniversity(rates, options?)` or an equivalently narrow explicit option. Add optional `recommendedRoute?: boolean` to `UpdateChange`; it affects notice copy only and does not expand persisted role data. A Staff default-route mutation is a `routing` update and is eligible for Staff notification; Agent recipients must not receive a default-only change.

- [ ] **Step 1: Add failing grouping tests.** Assert default grouping continues omitting unpriced Admin rows, while Staff dashboard grouping includes authorized zero-valued route rows. Assert the Staff dashboard shows a school for the fixture where masterRate and agentRate are both zero.
- [ ] **Step 2: Add failing notice tests.** Assert an `isDefaultRoute`-only mutation is classified as routing, produces a “Recommended route updated” Staff notice with the school name, and does not target Agents. Assert aggregator-only changes retain ordinary route-update copy.
- [ ] **Step 3: Run focused tests and confirm the expected failures.** Run `npm test -- src/utils/groupingUtils.test.ts src/components/RoleDashboardView.test.tsx src/services/adminRateWriteService.test.ts src/services/userUpdates.test.ts`.
- [ ] **Step 4: Implement Staff grouping support.** Allow the Staff dashboard to group rows even when role-safe rate values are zero. Keep the default helper behavior unchanged for Admin and Agent screens so unpriced records remain hidden there.
- [ ] **Step 5: Implement recommended-route notification classification and copy.** Include `isDefaultRoute` in update field classification and Staff-visible notification fields. Set the recommended-route notice flag only when the mutation changes default status; preserve existing `routing` copy for aggregator-only changes. Do not add default flags or master values to Agent payloads.
- [ ] **Step 6: Run focused tests.** Run the same four focused test files. Expected: Staff sees authorized route cards after selecting All; recommended-route changes notify Staff with clear copy; Agent notification eligibility is unchanged.
- [ ] **Step 7: Commit.** Commit as `fix: show staff routes and notify default changes`.
## Task 6: Full Verification and Regression Review

**Files:** affected code/tests from Tasks 1–5, plus any minimal fixes uncovered.

- [ ] **Step 1: Run focused suites together.** Run `npm test -- src/services/rateSyncService.test.ts src/services/rateChangeFeed.test.ts src/services/rateWriteSyncService.test.ts src/hooks/usePendingRateChanges.test.ts src/components/RateChangeBasket.test.tsx` and relevant local database/rate-read-model tests.
- [ ] **Step 2: Run Firestore rules tests.** Run `npm run test:rules`; expected: Admin-only canonical and feed access and Staff/Agent projection isolation pass.
- [ ] **Step 3: Run production build.** Run `npm run build`; expected: TypeScript and Vite production build succeed.
- [ ] **Step 4: Review call graph and search.** Confirm ordinary Admin sync has no `getDocs(collection(db, 'rates'))`, full `rate_sheets` query, or `partitionMasterIntoRateSheets` call when cache/cursor are valid. Confirm the repair action still calls the rebuild intentionally.
- [ ] **Step 5: Review Git diff.** Confirm no unrelated files or pre-existing user changes were staged; commit any focused fixes with clear messages.

## Execution Notes

- Implement natively in the current main tree, matching the user's earlier execution preference. Do not create a worktree or delegate.
- Existing unrelated modified files in the working tree must remain untouched and unstaged.
- Initial bootstrap/recovery may read all canonical rates once per device. The optimization target is routine cached use and one-record edits, not eliminating the initial snapshot.
- A console read graph is aggregate telemetry; final manual validation should compare a warm-cache startup and one edit separately from any bootstrap/recovery run.
