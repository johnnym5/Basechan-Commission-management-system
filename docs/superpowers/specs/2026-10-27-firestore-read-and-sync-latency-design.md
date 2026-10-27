# Firestore Read and Sync Latency Design

**Date:** 2026-10-27  
**Status:** Draft for user review  
**Supersedes:** The rate-cache rebuild and retry-latency portions of `2026-10-12-firestore-read-optimization-design.md` and `2026-10-19-local-first-rate-editing-design.md` where they conflict with this document.

## Goal

Reduce unnecessary Firestore reads and make each Admin rate change begin its server sync immediately when online. Local-first behavior remains: the Admin sees a successful local save as soon as IndexedDB commits it. Other users see the change after Firestore accepts and publishes it; network latency and Firestore service time cannot be guaranteed to be instantaneous.

Success means:

- Opening a school detail modal uses loaded/local data and does not fetch the full rate collection.
- A normal app open with a valid local cache performs only a small freshness check and reads only actual changes.
- A single rate edit never reads the full `rates` collection to refresh a materialized cache.
- A staged operation starts its first Firestore attempt without a debounce or artificial delay.
- Retry delay is applied only after a failed attempt, and the Admin can see the reason and next retry state.
- Staff projections and Agent payout projections retain their existing data boundaries.

## Current behavior and evidence

1. `useCommissionRates` loads the Admin cache and calls `syncRateSheetsCacheFirst` on startup, visibility restoration, and explicit refresh.
2. `syncRateSheetsCacheFirst` checks `settings/system_config`, but if the local timestamp is stale it reads the entire `rate_sheets` collection. If no usable buckets exist, it can fall back to fetching all canonical `rates` documents.
3. `syncRateOperation` applies a staged mutation, runs the projection pipeline, then calls `partitionMasterIntoRateSheets`. That function reads every document in `rates` and rebuilds the sheet buckets. Thus even one field edit causes a full collection read.
4. `usePendingRateChanges` invokes its flush as soon as local queue changes are observed. There is no pre-send debounce in that path. After failures, it retries with exponential delays beginning at 5 seconds (5, 10, 20, 40 seconds, capped at 5 minutes). A visible 30-second wait can therefore be processing time, repeated failure/backoff, or both; the UI must distinguish these states.
5. Opening a school modal itself does not issue a Firestore query; it consumes the already loaded rates. The high read bursts are consistent with background full-collection or full-bucket syncs, though console metrics alone cannot identify the exact trigger.

## Proposed design

### 1. Incremental Admin change feed

Add an Admin-scoped change feed or equivalent cursor-based delta source containing enough canonical rate data to apply each create, update, delete, and re-key to the Admin's local cache. Keep a durable cursor in IndexedDB. A normal startup will:

1. Load the complete local Admin snapshot immediately.
2. Read the lightweight server cursor/revision.
3. If unchanged, stop without fetching rate documents.
4. If changed, query only feed entries after the saved cursor, apply them locally, and advance the cursor only after local application succeeds.
5. Fall back to a full snapshot only when the local cache is absent/incomplete, the cursor has expired or is inconsistent, or an explicit recovery path requires reconciliation.

Do not fetch all `rate_sheets` just because a global timestamp changed. Existing Staff and Agent feed scoping and authorization stay intact; Admin feed payloads remain Admin-only and must not be readable by Staff or Agents.

### 2. Incremental materialized-cache maintenance

Remove `partitionMasterIntoRateSheets` from the ordinary per-edit sync path. For each mutation package, identify affected sheet keys from the prior and next records, update only those `rate_sheets/{sheetKey}` documents, and publish the Admin delta/revision as part of the same idempotent canonical commit where practical. A re-key or move between sheets updates both old and new buckets. Group several changes to the same sheet so that sheet data is read/written once per package.

Canonical rate records remain the source of truth. Sheet buckets are a derived cache. A full rebuild remains available only as an explicit repair/migration action, never as routine work after a single edit. The incremental update must avoid lost updates when two Admin operations touch the same sheet; use a Firestore transaction or an equivalent version-checked package. Keep Firestore transaction and batch limits in mind and split large packages deterministically.

### 3. Immediate-first sync worker

