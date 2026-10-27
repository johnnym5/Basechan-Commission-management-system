# Browser-First Rate Update System Redesign

**Date:** 2026-10-27
**Status:** Approved for planning; updated to include live feed listeners
**Supersedes:** The interactive rate-write lifecycle portions of `2026-10-19-local-first-rate-editing-design.md` and `2026-10-27-firestore-read-and-sync-latency-design.md` where they conflict with this design. Existing import, snapshot recovery, and role-security requirements remain unless explicitly changed here.

## Goal

Make ordinary Admin edits appear immediately on that device, commit each small change directly from the browser to Firestore, and propagate it promptly to the authorized Staff and Agent views. Keep a role-scoped local package for fast startup, minimize reads and writes for a single-field edit, and do not depend on Cloud Functions, callable endpoints, or another server-side worker.

## User requirements

- A new or reset device downloads a complete local package of the commission-rate data that its signed-in role is allowed to see.
- Admin receives canonical rate records and Admin-only fields. Staff and Agent packages contain only the records and fields permitted for their role. Agent data must never include master rates, margins, or Admin-only route defaults.
- An Admin edit is persisted locally and shown immediately, then sent to Firestore as soon as it is staged. A small field edit must not upload or rewrite the full rate document when the ID stays the same.
- Once Firestore accepts the authoritative update and required role-safe projections, other online users receive the change through the existing client-side change feed.
- Notifications, audit history, and unrelated maintenance must not hold the rate save open.
- Offline and quota-paused edits remain in the local queue and retry when eligible. A permanent validation error or genuine document-ID collision is surfaced and can roll back the optimistic edit; a transient/ambiguous response must not discard it.
- All Firestore mutations and propagation run from the browser. No server-side sync worker is introduced.

**Scope assumption:** “Whole database package” means the full rate dataset and supporting rate metadata visible to that role, not unrelated Firestore collections such as chat, access requests, or notifications. The package is local to the current user/device; Firestore Security Rules remain the authority for what can be downloaded.

## Current flow and reason for redesign

Interactive writes already stage optimistic mutations in IndexedDB and `usePendingRateChanges` starts a flush when local work changes. A rate operation nevertheless stays in `syncing` until `syncRateOperation` completes the canonical transaction, `writeRateOperation` performs projection/feed/audit/notice work, the rate-sheet bucket transaction completes, and the local queue is finalized. `writeRateOperation` has sequential per-mutation projection/feed/audit loops, and publishing notices reads user, access-request, and sheet-settings collections. The basket counts `pending` and `syncing` as “Syncing” and displays age since creation, so a stalled follow-up appears indistinguishable from a slow primary rate write. Separately, `useCommissionRates` currently calls `syncLocalRateData` at bootstrap, reconnect, visibility restoration, and explicit refresh; it does not subscribe to role-feed changes while a user is active, so the existing feed alone does not provide live cross-user updates.

The new design treats a rate save and its side effects as separate lifecycle responsibilities. A rate edit is successful when the canonical change and the role-safe records/feed required for readers are committed. Notifications and audit events are ancillary and do not change that save result.

## Architecture

### 1. Role-scoped package and local snapshot

On first login or when the local snapshot is missing/incomplete, the browser downloads the complete rate dataset for the active role and stores it in that account's IndexedDB database:

- **Admin:** canonical `rates`, including Admin-only fields.
- **Staff:** `staff_rates` projections and Staff-scoped feed state.
- **Agent:** eligible `agent_rates` projections plus only the organization/personal override layers authorized for the current Agent.

The package is scoped to UID, role, access state, and organization. A cache from a different identity or role is never reused. Admin and role data remain separate in local storage. Firestore rules and the existing role projections enforce server-side access; client-side filtering is not a security boundary.

After bootstrap, startup loads the local package first, then checks a small role-scoped feed cursor and applies only newer deltas. While active, the client subscribes with Firestore `onSnapshot` to the role-authorized feed-head document(s). When a head advances, it reads and applies only deltas after its local cursor. Subscriptions are scoped to UID, role, access state, and organization and are removed when that scope changes. A complete unchanged local package must not trigger a repeated full collection download. Explicit cache recovery may download the full authorized package again.

### 2. Direct browser write for one edit

