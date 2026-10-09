# Updates and Admin Chat Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface relevant Admin changes to Agents and Staff through an account-scoped Updates section and add the Admin Dashboard/Chat header switch.

**Architecture:** The shared Admin rate write service creates sanitized, role-specific update notices alongside each Admin operation. Notices are stored per recipient so a user's listener and Firestore rules expose only that user's relevant changes. Agent/Staff chat navigation hosts the persistent unread badge and return summary; Admin gets a header-level Dashboard/Chat switch.

**Tech Stack:** React 19, TypeScript 6, Firebase Firestore 10.14, existing React app navigation and UI styles.

**Spec:** `docs/superpowers/specs/2026-10-09-agent-staff-chat-search-design.md` (sections 4 and 7).

## Global Constraints

- No Cloud Functions or external notification service.
- Each notice contains only fields the recipient can already read through their role read model.
- Notice targeting respects role, organization, Agent approval/revocation state, and individual assignment.
- Opening a notice marks it read and opens affected role-safe results.
- Keep an unread badge persistent; summarize unread changes briefly when the user returns.
- Admin retains the current dashboard and switches between Dashboard and Chat in the header.
- Preserve the user's current uncommitted changes when implementing this plan.

## Review Focus

- A pending or revoked Agent receives no rate update notice; test status changes between event creation and notice fanout.
- An individual Agent override notice is visible only to that Agent; test a second Agent in the same organization.
- A shared/org update summary never includes hidden rate fields; test serialized notice payloads for both roles.
- Marking a notice read is scoped to the current user and remains read across sessions; test concurrent tabs/reload.
- Admin page switching does not lose the dashboard or expose Agent/Staff restrictions incorrectly; test route/page state for all roles.

---

## File Map

- Create `src/types/updates.ts`: notice and read-state types.
- Create `src/services/updatesService.ts`: target selection, per-user notice fanout, unread counts, and mark-read operation.
- Modify `src/services/adminRateWriteService.ts` from the access plan: emit a typed change summary after canonical and projection writes succeed.
- Modify `firestore.rules`: allow a user to read/update only their own notice read state; allow only Admin to create/update notice content.
- Create `src/hooks/useUpdates.ts`: subscribe to current-user notices and derive unread count/summary.
- Create `src/components/UpdatesPanel.tsx` and `UpdateNoticeCard.tsx`: persistent panel, unread badge, summary on return, and affected school results action.
- Modify `src/components/AppLayout.tsx` and `src/App.tsx`: Admin Dashboard/Chat switch and Agent/Staff persistent panel placement.
- Modify `src/components/ChatView.tsx` from the Chat plan: open affected results from a notice and mark it read.
- Add target-selection, permission, read-state, and navigation tests.

## Interfaces

- `buildUpdateNotice(change: AdminChangeSummary, recipient: UpdateRecipient): UserUpdateNotice | undefined` produces a recipient-safe title, summary, affected school IDs, role, and source operation ID.
- `publishUpdateNotices(change: AdminChangeSummary): Promise<PublishUpdateResult>` resolves only currently authorized recipients and writes idempotent per-user notices in bounded batches.
- `subscribeToUpdates(uid: string, onChange: (notices: UserUpdateNotice[]) => void): Unsubscribe` reads only `/user_updates/{uid}/items`.
- `markUpdateRead(input: { uid: string; noticeId: string; readAt: string }): Promise<void>` changes read state only for the owning account.
- `openUpdateResults(notice: UserUpdateNotice): Promise<void>` marks the notice read and opens its affected IDs through the current role's `searchSchools` result view.

## Task 1: Define notice model and target rules

**Files:** `src/types/updates.ts`, `src/services/updatesService.ts`, target tests.

- [ ] Test target selection for individual Agent, organization Agent, all affected approved Agents, Staff shared guidance/intake, and excluded pending/rejected/revoked accounts.
- [ ] Test role-safe summaries for payout, routing, Focus, intake, and guidance changes; assert Staff notices never contain payout fields and Agent notices never contain Staff-only routing fields.
- [ ] Implement `buildUpdateNotice` with a stable operation-derived notice ID for idempotent fanout.

## Task 2: Publish notices from Admin writes

**Files:** `src/services/adminRateWriteService.ts`, `src/services/updatesService.ts`, service tests.

- [ ] Test no notices publish when canonical/projection writes fail and that retrying an operation does not duplicate user notices.
- [ ] Test grouped change summary such as “7 schools moved to Focus” includes affected IDs but no fields beyond recipient access.
- [ ] Implement `publishUpdateNotices` to re-check current access, write per-user notices in bounded batches, and report incomplete fanout for safe retry.
- [ ] Connect successful Admin create/edit/bulk edit/import/intake migration paths to the publisher; leave delete notices out unless the spec explicitly adds deletion notices.

## Task 3: Enforce recipient-only notice access

**Files:** `firestore.rules`, Firestore emulator rules tests.

- [ ] Test owner can read their own notices and update read state, cannot alter notice content or another user's state; users outside the Admin domain cannot create notices.
- [ ] Implement rules for `/user_updates/{uid}/items/{noticeId}` with account ownership for reads/read-state updates and allowlisted Admin writes for notice content.
- [ ] Verify an Agent cannot query or listen to Staff or other Agent notice paths.

## Task 4: Build persistent Updates UI

**Files:** `src/hooks/useUpdates.ts`, `UpdatesPanel.tsx`, `UpdateNoticeCard.tsx`, `ChatView.tsx`, UI tests.

- [ ] Test unread badge count, return summary, grouped update text, open-results action, and read-on-open behavior.
- [x] Implement per-user update history UI; opening a notice marks it read and filters the current role-safe result view by affected school IDs.
- [ ] Test no-data, loading, offline/stale, and read-write failure states without displaying unauthorized data.

## Task 5: Add Admin Dashboard/Chat switch and integrate side section

**Files:** `src/components/AppLayout.tsx`, `src/App.tsx`, `ChatView.tsx`, navigation tests.

- [ ] Test Admin can switch Dashboard to Chat and back while Agent/Staff see only their dedicated Chat page plus banner/count tiles.
- [x] Implement header switch for Admin and mount persistent Favorites, History, Updates navigation for Agent/Staff chat layout.
- [ ] Verify switching pages preserves current Admin dashboard state and role changes/account sign-out clear role-specific listeners.
- [ ] Run build, lint, and Firestore emulator rule tests; expected: no compile/lint errors and all access/UI cases pass.

## Execution Notes

- Depends on the secure access/rate model plan and the Chat/Search plan.
- The rate write service must finish canonical and projection writes before it emits an update summary; partial fanout must be resumable and duplicate-safe.
- The Admin domain rule must be in place before notice-write rules can be validated end-to-end.
