# System Audit Remediation Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved system audit remediation as independently verifiable subprojects, ordered by risk and preserving work already in progress.

**Architecture:** Keep the existing Firebase, React, TypeScript, IndexedDB, and deterministic local search architecture. Execute authorization hardening first, then complete the existing local-first rate editing and role-safe data plans, then quota recovery, mobile improvements, and documentation/release verification.

**Tech Stack:** React, TypeScript, Firebase Auth/Firestore, Firestore Rules, IndexedDB, Vitest, React Testing Library, Firestore Emulator, Vite.

**Spec:** `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md`

## Global Constraints

- Preserve all existing uncommitted changes and the three local commits ahead of `origin/main`; inspect diffs before implementation and do not reset, overwrite, or discard work.
- Admin access is UID-allowlisted and requires verified email; the initial approved emails are exactly `egbase@basechaninternational.com` and `ithub@basechaninternational.com`.
- Staff and Agent rate sources remain role-safe; client-only role flags do not grant access.
- Local reads continue in offline and quota-limited modes; quota and connectivity failure remain distinct states.
- No new server queue, backend replacement, chat interpreter redesign, or deployment is included.
- Reuse `2026-10-19-local-first-rate-editing.md` and `2026-10-19-role-safe-agent-staff-rate-sources.md`; do not duplicate their queue or role-source design.

## Review Focus

- Existing company-domain account without allowlisted UID: prove it cannot enter Admin paths (Admin plan).
- Initial approved email absent, unverified, or UID changed: prove rollout blocks safely and documents recovery (Admin plan).
- Pacific daylight-saving boundary or probe-time offline state: prove quota retry schedules safely (quota plan).
- Narrow viewports, keyboard-only metric selection, and reduced-motion preference: prove usable dashboard/chat behavior (mobile plan).
- Emulator/build/test failure or dirty unrelated diff: report it accurately and preserve it (release plan).

---

### Task 1: Admin authorization hardening

**Plan:** `docs/superpowers/plans/2026-10-19-admin-authorization-hardening.md`

- [ ] Resolve and independently verify the Firebase Auth UIDs for the two approved emails.
- [ ] Implement and test UID-based Admin authorization in client access resolution and Firestore rules.
- [ ] Seed only those two UID documents through a privileged, documented procedure; verify a domain-only account remains non-Admin.
- [ ] Pass focused unit and Firestore rules tests before proceeding to release.

### Task 2: Finish the local-first rate edit and role-safe data work

**Plans:**
- `docs/superpowers/plans/2026-10-19-local-first-rate-editing.md`
- `docs/superpowers/plans/2026-10-19-role-safe-agent-staff-rate-sources.md`

- [ ] Review current implementation diffs against both plans; mark only evidenced completed steps and retain uncommitted work.
- [ ] Complete durable per-UID queueing, idempotent write propagation, conflict handling, Admin queue UI, and all interactive mutation routing.
- [ ] Complete Staff/Agent role-specific projections, exact eligible Agent payout selection, directory behavior, and Firestore boundaries.
- [ ] Run both plans' focused gates, then the integrated build/unit/rules gates.

### Task 3: Quota retry and mode recovery

**Plan:** `docs/superpowers/plans/2026-10-19-quota-retry-and-mode-recovery.md`

- [ ] Keep quota lockout separate from offline mode and suppress routine Firestore activity while quota-locked.
- [ ] Use a tested Pacific reset estimate and the approved 12-hour probe cadence; never promise the estimate restores access.
- [ ] Verify role/access on successful probe before reconciling local data and returning online.

### Task 4: Mobile performance and accessibility

**Plan:** `docs/superpowers/plans/2026-10-19-mobile-performance-and-accessibility.md`

- [ ] Establish production chunk baseline and lazy-load admin/spreadsheet-only areas.
- [ ] Make dashboard metric filters semantic, keyboard-operable controls with readable mobile labels and touch targets.
- [ ] Verify reduced motion, narrow layouts, and deferred screen loading.

### Task 5: Documentation and release verification

**Plan:** `docs/superpowers/plans/2026-10-19-documentation-and-release-verification.md`

- [ ] Update docs only after behavior is implemented and verified.
- [ ] Run build, unit suite with stable worker limit, Firestore emulator rules suite, and `git diff --check`; report each result.
- [ ] Confirm the two seeded Admin UIDs and rule rollout readiness before any deployment. Deployment remains a separate explicit release action.

### Task 6: Closeout

- [ ] Review the complete diff for unintended role/data leaks, accidental scope expansion, and unresolved queue states.
- [ ] Record passing and failing gates, migrations, operational steps, and known limitations in the release notes/docs.
- [ ] Keep implementation and deployment as separate approvals; do not publish rules before allowlist seeding and verification.

## Execution Order and Dependencies

1. Task 1 is the security gate and must precede privileged rule deployment.
2. Task 2 reuses two existing plans and is the local data correctness gate.
3. Task 3 depends on stable local read/write mode boundaries from Task 2.
4. Task 4 can proceed after the role-safe dashboard surface settles; avoid overlap with active UI edits.
5. Task 5 follows implementation and captures the verified system rather than intended behavior.

## Rollout Gate

Before Firestore rules deployment, confirm both Firebase Auth accounts are verified, resolve their current UIDs, write only those UIDs to `admins/{uid}` using a trusted administrative channel, and exercise both allowlisted and non-allowlisted accounts in the emulator/staging project. Do not deploy if either account identity is unresolved or tests fail.
