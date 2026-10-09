# Offline Local Rate Database and Role-Aware Chat Design

**Status:** Draft for product-owner review
**Date:** 2026-10-09

## 1. Purpose

Let a signed-in user download the rate and school data their role is allowed to access, search that data locally, and continue reading it when Firestore is offline or its quota is exhausted. After the initial download, synchronize only added, changed, and deleted records. The chat should remain useful offline, keep a small amount of account-specific context, and explain its capabilities in short, role-aware replies.

This feature is read-only while offline or quota-limited. It does not queue Admin edits or other cloud writes for later replay.

## 2. Product decisions

- Admin's local dataset contains canonical Admin rates.
- An approved Agent's local dataset contains the Agent read model, the Agent's organization layer, and that Agent's personal overrides. Staff routing-only values are excluded.
- Staff's local dataset contains the Staff read model, including routing and guidance, with Agent payout values excluded.
- A new device/account needs one successful online bootstrap before it can search locally.
- Searches and chat rate queries use IndexedDB and do not issue Firestore rate queries.
- Firestore's normal persistent cache will be replaced with memory cache. IndexedDB will be the app-managed persistent store for rate data. This avoids leaving a second persistent rate copy in Firestore's cache.
- On sign-out, the app locks and deletes the local rate database and the account's retry metadata. It also clears the prior Firestore persistent cache during the migration to the new storage model.
- Offline/quota mode is read-only. Admin edits and other actions that write to Firestore are disabled; chat queries can answer in the current in-memory session but are not persisted until online service returns.
- No Cloud Functions, external LLM, or external query transmission are added.

## 3. Current state and problem

Firestore persistence is currently configured with IndexedDB and multiple-tab support. `useCommissionRates` subscribes to the full canonical collection for Admin or a full role projection collection for Agents and Staff. Approved Agents also subscribe to organization and personal override collections. Chat filters the rate array held by the React app, but the app clears that array and shows a blocking `School data unavailable` panel when a rate listener fails.

The current arrangement does not provide a reliable one-time download followed by delta-only refreshes. Firestore documents that a persistent listener disconnected for more than 30 minutes can be billed as a new query when it reconnects. Admin projection migration and sheet-visibility changes also read or rebuild full collections. The new data path must replace these full-rate listeners and account for these full-collection operations.

## 4. Local database and query path

Use a dedicated IndexedDB database behind a typed local-rate repository. The database stores:

- A metadata record with schema version, account UID, authenticated role, organization ID where applicable, last server-verified access state/time, last successful sync cursor, and last successful sync time.
- Role-safe rate rows keyed by stable rate/projection ID.
- Separate Agent organization and personal override rows so the existing precedence can be resolved locally without copying routing fields into Agent data.
- A compact account-scoped chat preference profile needed for offline suggestions; it is loaded/saved with the account while online and removed from the local store at sign-out. Favorites, Updates, and full conversation history remain Firestore-backed.
- Lookup indexes needed for school, country, intake, level, guidance, and permitted role-specific fields.

The application opens a store only when its UID, actual authenticated role, and organization scope match the active session. Admin's visual “view as” selection does not change authorization or which database partition can be read. For an already authenticated Agent returning while offline, use the last server-verified approved state and organization stored with that Agent's local database; the app must recheck both before applying online deltas. A new or never-approved account cannot bootstrap offline.

The initial bootstrap reads all records in the correct role-safe source, saves them to IndexedDB in bounded transactions, and records a cursor boundary. Searches, filters, comparisons, chat results, and local preference suggestions query this local store. A partially completed bootstrap is marked incomplete and cannot be mistaken for a complete downloadable database.

The read models remain explicit projections. Never copy a canonical Admin record into an Agent or Staff store and then hide fields in the UI. Existing sheet visibility rules must be reflected in local query results and in delta application.

## 5. Incremental synchronization

Add role- and scope-specific change feeds with monotonically increasing cursors. Feed records contain an operation ID, sequence, target scope, change type, and only the role-safe record fields needed to upsert or delete a local row. Deletions use tombstones. Admin canonical changes are published to the feeds only after the canonical write and all affected role projections have completed successfully.

