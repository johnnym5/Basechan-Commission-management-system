# Local-First Rate Editing and Sync Basket Design

**Date:** 2026-10-19  
**Status:** Approved in chat; awaiting written-spec review  
**Scope:** Admin create, edit, delete, and batch mutations for commission rate records.

## Goal

Make commission rate changes quick, dependable, and visible across Admin, Staff, and Agent views. Every rate mutation must be saved to the Admin's local database before it is treated as accepted by the UI. Network outages and Firestore quota lockouts must not discard edits. Compatible edits should be sent as compact batches, and dashboards must distinguish local pending changes from changes accepted by Firestore.

## Current problems

- `adminRateWriteService` performs existence reads, writes operation metadata and serialized mutation documents, writes canonical rate and university documents, rebuilds role projections, appends feed entries, writes audit records, publishes notices, and cleans up mutation documents. A single field change waits for this whole serial pipeline.
- Several `MasterTable` bulk and delete actions write directly to `rates`. These paths omit role projection refresh, feed updates, and shared notifications.
- `writeRateOperation` and the UI's edit entry point reject offline or quota-locked changes. Existing offline staging covers imported batches, not ordinary rate edits.
- The edit modal always computes a new composite ID. ID-changing edits need explicit re-key handling and reliable collision feedback.

## User experience

### Local save

- Admin create/edit/delete and batch actions stage a durable operation in the signed-in user's IndexedDB database.
- The operation and its optimistic change to the local rate snapshot are written atomically. The UI confirms **Saved locally — waiting to sync** after IndexedDB commits.
- Duplicate detection includes locally staged creates and re-key operations.
- Failure to persist locally is reported as an error; the UI must not claim the change was saved.

### Dashboard basket

- The dashboard basket is visible only to Admins because queued payloads can include commission amounts.
- It reports pending, syncing, quota-paused, conflict, and failed operations, including affected school/rate count and the latest attempt or reason.
- Admins can retry eligible operations, discard unsent operations, or resolve a conflict by keeping the cloud value or explicitly applying the local change.
- A mutation is labeled synced only after canonical data, role projections, and change-feed publication have completed. Staff and Agents see updates after Firestore accepts the package.

## Data and local persistence

- Add a pending rate-operation object store to the existing per-UID IndexedDB database, with a version bump and migration that preserves existing stores.
- Queue entries carry a stable operation ID, mutation kind, affected rate IDs, compact patch or create/delete payload, base values/version needed for conflict checks, creation/update times, attempt count, and lifecycle status.
- Repeated unsent field edits for the same rate may coalesce into one patch while preserving the first base values. Creates, deletes, and ID-changing edits remain explicit operations with deterministic ordering.
- Stage the queue entry and update local cached rates in one IndexedDB transaction. Broadcast local queue/snapshot changes to other tabs for the same signed-in account.
- Queue records are isolated by UID. They are not written to Firestore until sync begins.

## Sync and propagation

- A foreground sync worker wakes on app startup, newly staged work, the browser `online` event, and the configured quota retry time. It does not depend on browser background sync support.
- Connectivity and a known quota lockout are checked before attempting a flush. Quota errors leave the operation durable and pause retries until the reset/probe window. Temporary connectivity errors use bounded exponential backoff. Other errors remain visible in the basket with retry or correction guidance.
- No zero-cost preflight can guarantee Firestore write quota. A failed write attempt is caught and retained locally; the worker never deletes the local queue item on an ambiguous result.
- Packages are split into Firestore write batches below the platform operation limit. Stable operation and mutation IDs make retries idempotent if a response is lost or a multi-stage write partially completes.
- Conflict checks compare the staged base values with the current cloud record before applying changes. If a field being edited changed in the cloud, pause that mutation for review. A local override requires an explicit Admin choice.
- Canonical updates use field patches when the document ID is unchanged. Changes to ID-defining fields (university/intake/aggregator/study level) use a re-key operation that checks for collisions and updates dependent projections and references.
- One shared pipeline handles all rate mutation entry points, including the existing university edit and batch actions. It updates `rates`, the safe `staff_rates` and eligible `agent_rates` projections, override cleanup when records are re-keyed/deleted, the rate change feed, audit history, and one grouped user notice per package.
- Group work by phase and bounded batch size; do not perform a full-document overwrite for a small field patch. Avoid redundant university-document writes when several rates for the same school are in one package.

## Scope boundaries

Included:

- Single rate create, edit, and delete.
- Existing Batch Edit operations.
- MasterTable university-level edit, guidance, route, selected-delete, and single-delete actions.
- Admin dashboard basket and local queue/sync status.
- Rate projection, change-feed, audit, and notification propagation required by those mutations.

Excluded:

- Import queue redesign, spreadsheet upload and sheet management, and unrelated university metadata editing.
- General Firestore read optimization for page reloads.
- A new Cloud Function or other server-side queue service.

## Failure and recovery behavior

- A local persistence error leaves cloud data untouched and keeps the edit form open with a clear error.
- Offline/quota state never blocks local staging.
- A transient/ambiguous sync outcome retains the same operation ID and retries idempotently.
- A server-side conflict is kept visible and does not silently overwrite the newer record.
- Discard is available only before cloud processing starts. Once a mutation has begun syncing, cancellation is represented as a new compensating mutation or an explicit recovery action; it must not erase an operation with an ambiguous cloud result.
- Local pending changes and server-confirmed changes have distinct labels. No Staff/Agent screen receives an uncommitted local change from another device.

## Security and permissions

- Only Admins can stage and sync canonical rate mutations.
- The local basket is scoped to the current Admin UID; a signed-in account switch cannot expose another user's pending payloads.
- Existing Firestore role-specific read-model rules remain authoritative for Staff and Agents.

## Verification criteria

- Single and batch create/edit/delete stage immediately and survive reload before sync.
- Guidance-only edits use compact updates and propagate to Staff/Agent views after sync.
- Every existing MasterTable mutation uses the shared writer and refreshes projections/feed/notifications.
- Offline and quota-paused actions remain locally visible and automatically retry at the next eligible event.
- Conflicts pause without overwriting cloud changes; explicit local override is auditable.
- Duplicate and ID-changing edits are handled without losing the old or new record.
- Partial package failures and lost responses can be retried without duplicate effects or lost queue items.
- Dashboard basket status and actions match the durable queue lifecycle.
- Existing import, role access, and Admin workflows remain functional.
