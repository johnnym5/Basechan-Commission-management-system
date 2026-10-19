# Role-Safe Agent and Staff Rate Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent and Staff rate views consume only their authorized role-specific Firestore models, with exact Basechan/Direct payout matching for Agents.

**Architecture:** Keep Admin on canonical `rates` and `rate_sheets`. Route Staff and approved Agents through `syncLocalRateData` and UID-scoped local snapshots, with no canonical bucket hydration. Restrict the Agent projection and selectors to eligible Basechan/Direct payout rows, keep Staff's safe routing projection, and enforce those boundaries in Firestore rules.

**Tech Stack:** React, TypeScript, Firebase Firestore, IndexedDB local rate cache, Vitest, Firestore Emulator.

**Spec:** `docs/superpowers/specs/2026-10-19-role-safe-agent-staff-rate-sources-design.md`

## Global Constraints

- Admin continues using canonical `rates` and the existing `rate_sheets` bucket path.
- Staff and Agent views must not load or cache canonical `rate_sheets` or `rates` records.
- Agent payout sources are only canonical Basechan/Direct sub-agent records plus eligible Agent organization/personal overrides.
- Agent rate lookup uses exact university ID, study level, and intake; no FOCUS priority, cross-intake lookup, or first-route fallback.
- Staff retains FOCUS then top-yield route selection and receives no master, payout, or margin values.
- Firestore `rate_sheets` reads are Admin-only; Staff identity checks match `*.basechaninternational@gmail.com`.
- Rebuild the Agent projection through the existing Admin migration once; do not add reload-time projection writes.
- Firestore read/write optimization is out of scope.

## Review Focus

- A Focus third-party route coexists with an eligible Basechan payout: Agent sees the Basechan payout. Test in Task 2.
- A requested level or intake has no eligible payout but another tuple does: show no rate for the missing tuple. Test in Task 2.
- A university has no Agent payout rows at all: keep it in the directory and show “No rate for this school”. Test in Task 4.
- Staff cache contains legacy canonical buckets from an earlier app version: Staff ignores them and hydrates only its UID-scoped safe snapshot. Test in Task 1.
- Similar but unrecognized Staff email and non-admin canonical sheet reads: both are denied. Test in Task 5.

---

### Task 1: Route role sync through safe role-specific sources

**Files:**
- Modify: `src/hooks/useCommissionRates.ts`
- Test: `src/hooks/useCommissionRates.test.ts`
- Reference: `src/services/rateSyncService.ts`, `src/services/localRateDatabase.ts`

**Interfaces:**
- Consume `syncLocalRateData(scope): Promise<RateSyncResult>` and `getLocalRates(uid)`, `getLocalAgentOverrides(uid)`.
- Keep `syncRateSheetsCacheFirst(scope)` exclusive to Admin.

- [ ] **Step 1: Add failing role source tests**
  - Verify Admin invokes `syncRateSheetsCacheFirst` and not `syncLocalRateData`.
  - Verify Staff and approved Agent invoke `syncLocalRateData` with UID, role, and organization scope, and never invoke `syncRateSheetsCacheFirst`.
  - Seed mocked global buckets/canonical global rates and assert Staff/Agent do not expose them; Agent merges only local Agent snapshot and override layers.
- [ ] **Step 2: Run** `npm test -- --run src/hooks/useCommissionRates.test.ts`; expected: new Staff/Agent source assertions fail.
- [ ] **Step 3: Implement role-specific hydration and refresh**
  - Keep Admin's current global/user bucket plus canonical cache hydration and cache-first refresh.
  - For Staff/Agent, hydrate only `getLocalRates(uid)` and, for Agent, `getLocalAgentOverrides(uid)`; refresh through `syncLocalRateData(scope)` then read the UID snapshot and merge eligible Agent layers.
  - Preserve offline, quota, loading, access-state, and error behavior without using shared buckets for Staff/Agent.
- [ ] **Step 4: Run** `npm test -- --run src/hooks/useCommissionRates.test.ts`; expected: all role source tests pass.

### Task 2: Restrict Agent projection, override writes, and exact selection

**Files:**
- Modify: `src/services/rateReadModels.ts`, `src/services/dashboardData.ts`, `src/components/MasterTable.tsx`, `src/components/AgentPortalView.tsx`, `src/components/UserManagementView.tsx` (only if assignment selection needs eligibility filtering)
- Test: `src/services/rateReadModels.test.ts`, `src/services/dashboardData.test.ts`, `src/components/MasterTable.test.tsx`, relevant Agent view tests

**Interfaces:**
- Add/export `isEligibleAgentPayout(rate: Pick<CommissionRate, 'aggregator'>): boolean`; accept normalized `BASECHAN`, `DIRECT`, and any documented direct alias already present in repository data.
- `buildAgentProjection(rate)` must only be called for eligible rows; override assignment rejects ineligible rows.