Scopes include the Admin dataset, the shared Staff projection, the shared Agent projection, an Agent organization override layer, and a specific Agent's personal override layer. Broad rate changes update shared projection feed records; organization and personal changes go only to the affected scopes. A client never receives change data for another Agent's personal layer.

Bootstrap captures a completed feed cursor, downloads the role-safe snapshot, then applies every completed change after that cursor. This closes the race between a snapshot and an Admin edit that happens during bootstrap. Regular sync checks a small current-cursor/manifest record; when unchanged, it makes no rate-document reads. When changed, it reads and applies only subsequent feed records, paginating as needed. A local transaction commits all page changes and advances the cursor only after the corresponding changes are applied. An interrupted or failed sync retries from the old cursor and is idempotent by operation ID and sequence.

Retain change history so a device that has been offline for a long time can catch up without a forced full dataset download. Feed compaction or pruning is not part of v1 because it would require device acknowledgements or a defined full-bootstrap fallback policy.

## 6. Quota and connectivity states

Connectivity and quota are separate state dimensions. The app does not infer quota exhaustion from `navigator.onLine`.

### Normal online

- Perform role-authorized bootstrap or incremental sync.
- Use IndexedDB for all rate and school searches, including while online.
- Do not attach full-collection rate listeners.
- Check a small sync cursor when returning to the foreground or after a successful network recovery.

### Quota-limited

- Treat Firestore `resource-exhausted` quota failures as quota-limited, not as a generic connection failure.
- Keep the last complete local database available and show a small notification at the top: “You are using offline mode.” Include a short quota-specific detail such as “Firestore quota reached; we’ll check again automatically.” The notification closes automatically after five seconds. This wording distinguishes quota fallback from a device with no network.
- Remove the blocking `School data unavailable` panel. Show a non-blocking stale-data timestamp/indicator where users can see that the local data may not include recent Admin changes.
- Stop normal Firestore reads, listeners, and writes. Do not repeatedly retry on every chat query or navigation action. Disable network access between explicit quota probes and ensure UI/service write actions reject locally instead of leaving Firestore writes queued.
- Schedule one lightweight server probe every 12 hours while the account remains signed in. Persist the next probe time as account-scoped metadata, clear it on sign-out, and honor it after page reload. If the browser is actually offline at probe time, wait for the online event before probing.
- If a probe still returns a quota error, keep local mode and schedule the next 12-hour probe. A successful probe rechecks access, applies changes after the stored cursor, and returns to normal online state only after a successful sync.