All interactive Admin mutation entry points use one writer and a stable operation ID. Local staging atomically stores the patch and applies the optimistic local projection. If the browser is online and not quota-paused, the writer starts immediately without a debounce or waiting for a refresh.

For a same-ID field edit, the Firestore transaction reads the current canonical rate and only the metadata needed to make an idempotent, role-safe change. It applies the changed fields to the canonical rate and updates only affected role projections and role feed records. For a create, delete, re-key, visibility change, or batch package, the writer uses the corresponding bounded transaction/batch path and deterministic operation/mutation IDs. It never silently overwrites a different record occupying a new ID.

Change-feed entries carry the role-safe record needed to update the local package, avoiding a follow-up read of the same changed document. Admin feed content is Admin-only; Staff and Agent feed entries contain only their own read-model shape. Each projection is emitted only when the changed fields affect that role's view.

The writer does not read every user, access request, rate, or rate-sheet bucket to commit a single edit. Legacy whole-sheet snapshots may remain available for initial bootstrap or explicit repair; routine edits must not rewrite or rebuild them. Any bucket still required by a live reader must be identified and updated incrementally, or removed from that reader's normal path before it is excluded from the critical write.

### 3. Separate ancillary work

User notifications, audit presentation, and nonessential manifest/maintenance updates run after the authoritative save and cannot make the rate edit appear unsaved. The browser records any incomplete ancillary work with the stable operation ID and retries idempotently on the next eligible app session or connection event. The UI reports ancillary work separately from rate-save status. No hidden server process is assumed to finish it.

This phase must not be the only source that makes Staff or Agent rate data visible. Their required role projection and delta are part of the successful rate commit; ancillary processing is limited to effects that do not gate rate visibility or permissions.

### 4. Honest status and recovery

The Admin UI distinguishes:

- **Saved on this device:** IndexedDB staging completed; Firestore has not yet accepted it.
- **Saving to cloud:** the direct Firestore write is in progress.
- **Saved:** canonical rate and required role-safe propagation are committed; show a short success toast.
- **Waiting for connection/quota:** retain the optimistic value and durable local queue entry; retry on `online`, quota recovery, or explicit retry.
- **Needs attention:** permanent validation failure, permission denial, or true ID collision; explain the reason and restore the previous local value when the edit cannot be applied safely.
- **Background update pending:** the rate is already saved, but an ancillary notice/audit/maintenance action is still retrying.

The basket's elapsed timer measures the current attempt separately from time spent queued. It shows the most recent failure and phase so a spinner cannot continue indefinitely without an explanation. A timed-out request is treated as ambiguous until the same operation ID is checked/retried; it is not blindly rolled back or duplicated.

### 5. Immediate client propagation

Other online users use role-scoped Firestore data and the existing feed/cursor mechanism with a live `onSnapshot` listener on their feed head. A committed feed head change triggers delta retrieval and local IndexedDB/UI application without waiting for a reload, page-visibility change, or manual refresh. Offline users apply deltas after reconnecting. The system promises immediate write initiation and prompt live propagation under a healthy Firestore connection, not zero network/server latency.

## Operation lifecycle

1. Admin submits a rate mutation; validate locally and create a stable operation ID.
2. In one IndexedDB transaction, persist the compact mutation, its blocked ancillary-effect tasks, and the optimistic Admin snapshot. The editor closes/updates with “Saved on this device.”
3. If online and quota allows, immediately send the operation to Firestore. No refresh, full database upload, or full-document replacement is used for a same-ID field edit.
4. Firestore commits canonical data, the affected Staff/Agent projections, and their feed deltas idempotently. A retry with the same ID cannot duplicate feed sequence entries.
5. Feed-head listeners on affected role scopes observe the transaction and apply the committed, role-safe deltas to online users' local packages.
6. Mark the local mutation cloud-saved, reconcile its canonical server value, remove it from the unsaved queue, and show a brief “Saved” toast.
7. Process notification/audit/maintenance effects separately; the tasks were staged locally with the mutation, become eligible after primary success, and can retry without changing the successful rate-save status.
8. On temporary/offline/quota failure, keep the local mutation and retry safely. On permanent rejection, restore the saved base values, cancel its blocked ancillary effects, and show an actionable failure toast.

## Security and data integrity

