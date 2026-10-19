# Documentation and Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure project documentation describes verified role, offline, quota, and release behavior, then produce an accurate integrated verification record.

**Architecture:** Update documentation after behavior is implemented, using code and test evidence as the source of truth. Run unit, Firestore rules, build, and diff gates separately and record exact outcomes; deployment and Admin UID seeding remain a separate rollout gate.

**Tech Stack:** Markdown, npm scripts, Vitest, Firebase Emulator, Vite.

**Spec:** `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md`

## Global Constraints

- Do not edit documentation to claim behavior before it exists and is verified.
- Do not hardcode brittle aggregate test counts; document commands and test scope.
- Report build, unit, rules, and diff results separately and truthfully.
- Do not deploy Firestore rules or application artifacts as part of this documentation task.
- Keep Admin allowlist rollout tied to exactly the approved two accounts and their verified UIDs.

## Review Focus

- README instructions match actual scripts and auth providers.
- Offline editing documentation distinguishes local save, pending sync, synced, conflict, and failure states.
- Quota docs distinguish quota lockout from connectivity loss and describe the 12-hour probe as approximate recovery checking.
- Role and security docs do not imply domain membership grants Admin or expose canonical data to Staff/Agents.
- Verification record reflects current exact command outcomes and dirty-tree state.

---

### Task 1: Audit documentation against shipped implementation

**Files:**
- Review: `README.md`, `PROJECT_BRIEF.md`, `Tech Stack.md`, `SECURITY.md`, `STATE.md`, architecture notes
- Reference: corresponding source, rules, migration code, tests, and approved specs/plans

- [ ] **Step 1: Create a source-to-doc checklist** mapping each role, auth provider, cache/source, offline state, quota state, and verification command to its implementation evidence.
- [ ] **Step 2: Identify stale or unsupported claims** and mark them for revision; remove hardcoded test totals.

### Task 2: Update user/developer and security documentation

**Files:**
- Modify: only the documentation files found stale in Task 1
- Create/update: `docs/security/admin-allowlist-rollout.md` from the Admin plan

- [ ] **Step 1: Update role descriptions** with Admin UID membership, verified-email requirement, Staff identity rule, Agent approval/organization rule, and role-safe rate sources.
- [ ] **Step 2: Update local behavior** with what works from cache, queue states, sync limitations, conflict handling, and quota/offline distinction.
- [ ] **Step 3: Document the exact two approved Admin emails** and the trusted UID provisioning procedure; state that a company email suffix alone is not authorization.
- [ ] **Step 4: Document actual commands** for build, unit tests, and Firestore emulator rules tests without hardcoded totals.
- [ ] **Step 5: Review all updated claims against source/tests** and remove any not yet implemented.

### Task 3: Integrated verification record

**Files:**
- Create: `docs/superpowers/reports/2026-10-19-system-audit-remediation-verification.md`

- [ ] **Step 1: Run** `npm run build`; record exact result and emitted chunk measurements.
- [ ] **Step 2: Run** `npm test -- --run --maxWorkers=2`; record pass/fail summary and any flaky or environmental issue.
- [ ] **Step 3: Run** `npm run test:rules`; record emulator result; if it hangs/fails, include the command and observed issue rather than marking it passed.
- [ ] **Step 4: Run** `git diff --check`; inspect final status and identify unrelated or still-in-progress changes.
- [ ] **Step 5: Record** migration/allowlist actions and unresolved operational gates; do not infer successful deployment.

### Task 4: Final release-readiness review

- [ ] **Step 1: Cross-check** the verification report against command output and current Git state.
- [ ] **Step 2: Verify** allowlist membership is seeded in the intended Firebase project and both approved accounts pass while a domain-only account is denied; otherwise mark release blocked.
- [ ] **Step 3: Confirm** no deployment occurred and provide the exact release gates remaining.
