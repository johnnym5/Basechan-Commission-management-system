# System Audit Remediation Roadmap Design

**Date:** 2026-10-19  
**Status:** Approved for planning  
**Scope:** Security, local-first rate editing, quota recovery, mobile performance/accessibility, and project documentation.

## Goal

Address the highest-risk findings from the system review in an ordered, independently verifiable sequence while preserving the current role-safe data model and local-first read behavior.

## Context and constraints

- The current branch is `main`, three commits ahead of `origin/main`, with substantial uncommitted changes. Planning and later implementation must preserve those changes; do not reset, overwrite, or assume they are complete.
- The Admin authorization currently derives privilege from the email domain in both client access resolution and Firestore rules. The proposed design moves Admin privilege to an explicit UID allowlist.
- The local-first rate-edit design and implementation plan already exist at `docs/superpowers/specs/2026-10-19-local-first-rate-editing-design.md` and `docs/superpowers/plans/2026-10-19-local-first-rate-editing.md`. Continue those artifacts rather than duplicating their queue design.
- The role-safe Agent/Staff design and implementation plan already exist at `docs/superpowers/specs/2026-10-19-role-safe-agent-staff-rate-sources-design.md` and `docs/superpowers/plans/2026-10-19-role-safe-agent-staff-rate-sources.md`.
- Keep Firebase, React, TypeScript, IndexedDB, and the existing deterministic local search model. Do not add a server queue or replace the backend as part of this remediation.
- Quota-limited mode and true offline mode remain distinct states. Local reads continue in both; normal Firestore activity stops during quota lockout except for the scheduled probe.

## Recommended approach

Deliver five subprojects in sequence. Each subproject has its own implementation plan and verification gate, so a security fix can ship independently from the longer offline-editing and UX work. A small master roadmap will link to the plans and track prerequisites, rollout order, and completion evidence.

### 1. Admin authorization hardening

- Determine Admin role from an Admin UID record in `admins/{uid}`, not merely an email suffix or a client-editable profile field.
- Make Firestore rules independently enforce Admin membership and verified email for privileged business-data operations. Keep Staff suffix and Agent approval/organization checks aligned with existing role rules.
- Allow a signed-in account to read only its own Admin-membership record; Admin membership writes stay outside the client application.
- Before deploying the stricter rules, enumerate current Admin UIDs and seed the allowlist. Do not infer the allowlist from all accounts on the company email domain.
- The initial approved Admin email allowlist is exactly `egbase@basechaninternational.com` and `ithub@basechaninternational.com`. Resolve each to its Firebase Auth UID, verify the email is verified and matches, then seed only those UIDs in `admins/{uid}`. Email-domain membership alone never grants Admin.
- Update client role resolution and offline role metadata so cached Admin mode is only available to accounts previously verified as Admin. A server denial must prevent privileged access and clear or quarantine Admin-only local state according to the existing revocation flow.

### 2. Finish local-first rate editing

- Continue the existing approved design and plan for durable per-UID IndexedDB queueing, optimistic local snapshots, idempotent sync, conflict handling, and an Admin-only queue view.
- Route every interactive Admin rate mutation through that queue, including existing direct `MasterTable` writes. Keep import/sheet-management scope as specified by the existing design.
- A local save is confirmed only after the queue entry and optimistic rate update commit atomically. A change is called synced only after canonical data, role projections, feed, audit, and applicable notices are complete.
- Preserve the stable operation ID after timeouts, partial writes, quota errors, or lost responses. Conflicts require an explicit Admin decision.

### 3. Correct quota retry and mode recovery

- Replace the fixed UTC reset calculation with a tested Pacific-time calculation that handles daylight-saving transitions. Treat Firebase's documented reset as approximate, not as a guarantee that access has returned.
- Keep the existing 12-hour probe cadence from the local database design while quota remains exhausted. If the browser is offline at probe time, wait for the `online` event; do not issue the probe early on routine navigation or chat actions.
- A successful probe verifies current user/role/organization access, catches local data up, and only then restores normal online mode. A repeated quota error preserves local data and reschedules; true connectivity loss follows its separate retry path.
- Centralize the application-level network gate so listeners, writes, and refresh controls do not create repeated Firestore traffic while quota mode is active.

### 4. Mobile performance and accessibility

- Split admin-only screens and spreadsheet parsing from the initial user-facing bundle using actual lazy boundaries; verify that static imports do not pull them back into the main chunk.
- Convert clickable metric cards to semantic buttons or links with keyboard operation, visible focus, accessible names, and pressed/selected state where appropriate.
- Improve mobile metric label readability and maintain comfortable touch targets without changing the approved dark/blue visual direction.
- Preserve reduced-motion behavior and test the chat drawer/sheet, navigation header, and dashboard at narrow viewport widths.
- Set a measured bundle budget after the first split; keep the build warning from reappearing by measuring emitted production chunks rather than merely raising Vite's warning threshold.

### 5. Documentation and release verification

- Align `README.md`, `PROJECT_BRIEF.md`, `Tech Stack.md`, `SECURITY.md`, `STATE.md`, and architecture notes with current roles, providers, local data behavior, and the exact limits of offline editing.
- Remove brittle hardcoded test totals; describe the commands that run unit and Firestore rules tests separately.
- Verify the final integrated state with the production build, unit suite under a stable worker limit, Firestore emulator rules suite, and diff checks. Record failures rather than describing a partial run as green.
- Keep deployment and allowlist seeding as a separate rollout gate after tests pass and the current Admin UID list has been confirmed.

## Acceptance criteria

1. A verified, explicitly allowlisted Admin can perform Admin operations; an unlisted company-domain account cannot read or write canonical rates, migrations, audit logs, or user administration data.
2. Staff and Agent access continues to follow the existing role-safe projections, approval status, organization scope, and visibility settings.
3. Admin rate edits are durable locally before UI confirmation, survive reload, sync idempotently, and expose pending/conflict/failed states without leaking queued data to Staff or Agents.
4. Quota lockout retains the last complete local dataset, issues only scheduled probes, and distinguishes quota recovery from true offline recovery across Pacific daylight-saving changes.
5. The main application bundle excludes Admin-only and spreadsheet-only code until those features are opened, and keyboard users can operate dashboard metric filters.
6. Project documentation matches implemented behavior and lists reliable verification commands.
7. Build, unit tests, and Firestore rules tests complete successfully on the reviewed implementation state.

## Risks and rollout

- **Admin lockout during migration:** seed and validate the explicit UID allowlist before publishing stricter rules; keep a documented console-based recovery path.
- **Offline revocation delay:** a disconnected device cannot learn that an account was revoked until it reaches the server. Preserve the existing last-verified offline access policy and make this limitation explicit.
- **Partial queue sync:** retain queue items and operation IDs across ambiguous results; do not mark synced until every required propagation stage succeeds.
- **Chunk splitting regressions:** lazy imports can affect first-open latency and route behavior; verify both initial bundle size and each deferred screen.
- **Dirty baseline:** capture and review the existing working-tree diff before implementation. Do not discard or silently absorb unrelated changes.

## Out of scope

- Replacing Firebase or introducing a server-side queue service.
- Redesigning the chat interpreter or changing role-specific business rules.
- Broad refactoring of `AppLayout` or `MasterTable` beyond boundaries needed for the scoped work.
- Deploying changes before the explicit Admin UID list and passing verification are confirmed.