- [ ] **Step 1: Add failing projection and selector tests**
  - Assert third-party canonical rows are excluded from the shared Agent projection and assignment path.
  - Assert Basechan and Direct rows remain projectable and overrideable.
  - Given third-party FOCUS + Basechan for one exact tuple, Agent selection returns the Basechan payout.
  - Given no eligible row for the tuple, Agent selection returns no row despite other tuples or third-party rows.
  - Assert Staff still selects FOCUS, else top-yield.
  - Cover exact tuple behavior and legacy `AgentPortalView` route rendering.
- [ ] **Step 2: Run focused Vitest files; expected: new eligibility and no-fallback cases fail.**
- [ ] **Step 3: Implement eligible Agent projection and exact selection**
  - Filter `buildAgentProjection` inputs in read-model rebuild/sync and migration, and skip ineligible assignment writes.
  - Remove Agent FOCUS and arbitrary-route fallbacks in `buildDashboardRates`, `GroupRoutesModal`, and `AgentPortalView`; match only the exact tuple.
  - Keep Staff route selection unchanged.
- [ ] **Step 4: Run the focused Vitest files; expected: all Agent selection/projection tests pass.**

### Task 3: Version and rebuild the Agent role-rate model

**Files:**
- Modify: `src/services/rateReadModels.ts`, `src/services/rateReadModels.test.ts`

**Interfaces:**
- Continue using `ensureRoleRateModelMigration(rates, adminEmail, force?)` and existing `admin_migrations` mechanism.
- Bump the migration document/version once from the currently deployed role-rate-model version.

- [ ] **Step 1: Add failing migration tests**
  - Assert migration rebuilds `agent_rates` from only eligible, visible Basechan/Direct rows.
  - Assert third-party defaults are absent after rebuild, while existing eligible override precedence is retained.
  - Assert migration is idempotent for the new version and does not run for non-admin callers.
- [ ] **Step 2: Run** `npm test -- --run src/services/rateReadModels.test.ts`; expected: migration version/rebuild assertions fail.
- [ ] **Step 3: Implement new migration version using existing Admin mechanism**
  - Ensure the rebuild clears stale Agent defaults and writes eligible projections only; do not introduce role-client startup writes.
- [ ] **Step 4: Run** `npm test -- --run src/services/rateReadModels.test.ts`; expected: migration tests pass.

### Task 4: Include no-payout universities in the Agent directory

**Files:**
- Modify: `src/components/RoleDashboardView.tsx`, `src/components/AppLayout.tsx` (or add the existing app's smallest directory-loading service/hook), `src/components/RoleDashboardView.test.tsx` (create if absent)
- Test: Agent dashboard view tests

**Interfaces:**
- Use the existing non-financial `University` type and `universities` collection.
- Provide `RoleDashboardView` an Agent directory list of `{ id, name, country? }`; join with Agent payouts using university ID only.

- [ ] **Step 1: Add failing view tests**
  - A directory school with zero eligible payout remains discoverable and renders “No rate for this school”.
  - A school with one payout displays exactly that payout once.
  - Directory payload/rendering contains no financial fields.
- [ ] **Step 2: Run the new focused view test; expected: missing directory prop/empty-state assertions fail.**
- [ ] **Step 3: Load and render the safe university directory for Agent**
  - Read only `id`, `name`, and `country` from `universities`; pass it through the Agent dashboard and join to exact eligible payout rows.
  - Preserve existing search/filter and school route details. Do not expose this directory as a rate source.
- [ ] **Step 4: Run the focused view test; expected: empty and single-payout states pass.**

### Task 5: Enforce Firestore role boundaries

**Files:**
- Modify: `firestore.rules`
- Test: `tests/firestoreRules.test.ts`

**Interfaces:**
- Keep existing collection layouts and Agent organization/personal scope checks.
- Staff email predicate must match the app resolver's `.basechaninternational@gmail.com` suffix.

- [ ] **Step 1: Add failing emulator rules tests**
  - Admin can read `rate_sheets`; Staff and approved Agent cannot.
  - Staff with `name.basechaninternational@gmail.com` can read Staff data; broad substring-only matches cannot.
  - Agent projection/override rules retain existing approved-status, organization, and personal-UID behavior.
- [ ] **Step 2: Run** `npm run test:rules`; expected: canonical read and broad Staff identity assertions fail against current rules.
- [ ] **Step 3: Restrict rate-sheet reads and align Staff identity regex**
- [ ] **Step 4: Run** `npm run test:rules`; expected: role-boundary emulator tests pass.

### Task 6: Verify integrated behavior

**Files:**
- Test: existing suite and production build (no new files unless a focused regression is uncovered)

- [ ] **Step 1: Run** `npm test -- --run`; expected: all unit and component tests pass.
- [ ] **Step 2: Run** `npm run build`; expected: production build completes successfully.
- [ ] **Step 3: Review the final diff for role-source leaks**
  - Confirm Staff/Agent code paths do not call bucket sync or read canonical rate documents.
  - Confirm no Agent selector uses FOCUS or fallback routes.
  - Confirm Admin default-intake change already present in `MasterTable.tsx` remains intact.
- [ ] **Step 4: Report implementation, verification results, migration action, and that Firestore cost optimization remains deferred.**