Firebase publishes that daily free quota resets around midnight Pacific time. The 12-hour probe cadence is a retry interval, not a promise that quota will return at a particular time. See [Firestore billing guidance](https://firebase.google.com/docs/firestore/pricing).

### True offline or service unavailable

- If `navigator.onLine` is false or Firestore reports a connectivity/service-unavailable error, retain and query the local database without labeling the condition as quota exhaustion. A separate short message can say “You’re offline; we’ll retry when your connection returns.”
- Retry when the browser signals that connectivity has returned. Do not wait for the quota timer.
- If there is no completed local bootstrap, explain that an initial successful online download is required; do not render an empty result as if the dataset were empty.

### Authorization failure

- A quota or network error does not erase the previously authorized local database.
- On a successful server access check, a denied/revoked account is locked out and its local rate database is deleted.
- A device disconnected from the server cannot learn of a revocation until it reconnects. During that time it can use its last authorized copy. This is an inherent offline-access tradeoff.

Firestore's `disableNetwork` operation serves reads from cache and blocks network writes while disabled; the app must re-enable network only for a scheduled probe and must prevent pending app writes from being queued. See [Firestore offline data guidance](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## 7. Sign-out and persistent data cleanup

Sign-out first locks role-sensitive UI state, stops application listeners, closes IndexedDB connections in all open tabs, deletes the signed-in account's rate database, clears quota retry metadata, then signs out. A second account cannot open the prior account's local store.

During rollout, migrate away from Firestore persistent IndexedDB caching and clear the old persistent cache while Firestore is terminated. Firebase notes that cache clearing is not a secure physical overwrite. The app promises logical deletion/clearing, not forensic erasure. See [Firestore JavaScript API reference](https://firebase.google.com/docs/reference/js/firestore).

Use Firestore memory cache for other Firestore features. The local rate database and compact preference profile are the offline source for school/rate search and suggestions; Firestore-backed chat history, Favorites, Updates, access administration, and rate editing may be unavailable or read-only while local-only mode is active.

## 8. Personal, role-aware chat

Keep chat parsing and response construction deterministic and local. Do not send user queries to an external model. Use the current conversation for short follow-ups and the authenticated account's existing preference profile, Favorites, and relevant Updates for optional suggestions. Suggestions must be concise, relevant, and explicitly user-applied; never silently change search filters. Clear in-memory context on account change and sign-out.

Keep answers short and direct. Out-of-scope requests receive a role-aware response such as: “Sorry, I can’t do that here. I can help you find and compare schools, intakes, guidance, and [role-specific capability]. What would you like to check?” Capabilities are derived from the authenticated role and access state:

- Approved Agent: authorized school search, intakes, guidance, Agent commissions, and comparisons.
- Staff: school search, intakes, guidance, and application routing; no Agent payout details.
- Admin: full-data school/rate search and comparison in Chat; Admin writes remain in the dashboard and require online access.
- Pending/rejected/revoked Agent: access request/status help only; no cached or live rate information after access denial is confirmed.

The authenticated role controls accessible data and responses, including while Admin is previewing another role. Use existing account-scoped chat preferences and Updates. Rate-search chat remains usable with the local rate database during offline/quota mode, but new messages are not persisted until Firestore is available.

## 9. Failure handling and user feedback

- Preserve the prior local dataset if bootstrap or delta sync fails.
- Never advance the cursor before local application of the full change page succeeds.
- Make delta writes idempotent and retryable.
- Distinguish quota exhaustion, actual connectivity loss, generic service unavailability, no initial snapshot, stale local data, and access denial in internal state and logs.
- Do not expose provider error text or a blocking error card for quota exhaustion. Use the five-second notification requested above and a persistent, non-blocking freshness indicator.
- Avoid retry storms. Quota mode permits only the scheduled probe; true offline probes on connectivity restoration.

## 10. Test and acceptance criteria

- A first successful online sign-in downloads only the role-authorized dataset and stores its cursor.
- After bootstrap, school/rate/chat searches read IndexedDB and do not issue Firestore rate collection queries.
- A sync with no newer cursor reads no rate documents.
- One changed rate, a deleted route, an organization override, a personal override, and a sheet visibility change update only their affected local rows and role scopes.
- A change during bootstrap is not lost; interrupted pagination does not advance the cursor; retry applies changes exactly once.
- Quota `resource-exhausted` preserves the local copy, pauses network use, shows the top notification for five seconds, and schedules one retry 12 hours later. It does not use the true-offline timer path.
- True offline preserves local search and retries on the online event without waiting 12 hours.
- A successful quota probe verifies access before applying deltas. A denied access check deletes the local rate database.
- Chat context uses the current user/role, keeps suggestions optional, and produces concise role-specific out-of-scope responses without leaking Staff or Agent restricted fields.
- Sign-out deletes the local rate database, clears memory, stops listeners, and prevents a second account from opening it. Multi-tab sign-out performs the same cleanup.
- An offline/quota-limited Admin cannot edit rates, and no Firestore writes are silently queued for later replay.

## 11. Rollout constraints

1. Implement and validate the local database/repository and role scope.
2. Add the Admin-published change feeds after canonical and projection writes complete.
3. Add bootstrap, cursor catch-up, quota/offline state handling, and read-only UI behavior.
4. Route `useCommissionRates`, chat, migration, and sheet-visibility flows through local data and deltas; remove full rate listeners and whole-collection rebuilds from routine operation.
5. Migrate Firestore caching to memory, clear prior persistent cache, and validate sign-out/multi-tab deletion.
6. Enable role-aware chat response and suggestion behavior using local context.

No implementation should begin until this spec is reviewed and the separate implementation plan is written and approved.
