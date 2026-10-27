# Admin Rate Change Packages

**Date:** 2026-10-27
**Status:** Approved for written-spec review
**Supersedes:** The interactive rate-write lifecycle portions of `2026-10-19-local-first-rate-editing-design.md` and `2026-10-27-firestore-read-and-sync-latency-design.md` where they conflict with this design. Existing import, snapshot recovery, and role-security requirements remain unless explicitly changed here.

## Goal

Keep Admin rate edits local until an Admin deliberately publishes them. Let the Admin review, select, upload, or discard individual changes or groups. Publish selected changes as one logical package, then have eligible clients fetch and apply that package to their local role-scoped data. Avoid per-edit Firestore writes and continuous rate-document listeners.

## User requirements

- Rate edits made by Admin stay in the local IndexedDB package and do not automatically write to Firestore.
- The persistent header sync control displays the number of pending changes and opens a basket with each pending change, its affected school/route/fields, and its local status.
- Admin can select one, several, or all pending changes to upload; Admin can also select and discard one, several, or all. Both actions require a confirmation dialog.
- Discarding a local change restores the local value produced by the remaining pending changes and last downloaded/published package. It does not alter published data.
- Publishing sends selected changes as one logical package. The package becomes visible only after all of its payload is safely stored and a published head/manifest points to it.
- Other devices listen only to the small package head for their authorized scope. When it changes, they fetch the newly published package, validate it, and apply it to their local IndexedDB package and visible pages. They do not listen to each rate document.
- Staff and Agents receive only role-authorized package data. Agents see only their own permitted rates; never master rate, margin, or Admin-only route-default data.
- On first login or missing/corrupt local snapshot, a device gets a role-scoped baseline package and then applies packages newer than its cursor. A role/identity/organization change cannot reuse an incompatible cache.
- No Cloud Functions, callable endpoints, hosted worker, or automatic Admin upload is introduced.

## Clarification about “offline” and propagation

“Offline” means local rate edits are not sent to Firestore until an Admin confirms Upload. The application still needs a network for initial package download, the lightweight package-head listener, and the explicit upload. Other users do not see unpublished edits. After publication, online devices receive the package through the head listener; offline devices catch up on reconnect or next login.

## Current flow and motivation

The current queue starts a cloud flush after local changes. Completing a rate operation can include canonical writes, role projection/feed work, sheet-bucket work, notices, and audit operations, with sequential steps and broad reads. A pending basket entry can therefore remain “Syncing” while the UI does not identify the blocked phase. The active clients also do not currently subscribe to role-feed changes. The new flow separates local editing from explicit package publication and replaces per-rate listeners with one head listener for each authorized role scope.

## Architecture

### 1. Role-scoped local package

Maintain a complete local baseline plus an ordered local change log in IndexedDB, scoped by UID, role, access state, and organization. The UI renders the baseline with pending local changes applied. Each change has a stable ID, target rate/route ID, compact field-level before/after patch, creation order, and lifecycle state. Repeated edits remain individually discardable; when selected for upload, ordered patches for the same record are composed deterministically.

- **Admin baseline:** canonical Admin rate data and Admin-only metadata.
- **Staff baseline/package:** only the staff projection and fields Staff may see.
- **Agent baseline/package:** only eligible agent payouts and authorized personal/organization overrides.

Client-side filtering is not a security boundary. Firestore rules must continue to enforce role access to baselines, package manifests, package payloads, and heads.

### 2. Pending-change basket

The header badge counts pending change entries, not cloud write calls. The basket lists changes with useful context and selection controls. Upload and Discard operate on the selected entries only; confirmation states how many changes are affected. Deselecting or closing the basket does not change local data. After an upload, selected entries remain recoverable until publication is acknowledged; unselected entries remain pending.

Discard applies only to selected, unpublished entries. The local visible state is recomputed from the baseline plus remaining pending entries, preserving later changes to the same record. An upload already published cannot be discarded locally; reversing a published change requires a new Admin change package.

### 3. Package publication and durable source

The ordinary rate update becomes an append-only package log, rather than an individual write to every changed rate document. A package contains stable package/change IDs, base and target cursors, ordered compact patches, and role-safe payload variants. Admin publishes the Admin package and only the corresponding Staff/Agent variants affected by the selected changes.

