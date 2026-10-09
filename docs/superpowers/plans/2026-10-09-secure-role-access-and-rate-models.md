# Secure Role Access and Rate Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce role and organization access in Firestore and provide separate Agent and Staff rate read models without server functions.

**Architecture:** Keep canonical rate data Admin-only and project role-safe documents through one Admin client write service. Agents receive only their approved organization/default payout data plus their own overrides; Staff receive routes and guidance without Agent payout fields. Firestore rules, not UI checks, enforce each boundary.

**Tech Stack:** React 19, TypeScript 6, Firebase Auth and Firestore 10.14, Firestore Security Rules.

**Spec:** `docs/superpowers/specs/2026-10-09-agent-staff-chat-search-design.md` (sections 2 and 3).

## Global Constraints

- Do not add Cloud Functions or external server services.
- Admin identity uses the trusted `@basechaninternational.com` email domain; `users.role` is not authoritative for security.
- Staff emails end in `.basechaninternational@gmail.com`, such as `name.basechaninternational@gmail.com`.
- Every Agent, including existing accounts, must be approved for one organization before reading rate data.
- Rate precedence is Agent override, then organization override, then shared default Agent rate.
- Staff projections exclude Agent payout values; Agent projections exclude Staff-only routing/aggregator values.
- Admin edits must update canonical records, projections, audit records, and applicable update events through a shared write path.
- Preserve the user's current uncommitted changes when implementing this plan.

## Review Focus

- Direct Firestore reads by pending/rejected/revoked Agents must fail, including queries that bypass the UI; pin in Firestore rules emulator tests.
- Cross-organization Agent reads must fail; pin with two approved users in different organizations.
- Staff must never read Agent payout or master rate fields; pin with direct document and collection query tests.
- Agent must never read Staff routing-only fields or another Agent's override; pin with role and ownership rules tests.
- Projection writes exceeding Firestore batch limits must not silently leave mismatched views; pin with write-service chunk/recovery tests.

---

## File Map

- Modify `src/context/AuthContext.tsx`: resolve identity, role, organization, and access state; expose them to the app.
- Modify `src/types/index.ts`: add organization membership, access request, and role-projection document types.
- Modify `firestore.rules`: enforce Admin domain, domain Staff, approved Agent membership, ownership, and protected writes.
- Create `src/services/accessRequestService.ts`: create and observe Agent organization/access requests; expose typed request status.
- Modify `src/components/LoginView.tsx`: new Agent onboarding organization selection/request.
- Modify `src/components/UserManagementView.tsx`: organization management and pending/rejected/approved/revoked access actions.
- Create `src/services/adminRateWriteService.ts`: single Admin write interface for canonical rates, projections, audit, and update event records.
- Modify `src/components/AddRateModal.tsx`, `BatchEditModal.tsx`, `EditRateModal.tsx`, `MasterTable.tsx`, `MigrateIntakeModal.tsx`, and `src/utils/firestoreBatcher.ts`: route all Admin rate writes through the shared service.
- Modify `src/hooks/useCommissionRates.ts`: consume the role-safe model for the current identity.
- Add `vitest.config.ts`, `src/test/setup.ts`, and package scripts/dependencies for Vitest and Firestore rules tests.
- Create focused tests under `src/**/__tests__` for role resolution, access requests, projection shaping, rate precedence, and Firestore rules.

## Interfaces

- `resolveUserAccess(input: { email: string | null; adminDomainMatch: boolean; accessRequest?: AgentAccessRequest }): UserAccess` returns `{ role: UserRole; accessState: 'staff' | 'pending' | 'approved' | 'rejected' | 'revoked' | 'admin'; organizationId?: string }`.
- `requestOrganizationAccess(input: { uid: string; email: string; organizationId?: string; requestedOrganizationName?: string }): Promise<void>` creates a pending Agent request; exactly one organization choice is required.
- `setAgentAccessStatus(input: { uid: string; status: 'approved' | 'rejected' | 'revoked'; organizationId: string; adminUid: string }): Promise<void>` records an Admin decision and immutable decision metadata.
- `applyRateChange(input: AdminRateChange): Promise<RateChangeResult>` writes canonical changes and all affected projections in bounded batches, returning affected rate IDs and per-stage status.
- `projectStaffRate(rate: CommissionRate): StaffRateReadModel` and `projectAgentRate(rate: CommissionRate, effectiveAgentRate: number): AgentRateReadModel` explicitly select allowed fields; they never spread canonical records.

## Task 1: Establish the shared test harness

**Files:** `package.json`, lockfile, `vitest.config.ts`, `src/test/setup.ts`, `firebase.json`.