- Only Admin can write canonical rate records or enqueue an Admin rate mutation.
- Staff reads only Staff-authorized projections and Staff feed data.
- Agent reads only eligible payout projections and authorized override layers. Agent documents and feed records exclude master rates, net margin, and default-route metadata.
- Admin package and cursor data never leak into Staff or Agent local stores or feeds.
- Updates to different fields on the same rate must preserve unrelated latest cloud values. For the same field, the latest committed Admin patch wins and its old/new values are retained in audit history; do not force a manual override for a same-ID field edit.
- Operation IDs and per-scope feed markers make retries idempotent, including when Firestore commits but the browser loses the response.
- Multi-record changes are bounded by Firestore limits and apply deterministic partial-progress/recovery behavior.

## Migration and compatibility

- Keep the existing IndexedDB schema readable; migrate current pending operations and local snapshots without discarding queued edits.
- Introduce the new writer behind the shared rate-write service and move each interactive Admin edit path to it. Imports and explicit bulk repair remain separate until independently migrated.
- Keep existing `staff_rates`, `agent_rates`, and role feeds as the outward read contract unless the implementation review proves a specific path redundant. Preserve their current field-level role boundaries and Firestore rules.
- Stop the new ordinary-write path from invoking the old multi-stage pipeline after the direct transaction. Retain explicit repair/backfill functions for legacy projections and rate-sheet buckets.
- Before removing a write or cache path, trace all consumers and cover the transition with tests so no dashboard depends on stale legacy data.

## Out of scope

- Cloud Functions, callable APIs, a server queue, or another hosted worker.
- Changing Staff/Agent field permissions or giving them canonical Admin data.
- Reworking imports, exports, chat, or unrelated user/notification storage beyond decoupling those effects from the rate-save result.
- Guaranteeing delivery while the browser is closed, offline, or Firestore quota is exhausted. Local work remains durable and resumes when the app can run again.
- Guaranteeing zero propagation latency across the network.

## Verification criteria

1. A new Admin device downloads a complete canonical rate package once; a new Staff or Agent device downloads only its role-authorized package and supporting layers.
2. A warm login with a valid package applies local data immediately and reads only the relevant role feed cursor/deltas, not every rate document.
3. One same-ID field edit is staged locally immediately and begins its direct Firestore attempt without a timer delay.
4. The single edit does not read all users/access requests, the full `rates` collection, or all `rate_sheets` as a prerequisite to saving.
5. The edit commit updates canonical data, the affected role-safe projection(s), and corresponding feed deltas; Staff and Agent receive only permitted fields.
6. Active Staff and Agent clients apply a new feed delta without reload, visibility restoration, or manual refresh; reconnecting clients catch up from their saved cursor.
7. A projection/feed failure does not display “Saved”; a notification/audit failure after the required rate commit does not display the rate edit as unsaved.
8. Offline and quota-paused edits survive reload and retry without duplicate canonical changes or feed entries.
9. Permanent errors revert only the affected optimistic fields; a genuine target-ID collision preserves both records and reports the collision.
10. Concurrent edits preserve unrelated fields; two edits to the same field serialize with the latest committed patch winning, without a force-push prompt. Audit effects retain each old/new value.
11. Existing pending operations, role rules, Admin batch editing, delete, create, re-key, and explicit repair workflows remain recoverable.
12. A foreground timing trace reports local-stage time, Firestore commit time, role propagation time, and ancillary completion separately; a stalled phase shows its current phase and last error.

## Implementation sequencing

1. Trace and test all current interactive mutation entry points, role projection consumers, Firestore rules, and local queue migrations.
2. Define the transaction payload and role-scoped feed format; add idempotency, concurrency, and access-boundary tests.
3. Implement the browser-only direct canonical/projection/feed writer and local acknowledgement lifecycle.
4. Move one-record edits first, then create/delete/re-key and batch paths, preserving imports and explicit repairs.
5. Split ancillary notification/audit/maintenance work from authoritative rate-save status and add retry visibility.
6. Migrate startup to the complete role-scoped package plus delta refresh and active role-feed listeners, using full package reads only for bootstrap/recovery.
7. Verify all role rules, migration/retry behavior, live propagation, read/write counts for a single edit, and production build before removing obsolete paths.