Package payload documents are immutable. The publishing client writes payload (and bounded chunks if needed) first, then publishes a manifest/head as the visibility boundary. Readers ignore unreferenced or incomplete payloads. The package log is the durable source for ordinary rate mutations; clients materialize its patches into local role-scoped snapshots. Existing per-rate collections may be retained temporarily for migration, imports, exports, or explicit repair, but normal interactive changes must not also rewrite each rate document.

Package sizes are bounded by Firestore document, batch, and transaction limits. A package that exceeds the chosen safe bound is split into deterministic chunks under one logical package ID and is not visible until the manifest references all chunks. If the package cannot be safely published within Firestore limits, keep it queued and report the reason; never publish only part of the selected logical package. Firestore charges still apply per document read/write: a single logical package reduces repeated request and workflow overhead but does not guarantee that arbitrarily large packages cost one document write. A true one-document package also has Firestore's per-document size limit.

To prevent unbounded replay on new or long-offline devices, periodically materialize a role-scoped checkpoint snapshot and advance the retained package cursor. Snapshot creation and retention are explicit maintenance operations with a safe rollback window; do not delete packages needed by active cursors. New devices load the latest authorized checkpoint then apply packages after its cursor.

### 4. Passive package delivery

An authenticated client listens only to its authorized role-scope package head(s), not the rate collection or individual package documents. An unchanged head does not continuously download package data. When a head advances, the client fetches the referenced manifest/chunks, verifies package ID, scope, cursor continuity, schema version, and integrity metadata, applies the changes atomically to IndexedDB, advances its cursor only after successful application, and refreshes the visible React data.

Duplicate or out-of-order head notifications are harmless: stable package IDs and cursors make application idempotent. If a cursor gap exists, the client fetches missing packages or a current authorized checkpoint. If the listener disconnects, reconnect/resume catches up from the saved cursor. No package is applied across role, UID, access-state, or Agent-organization scopes.

### 5. Explicit upload lifecycle

1. Admin edits locally; IndexedDB stores the change and updates the local view immediately. No cloud write begins.
2. Admin opens the basket, selects pending changes, and confirms Upload.
3. The client freezes the selected change IDs into a stable logical package. New edits made during upload remain separate pending entries.
4. Client validates package size, scope, IDs, and base cursor. It writes immutable payload documents/chunks, then publishes the manifest/head only when the full package is ready.
5. On acknowledged publication, selected entries become published and are removed from the pending badge; show a short success toast. Unselected entries remain pending.
6. Role-head listeners fetch and apply the matching safe package variants. Each device records its cursor and can resume after reload/offline periods.
7. If publication fails before the head advances, retain selected changes locally for retry and leave incomplete payloads unreferenced. If the response is ambiguous, inspect/retry with the same package ID and never duplicate or partially expose it.
8. Discard follows its own confirmation and affects selected unpublished entries only.

### 6. Failure and recovery states

- **Saved on this device:** local edit is durable; not published.
- **Ready to upload:** pending entry is available in the basket.
- **Preparing package / Publishing package:** an explicit confirmed upload is active; show the phase and elapsed attempt time.
- **Published:** head points to the complete package; the package is durable even if some clients have not applied it yet.
- **Waiting for connection/quota:** retain the local selection and package ID; no background retry. Admin can retry explicitly when appropriate.
- **Needs attention:** schema, permissions, package-size, cursor, or identity conflict needs explanation. Preserve local changes.
- **Applying update:** recipient is validating and applying a downloaded package locally.
- **Catch-up needed:** receiver detects missing cursor continuity and fetches missing package(s) or checkpoint before showing a fully current state.

Notifications and audit presentation must not hold package publication open unless they are part of the package's required durable record. Audit data for a package should be included as part of the immutable package or written as a deterministic, resumable ancillary effect. A notice failure cannot make a package look unpublished after its head has advanced.

## Security and data integrity