- [ ] Add Vitest for TypeScript tests and `@firebase/rules-unit-testing` plus Firebase CLI emulator support for Firestore rules tests.
- [ ] Add `test` and `test:rules` scripts; configure the Firestore emulator on a non-conflicting local port and test setup cleanup.
- [ ] Add one passing pure TypeScript smoke test and one Firestore rules emulator smoke test; run both commands and confirm PASS.

## Task 2: Model access and projection types

**Files:** `src/types/index.ts`; test file for the new types/helpers.

- [ ] Add `Organization`, `AgentAccessRequest`, `UserAccess`, `StaffRateReadModel`, and `AgentRateReadModel` types with explicit access-state unions and role-safe fields.
- [ ] Add tests proving Staff model has no payout properties and Agent model has no routing/aggregator properties.
- [ ] Run the focused type/helper test command established by the repository test harness; expected: all new type-shaping assertions pass.

## Task 3: Implement role resolution and Firestore authorization

**Files:** `src/context/AuthContext.tsx`, `src/services/accessRequestService.ts`, `firestore.rules`, focused unit and emulator rules tests.

- [ ] Write role-resolution tests for Admin domain, exact Staff domain, other Agent, and every Agent access state.
- [ ] Implement `resolveUserAccess` and expose resolved access state from AuthContext; never trust a writable `users.role` as Admin authority.
- [ ] Write Firestore rules tests for role isolation, same-org membership, pending/revoked denial, self-profile field limits, and Admin-only canonical access.
- [x] Implement rules and validate with the Firestore emulator rules test command; all current allowed/denied cases pass.

## Task 4: Add Agent organization onboarding and Admin approval

**Files:** `src/services/accessRequestService.ts`, `src/components/LoginView.tsx`, `src/components/UserManagementView.tsx`, focused service/UI tests.

- [ ] Test existing and new Agent accounts both receive a pending request and cannot read rate models until approval.
- [ ] Implement organization dropdown, request-add-organization path, and pending status display. If the requested organization is missing, Admin sees the request, creates the organization, and approves or rejects the Agent's access from User Management. Only Admin can create organization records.
- [ ] Implement Admin queue actions for approve, reject, later approve, and revoke, with current status reflected for the Agent.
- [ ] Test that Staff sign-in bypasses Agent organization approval and that rejected/revoked Agent records remain denied by rules.

## Task 5: Build projections and resolve effective Agent rates

**Files:** new `src/services/rateProjectionService.ts`, `src/types/index.ts`, projection tests.

- [ ] Test projection shaping from a canonical `CommissionRate` without leaking disallowed fields.
- [ ] Test rate resolution for Agent override > organization override > default, including missing override and explicit clear.
- [ ] Implement `projectStaffRate`, `projectAgentRate`, and `resolveEffectiveAgentRate` with explicit field mapping.
- [ ] Add migration/backfill utility for canonical rates into role-specific document paths and report counts/errors without exposing full records to users.

## Task 6: Centralize Admin rate writes and projection synchronization

**Files:** `src/services/adminRateWriteService.ts`, all six existing rate write callers, audit utilities, focused service tests.

- [ ] Test a single rate edit, bulk edit, import, intake migration, and delete each update canonical records and the correct projections.
- [ ] Test preserved and replaced Agent overrides for organization and broad rate changes; test clearing an Agent override falls back correctly.
- [ ] Implement `applyRateChange` with deterministic affected-ID planning, bounded Firestore batches, an operation record, and resumable failure reporting for partial multi-batch work.
- [ ] Route every direct Admin rate write path listed in the file map through the service; remove duplicate projection/audit logic from callers.
- [ ] Verify `rg` finds no remaining direct Admin writes to canonical rate collections outside the service and migration path.

## Task 7: Switch role-safe reads and complete security validation

**Files:** `src/hooks/useCommissionRates.ts`, `src/components/AgentPortalView.tsx`, `src/components/StaffPortalView.tsx`, Firestore rules tests.

- [ ] Test approved Agent reads are scoped to their organization plus own overrides and Staff reads are limited to Staff projection.
- [ ] Update the hook to select the correct projection and combine Agent layers without fetching canonical records.
- [ ] Clear role-sensitive state on sign-out, account switch, and access revocation; show stale/offline state when appropriate.
- [ ] Run production build, lint, and Firestore rules emulator tests; expected: no type/lint errors and all security cases pass.

## Execution Notes

- Enforce the Admin domain rule directly in Firestore rules; do not treat the user's writable `users.role` as authority. Users at that domain retain full Admin permissions.
- The shared write service and Admin projections are prerequisites for the Chat/Search and Updates plans.
- Keep existing working-tree edits intact and inspect diffs before modifying any listed file.
