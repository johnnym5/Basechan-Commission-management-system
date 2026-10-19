# Admin Authorization Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grant Admin privileges only to the two explicitly approved, verified Firebase Auth users identified by UID.

**Architecture:** Firestore `admins/{uid}` is the privilege source of truth. Client role resolution requires a verified email matching the approved seed identity and a successful membership lookup; Firestore rules independently require verified email and the caller's own Admin UID document. Client code cannot create or modify Admin membership.

**Tech Stack:** React, TypeScript, Firebase Auth, Firestore, Firestore Rules, Vitest, Firebase Emulator.

**Spec:** `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md`

## Global Constraints

- Initial approved email identities: `egbase@basechaninternational.com` and `ithub@basechaninternational.com` only.
- Normalize email case/whitespace for comparison; never grant Admin based on a domain suffix.
- Resolve each approved email to a current Firebase Auth UID and verify `emailVerified` before writing `admins/{uid}`.
- Membership documents are provisioned through a trusted administrative channel; no client-side Admin membership writes.
- Existing Staff/Agent approval and organization rules remain intact.
- Preserve all current working-tree changes and review the current `firestore.rules`, `accessPolicy.ts`, and auth flow before editing.

## Review Focus

- Company-domain user without membership is not Admin.
- Membership caller with unverified email is denied privileged operations.
- UID/email mismatch or changed UID does not silently retain privileges.
- Admin membership reads are limited to the caller's own document; client membership writes are denied.
- Existing role-specific Staff/Agent behavior remains unchanged.

---

### Task 1: Define and test the explicit Admin identity policy

**Files:**
- Modify: `src/services/accessPolicy.ts`
- Test: `src/services/accessPolicy.test.ts` (or existing access-policy test file)
- Reference: Firebase Auth user shape and current Admin profile/membership model

**Interfaces:**
- Add a typed Admin identity policy containing only the two approved normalized emails.
- `resolveAccessPolicy(user, membership)` (adapt current signature) returns Admin only when `user.emailVerified === true`, normalized email is in the approved set, and membership UID equals `user.uid`.
- Missing membership, lookup failure, unverified email, and unapproved email resolve to non-Admin/denied privileged access.

- [ ] **Step 1: Add failing policy tests** for both approved identities, case-normalized email, unverified email, missing membership, mismatched UID, and another `@basechaninternational.com` account.
- [ ] **Step 2: Run** `npm test -- --run src/services/accessPolicy.test.ts`; confirm the domain-based Admin case incorrectly passes before implementation.
- [ ] **Step 3: Implement UID-and-verification based Admin resolution** without changing Staff/Agent rules.
- [ ] **Step 4: Run the focused policy tests**; expect only explicitly approved verified identities with matching membership to be Admin.

### Task 2: Enforce the policy independently in Firestore Rules

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestoreRules.test.ts`

**Interfaces:**
- `isAdmin()` checks authenticated caller, `request.auth.token.email_verified == true`, and existence of `admins/{request.auth.uid}`; do not compare email domain for Admin.
- `match /admins/{uid}` permits signed-in users to read only their own membership record and denies client create/update/delete.
- All privileged rate, migration, audit, and user-administration rules use the centralized `isAdmin()` predicate.

- [ ] **Step 1: Add emulator tests** for each privileged collection with allowlisted, unlisted domain, unverified, mismatched UID, and unauthenticated callers; assert own membership read only and all client writes denied.
- [ ] **Step 2: Run** `npm run test:rules`; confirm the domain-only and unverified-user tests fail against current rules.
- [ ] **Step 3: Implement centralized membership-based rules** and preserve existing Staff/Agent scoped checks.
- [ ] **Step 4: Run** `npm run test:rules`; expect privileged access only for verified membership users.

### Task 3: Resolve and seed the two approved UIDs safely

**Files:**
- Create: `docs/security/admin-allowlist-rollout.md`
- Modify: `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md` only if verified rollout facts change

**Interfaces:**
- Provision exactly two `admins/{uid}` documents for the currently verified Firebase Auth accounts whose normalized emails match the approved identities.
- Do not include email as a client-authoritative role flag; membership document may retain audit metadata such as `createdAt` and `createdBy` if supported by current rules.

- [ ] **Step 1: Document a read-only identity resolution checklist** using Firebase Console/Admin SDK: locate each exact email, verify account is enabled and verified, record UID, and verify uniqueness.
- [ ] **Step 2: Document the trusted seed procedure** for the correct project, the exact two UIDs, a post-seed readback, and rollback/recovery instructions.
- [ ] **Step 3: Verify** no client app flow can create or edit Admin membership and no broad-domain seeding is described.

### Task 4: Integrate cached access and revocation behavior

**Files:**
- Modify: `src/services/accessPolicy.ts` and existing auth/access hooks discovered in repository
- Test: corresponding access hook tests and `src/components/AppLayout.test.tsx`

**Interfaces:**
- Cached Admin mode may be restored only for a UID with a prior successful verified membership result, according to the existing offline access policy.
- A definitive server denial clears or quarantines Admin-only access state and prevents privileged screens/actions.

- [ ] **Step 1: Add failing tests** for offline cached allowlist behavior, account switching, revoked membership, and server denial.
- [ ] **Step 2: Implement the minimal cache/revocation integration** using existing auth state rather than introducing another role store.
- [ ] **Step 3: Run focused auth and AppLayout tests**; expect no cross-account Admin cache leakage and prompt denial after authoritative revocation.

### Task 5: Integrated authorization verification

- [ ] **Step 1: Run** `npm test -- --run src/services/accessPolicy.test.ts src/components/AppLayout.test.tsx`.
- [ ] **Step 2: Run** `npm run test:rules`.
- [ ] **Step 3: Review all Admin checks** with `rg` for email suffix/domain checks and verify none grant Admin privilege.
- [ ] **Step 4: Run** `git diff --check` and record UID seeding as a separate operational rollout gate; do not deploy rules before seed verification.