- Only Admin can write Admin package payloads and advance the Admin package head.
- Staff can read only Staff package variants and baselines allowed by existing rules.
- Agent can read only their eligible payout package variants and authorized override layers. Agent payloads exclude master rates, net margins, and Admin route defaults.
- Scope and cursor are validated on every payload/manifest read; local caches are never shared across incompatible roles or organizations.
- Package IDs and change IDs are deterministic/stable across retries. A response lost after head publication must resolve as already published, not duplicate the package.
- Package publication is atomic from readers' perspective: the published head never references missing or incomplete package content.
- Concurrent Admin packages use optimistic base cursors. A stale package is rebased against the latest package state using field-level patches, preserving unrelated fields; overlapping fields use last successfully published patch order and retain before/after audit values. True target-ID collisions remain conflicts and never overwrite a different route.
- Packages are immutable after publication. Correcting a published change creates a new package.

## Migration and compatibility

- Upgrade IndexedDB without deleting rate snapshots or unresolved queue entries. Convert existing pending operations into individually discardable local changes; do not auto-publish them during migration.
- Keep existing `staff_rates`, `agent_rates`, and role authorization rules during transition. Establish how package application updates/serves existing page selectors before removing their read paths.
- Treat existing canonical rate documents as the initial Admin baseline/checkpoint. Define a one-time migration/reconciliation before packages become the durable source for ordinary edits; prevent old and new write paths from racing or causing duplicate visibility.
- Imports and explicit database repairs remain explicit bulk workflows. Specify whether an import publishes through the same package log or uses a guarded migration path before implementation; do not silently bypass package cursors.
- Remove ordinary auto-flush behavior only after all interactive Admin entry points stage into the local basket. Preserve a recovery route for stale `pending`, `syncing`, `failed`, and `conflict` records.

## Out of scope

- Cloud Functions, callable APIs, a hosted server queue, or server push.
- Background upload of Admin edits or automatic upload retries.
- Staff/Agent writes to rate packages.
- Guarantees of delivery while a browser is closed or offline; recipients catch up next time the app can run.
- Guaranteeing zero propagation latency or a one-document Firestore cost for arbitrary package size.
- Reworking unrelated notifications, chat, imports, or exports beyond ensuring rate package consistency and role security.

## Verification criteria

1. An Admin edit updates that device immediately and creates no Firestore write until an explicit confirmed upload.
2. The header count equals the number of locally pending change entries; selecting/discarding one entry does not affect others, including edits to the same record.
3. Upload confirmation publishes only selected entries as one logical package; unselected pending changes remain local and visible.
4. A recipient with an authorized role head listener fetches package data only after that head changes, applies it once, and updates visible views without a reload.
5. Admin, Staff, and Agent receive the correct package variant, with no Admin-only fields in Staff/Agent payloads and no master rates/margins/default-route metadata in Agent payloads.
6. A new device loads an authorized checkpoint and replays only packages after its cursor; role or organization changes cannot leak old cache data.
7. Incomplete payloads, chunk failure, lost upload responses, duplicate head events, and cursor gaps never expose partial or duplicate package state.
8. Offline/quota failures retain pending local changes; there is no automatic upload retry. Explicit retry uses the same package ID.
9. Discard requires confirmation, updates only unpublished local changes, and recomputes the view from baseline plus remaining local changes.
10. Package size, number of Firestore documents written, reads, and listener scopes are measurable and reported accurately; no promise of one billed write for multi-document packages.
11. Concurrent/stale Admin packages preserve unrelated fields and report true record-ID collisions without force-pushing over another route.
12. Current pending queue data and existing role-specific page selectors remain recoverable throughout migration.

## Implementation sequencing

1. Inspect current Firestore document shapes/rules, IndexedDB queue, role projections, imports, and page selectors; choose package/checkpoint schema and safe Firestore size/operation bounds.
2. Define package IDs, cursor protocol, role-safe variants, local change-log/discard semantics, and security rules.
3. Implement local-only staging, header pending count, basket selection, confirmation flows, and migration of old pending edits.
4. Implement immutable package payload/chunks, publish-head boundary, idempotent retries, and package audit record.
5. Add role-scoped package-head listeners, checkpoint bootstrap/catch-up, atomic local application, and UI refresh.
6. Route every interactive Admin mutation through local staging and explicit package upload; keep imports and repair paths guarded and consistent with package cursors.
7. Remove ordinary auto-flush/per-rate write behavior after every mutation entry point is verified.
8. Review quota usage, role boundaries, migration recovery, and build behavior before enabling package publication broadly.