Keep local staging atomic with the optimistic local rate update. When an operation is staged and the browser is online and not quota-paused, trigger the first sync attempt immediately. Do not wait for a debounce, poll interval, or unrelated reload.

After the attempt:

- On success, mark the operation synced only after canonical data and required role projections/change events have completed.
- On an ambiguous network response, retain the stable operation ID and retry idempotently.
- On temporary failure, use bounded exponential backoff, but expose the attempt count, last error, and next retry time in the basket. A manual retry begins immediately.
- On quota failure, preserve local work and wait for the quota probe/reset policy; do not rapidly retry.
- On validation or conflict failure, stop automatic retries and present a resolvable error/conflict.

The first attempt being immediate does not promise immediate delivery under offline, quota, network, or Firestore service problems.

### 4. Role-safe propagation

The Admin canonical mutation updates only relevant records. It then updates Staff-visible projection/feed data and eligible Agent payout projection/feed data using existing filtering and security rules. Agent records must continue to omit master rates, margins, guidance-only fields, and admin-default metadata. Staff receive only their existing allowed projection plus the agreed default-route markers. No pending Admin-local change is visible to other users before server acceptance.

### 5. Observability and UI states

The basket should distinguish at least `saved locally`, `syncing`, `synced`, `retry scheduled`, `quota paused`, `conflict`, and `failed`. Show last attempt/error when available. This prevents a slow secondary projection or a scheduled retry from appearing as an unexplained generic pending state.

## Failure and recovery

- IndexedDB failure: do not claim the change was saved; keep the editor open and report the local persistence error.
- Offline/quota pause: retain the staged operation and resume on the appropriate online/quota event.
- Partial sync: operation and mutation IDs make each phase safe to resume. Do not clear the queue until canonical and required role-specific propagation is confirmed.
- Feed gap/expired cursor: request a full snapshot once, replace local state atomically, and persist the new cursor.
- Bucket inconsistency: provide an explicit Admin repair/rebuild action with progress and clear warning that it reads the canonical collection.
- Concurrent edit: detect changed base fields and surface a conflict rather than silently overwriting cloud state.

## Scope

Included:

- Admin startup/refresh cache path and missing/stale-cache fallback.
- Admin canonical create/edit/delete and batch mutation sync.
- `rate_sheets` incremental maintenance and Admin change cursor/feed.
- Basket states and retry visibility needed to explain latency.
- Preservation of existing Staff/Agent projections and access boundaries.

Excluded:

- Redesign of spreadsheet import/export, chat reads, or unrelated Firestore collections.
- Eliminating the initial full download for a new Admin device; a complete initial snapshot is required unless a separately approved pagination/lazy-loading design replaces it.
- Guaranteeing zero server latency or writes when offline/quota-limited.

## Verification criteria

1. With an unchanged local Admin cache, startup does not read `rates` or all `rate_sheets`; it performs only the revision/cursor check.
2. After one rate changes on another device, a cached Admin reads only the relevant change-feed entries and updates its local snapshot.
3. A single-field edit does not call `getDocs(collection(db, 'rates'))` or `partitionMasterIntoRateSheets` as part of ordinary sync.
4. A rate mutation stages locally and starts its first sync attempt without a timer delay.
5. Simulated transient failure shows a retry state and error; retry begins immediately when manually requested, while automatic backoff remains bounded.
6. Offline and quota-paused operations remain durable and resume without duplication.
7. Create, update, delete, re-key, and multi-sheet batch changes keep canonical data, buckets, Staff projection, Agent payout projection, and feed cursors consistent.
8. Admin cache recovery can rebuild from canonical rates; that exceptional path is explicit and observable.
9. Staff and Agent Firestore reads remain limited to their authorized role-specific sources; no Admin feed or sensitive field is exposed to them.

## Implementation sequencing

1. Add tests around the observed full-read and immediate-first-attempt behavior.
2. Add the Admin delta feed/cursor and cache application path with full-snapshot recovery.
3. Update mutation commits to maintain only affected sheet buckets and publish deltas idempotently.
4. Remove the full collection rebuild from routine rate sync.
5. Refine retry states and basket feedback.
6. Verify role-specific security and existing local-first conflict/recovery behavior.
