# Role-Aware Dashboards and Shared Chat FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Admin, Staff, and Agent one responsive dashboard structure with role-limited metrics and filters, plus a Chat FAB that keeps dashboard filters synchronized.

**Architecture:** `AppLayout` owns the role-scoped dashboard filter state. A shared dashboard shell presents Admin's existing analytics and a Staff/Agent role dashboard built from explicit safe view models; deterministic Chat intent maps to and from the same filter contract. The Chat FAB opens one `ChatExperience` in a desktop drawer or mobile popup, leaving the filtered dashboard underneath.

**Tech Stack:** React 19, TypeScript 6, Vite, Firebase role-safe read models, Vitest, Testing Library, existing Tailwind/CSS setup.

**Spec:** `docs/superpowers/specs/2026-10-09-role-aware-dashboards-and-chat-fab-design.md`

## Global Constraints

- The dashboard must not fetch canonical Admin records to populate Staff or Agent views.
- UI filtering is not an authorization boundary; existing Firestore read models and rules remain responsible for access control.
- Do not persist filter state across user or organization changes.
- Staff sees routing and guidance data without payout figures.
- Agents see organization-approved routes and their effective payout without Admin margin data.
- Percentage and flat-fee values are never combined into one average, rank, or threshold comparison.
- A greeting, out-of-scope prompt, ambiguous school match, missing required clarification, or unsupported role field does not apply a new dashboard filter.
- Results and counts are derived locally from the loaded role-safe rate set.
- Opening/closing motion honors `prefers-reduced-motion`; drawer/popup traps focus and restores focus to the FAB.

## Review Focus

- **User or organization changes while Chat is open:** test prior role data, filters, and conversation context are cleared before the new scope is shown (Task 5).
- **Partial or ambiguous Chat query:** test it does not replace dashboard filters until the clarification is resolved (Task 4).
- **Mixed Agent payout units:** test percentage bounds do not include flat-fee records and vice versa (Task 1).
- **Role-hidden fields in search:** test Staff cannot filter on payout and Agent cannot filter on aggregator even if stale or manually supplied state contains those keys (Task 1).
- **Mobile keyboard and reduced motion:** test popup remains usable at a short viewport and reduced-motion mode removes drawer transition timing (Task 5).

---

## File Map

- Create `src/types/dashboard.ts`: `DashboardFilters`, role-discriminated `DashboardRate` rows, and KPI view model types.
- Create `src/services/dashboardData.ts`: project the already role-scoped `CommissionRate[]` returned by `useCommissionRates` into explicit Admin, Staff, or Agent display rows; derive role-safe metrics and filter choices.
- Create `src/services/dashboardFilters.ts`: empty/reset filters, role validation, local filtering, and deterministic Chat-intent mapping.
- Create `src/services/dashboardData.test.ts` and `src/services/dashboardFilters.test.ts`: role field isolation, role visibility, filter combination, and payout-unit cases.
- Create `src/components/DashboardShell.tsx`: shared hero/KPI/analytics/filter/results hierarchy, mobile summary collapse, and shared responsive framing.
- Create `src/components/RoleDashboardView.tsx` and `src/components/RoleDashboardView.test.tsx`: Staff/Agent analytics, role-specific controls, and role-safe route results.
- Modify `src/components/DashboardView.tsx`: preserve Admin metrics, connect it to the shared shell, and expose controlled filter state.
- Modify `src/components/MasterTable.tsx`: accept controlled Admin dashboard filter state for search, country, level, intake, guidance, and aggregator without changing Admin edit permissions.
- Modify `src/services/chatSession.ts`, `src/types/chat.ts`, and their tests: provide active dashboard filters as follow-up context and return a filter update only for a resolved search.
- Modify `src/components/ChatExperience.tsx`, `src/components/ChatExperience.css`, and `src/components/ChatExperience.test.ts`: controlled dashboard filter input/output, “View on dashboard” action, and drawer/popup presentation.
- Create `src/components/ChatAssistantLauncher.tsx` and `src/components/ChatAssistantLauncher.test.tsx`: accessible FAB, desktop drawer, mobile popup, backdrop/keyboard handling, and focus restoration.
- Modify `src/components/AppLayout.tsx`: dashboard landing for all roles, shared role dashboard, Chat FAB for all roles, Admin backend navigation, and per-scope filter reset.

## Interfaces

- `DashboardFilters` contains common `query`, `schoolIds`, `countries`, `levels`, `intakes`, and `guidances`, plus `aggregators` for Staff/Admin and `agentPayoutKind`, `payoutMinimum`, and `payoutMaximum` for Agent/Admin. `ALL` is represented by an empty list or `undefined`, never a magic string in stored filters.
- `DashboardRate` is a discriminated union: Admin rows may include all `CommissionRate` fields; Staff rows include common school/route fields and `aggregator` but no financial fields; Agent rows include common school/route fields and effective payout fields but no `aggregator`, `masterRate`, or `diffMargin`.
- `buildDashboardRates(role: UserRole, rates: CommissionRate[]): DashboardRate[]` in `src/services/dashboardData.ts` copies only fields allowed for that role from the already role-scoped input.
- `applyDashboardFilters(role: UserRole, rates: DashboardRate[], filters: DashboardFilters): DashboardRate[]` in `src/services/dashboardFilters.ts` applies common filters and only role-allowed filter fields; Agent numeric payout filters require `agentPayoutKind` to select `PERCENTAGE` or `FLAT_FEE`.
- `filtersFromChatIntent(role: UserRole, intent: ChatSearchIntent, current: DashboardFilters): DashboardFilters` maps a resolved local search to dashboard filters while preserving compatible context for a recognized follow-up and dropping role-ineligible fields.
- `DashboardShell` receives role title/copy, KPI data, analytics content, controlled filters, and results content; it owns only presentation state such as the mobile overview collapse.
- `RoleDashboardView` receives `role: 'STAFF' | 'AGENT'`, role-discriminated rows, loading state, controlled `DashboardFilters`, and `onFiltersChange`.
- `ChatExperience` receives `dashboardFilters`, `onDashboardFiltersChange`, and `onViewDashboard`; it continues to own conversation state and local query processing.

---

## Task 1: Define safe dashboard rows and deterministic filters

**Files:**
- Create: `src/types/dashboard.ts`
- Create: `src/services/dashboardData.ts`
- Create: `src/services/dashboardFilters.ts`
- Test: `src/services/dashboardData.test.ts`
- Test: `src/services/dashboardFilters.test.ts`

**Interfaces:** Implements `DashboardFilters`, `DashboardRate`, `buildDashboardRates`, `applyDashboardFilters`, and `filtersFromChatIntent` as defined above. It consumes the existing role-scoped `CommissionRate[]` and `ChatSearchIntent`.

- [ ] **Step 1: Write failing projection tests** named `buildDashboardRates omits financial fields for Staff`, `buildDashboardRates omits Admin margin and aggregator for Agent`, and `buildDashboardRates retains full fields for Admin`. Assert sensitive properties are absent, not merely zero.
- [ ] **Step 2: Run `npm test -- src/services/dashboardData.test.ts` and confirm the new module/tests fail for the missing exports.**
- [ ] **Step 3: Implement the role-discriminated view models and allowlist projection in `src/services/dashboardData.ts`.** Derive each role's metric inputs only from its projected fields; do not read `masterRate` or `diffMargin` in non-Admin branches.
- [ ] **Step 4: Write failing filter tests** named `applyDashboardFilters combines common filters`, `Staff filters include portal while excluding payout`, `Agent filters include payout but exclude aggregator`, and `Agent payout range stays within selected fee type`.
- [ ] **Step 5: Implement `createEmptyDashboardFilters`, `applyDashboardFilters`, and role validation in `src/services/dashboardFilters.ts`.** Treat missing payout type with a numeric bound as invalid and return no payout-bound matches until a type is selected.
- [ ] **Step 6: Run `npm test -- src/services/dashboardData.test.ts src/services/dashboardFilters.test.ts` and confirm all focused tests pass.**
- [ ] **Step 7: Commit** the types, selectors, and service tests as `feat: add role-safe dashboard data and filters`.

## Task 2: Build the common dashboard shell and Staff/Agent dashboard

**Files:**
- Create: `src/components/DashboardShell.tsx`
- Create: `src/components/RoleDashboardView.tsx`
- Test: `src/components/RoleDashboardView.test.tsx`
- Modify: `src/components/DashboardView.tsx`
- Test: `src/components/DashboardView.test.tsx`

**Interfaces:** Consumes `DashboardRate`, `DashboardFilters`, `applyDashboardFilters`, and KPI/view-model selectors from Task 1. Produces a shared dashboard hierarchy for Admin, Staff, and Agent.

- [ ] **Step 1: Write failing component tests** named `Staff sees route, school, country, and Focus KPIs without payout metrics`, `Agent sees role-scoped payout routes without margin or aggregator UI`, and `empty role results name active filters and offer clear all`.
- [ ] **Step 2: Run `npm test -- src/components/RoleDashboardView.test.tsx` and confirm the new component is missing.**
- [ ] **Step 3: Implement `DashboardShell` with the shared hero, four-card KPI grid, analytics area, toolbar slot, result region, and mobile-collapsible summary.** Use the existing dark/blue visual style and preserve keyboard-operable filter actions.
- [ ] **Step 4: Implement `RoleDashboardView` for Staff and Agent.** Staff analytics show portal/aggregator routing and guidance counts. Agent analytics show guidance and payout-type counts; rows show effective payout, but no mixed-unit averages/ranks. Both use the same toolbar, KPI layout, active-filter chips, clear-all action, result layout, and pagination.
- [ ] **Step 5: Write and run the Admin regression test** `DashboardView uses shared dashboard shell and retains Admin-only margins and editing controls`; modify `DashboardView` to render through `DashboardShell` without changing Admin metrics or `readOnly` behavior.
- [ ] **Step 6: Run `npm test -- src/components/RoleDashboardView.test.tsx src/components/DashboardView.test.tsx` and confirm all role display tests pass.**
- [ ] **Step 7: Commit** the dashboard components and tests as `feat: add shared role-aware dashboard views`.

## Task 3: Make dashboard filters controlled across Admin and role tables

**Files:**
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/RoleDashboardView.tsx`
- Modify: `src/components/MasterTable.tsx`
- Test: `src/components/DashboardView.test.tsx`
- Test: `src/components/RoleDashboardView.test.tsx`

**Interfaces:** Both dashboard views accept `filters: DashboardFilters` and `onFiltersChange(filters: DashboardFilters): void`. `MasterTable` accepts the Admin-controlled filters it can represent and reports changes through the same callback; it retains existing Admin-only mutations.

- [ ] **Step 1: Add failing tests** named `DashboardView passes country level intake guidance and aggregator filters to MasterTable`, `Staff filter changes update the shared filter object`, `active filter chips reflect controlled state`, and `clear all filters resets all role-specific fields`.
- [ ] **Step 2: Run `npm test -- src/components/DashboardView.test.tsx src/components/RoleDashboardView.test.tsx` and confirm controlled filter assertions fail.**
- [ ] **Step 3: Extend `MasterTable` with controlled filter props** for query, country, level, intake, guidance, and aggregator. When controlled props are supplied, they take precedence over its local filter state; Admin table selection, editing, and batch actions retain existing behavior.
- [ ] **Step 4: Wire `DashboardView` and `RoleDashboardView` to the same controlled `DashboardFilters` object.** KPI and analytics actions update the appropriate field; clear-all resets common and role-specific fields; pagination resets when effective filters change.
- [ ] **Step 5: Run the focused component tests and confirm Staff, Agent, and Admin filters remain synchronized with visible counts and results.**
- [ ] **Step 6: Commit** the controlled-filter integration as `feat: synchronize dashboard filters across role views`.

## Task 4: Map resolved Chat searches to dashboard filters and preserve filter context

**Files:**
- Modify: `src/services/dashboardFilters.ts`
- Modify: `src/services/chatSession.ts`
- Modify: `src/types/chat.ts`
- Test: `src/services/dashboardFilters.test.ts`
- Test: `src/services/chatSession.test.ts`

**Interfaces:** `filtersFromChatIntent(role, intent, current)` produces the next shared filter set. Extend `ChatTurnResult` with optional `dashboardFilters?: DashboardFilters`; extend `processChatTurn(state, rawInput, rates, now, role, activeDashboardFilters?)` so active filters inform recognized follow-ups and a filter update is returned only after clarification is resolved.

- [ ] **Step 1: Write failing tests** named `clear search returns matching dashboard filters`, `greeting leaves dashboard filters unchanged`, `ambiguous school leaves dashboard filters unchanged`, `resolved school choice updates filters`, `Agent intent drops aggregator filters`, and `manual dashboard filters inform recognized Chat follow-ups`.
- [ ] **Step 2: Run `npm test -- src/services/dashboardFilters.test.ts src/services/chatSession.test.ts` and verify the new cases fail.**
- [ ] **Step 3: Implement `filtersFromChatIntent`** using exact resolved school IDs and recognized country, level, intake, guidance, aggregator, and payout constraints. Enforce the role allowlist before returning filters.
- [ ] **Step 4: Extend `processChatTurn` to accept active dashboard filters.** Seed recognized follow-up context from those filters; explicit user terms replace the matching field. Return `dashboardFilters` only when no clarification or unsupported-field response remains.
- [ ] **Step 5: Run the focused service tests and existing local-chat query/session tests; confirm all pass.**
- [ ] **Step 6: Commit** the Chat-to-filter mapping and tests as `feat: sync local chat intent with dashboard filters`.

## Task 5: Add the all-role Chat FAB, desktop drawer, mobile popup, and dashboard handoff

**Files:**
- Create: `src/components/ChatAssistantLauncher.tsx`
- Test: `src/components/ChatAssistantLauncher.test.tsx`
- Modify: `src/components/ChatExperience.tsx`
- Modify: `src/components/ChatExperience.css`
- Test: `src/components/ChatExperience.test.ts`
- Modify: `src/components/AppLayout.tsx`

**Interfaces:** `ChatExperience` receives controlled dashboard filters, `onDashboardFiltersChange`, and `onViewDashboard`, while preserving its existing role, rates, loading, updates, offline, and persistence props. `ChatAssistantLauncher` receives role, open state, filter props, close/view callbacks, and the existing ChatExperience content.

- [ ] **Step 1: Write failing tests** named `Chat FAB opens a right drawer on desktop`, `Chat FAB opens a modal popup on mobile`, `Escape and backdrop close and restore FAB focus`, `closing Chat preserves the composer draft`, `reduced motion removes panel transition`, and `View on dashboard closes Chat and retains active filters`.
- [ ] **Step 2: Run `npm test -- src/components/ChatAssistantLauncher.test.tsx src/components/ChatExperience.test.ts` and confirm the launcher/handoff cases fail.**
- [ ] **Step 3: Implement the Chat FAB and responsive container.** Desktop uses a right drawer; mobile uses a modal popup constrained to viewport height with safe-area and keyboard-aware composer. Add focus trap/return, Escape/backdrop handling, reduced-motion styling, and persistent dashboard visibility behind the panel.
- [ ] **Step 4: Wire Chat to controlled dashboard filters.** Pass active filters to `processChatTurn`, apply returned filters after successful resolved searches, and add “View on dashboard” to result states. It closes Chat and calls the dashboard focus/scroll callback.
- [ ] **Step 5: Update `AppLayout` so all roles land on Dashboard, Staff/Agent receive no backend navigation, Admin retains backend navigation, and all three roles use the same Chat FAB.** Remove the Admin Dashboard/Chat segmented switcher and old full-page Chat route. Reset filters and conversation context on UID, role, access state, or Agent organization scope change.
- [ ] **Step 6: Run `npm test -- src/components/ChatAssistantLauncher.test.tsx src/components/ChatExperience.test.ts src/components/DashboardView.test.tsx src/components/RoleDashboardView.test.tsx` and confirm panel, filter handoff, and dashboard tests pass.**
- [ ] **Step 7: Commit** the launcher, Chat integration, layout, and tests as `feat: add shared dashboard chat assistant panel`.

## Task 6: Verify role isolation, offline behavior, and full regression

**Files:**
- Test: `src/components/AppLayout.test.tsx` (create if a focused layout harness is feasible; otherwise add coverage to the launcher/workspace integration test)
- Test: `src/services/dashboardData.test.ts`
- Test: `src/services/dashboardFilters.test.ts`
- Test: `src/components/ChatExperience.test.ts`
- Modify: implementation files only if a failing acceptance test identifies a gap.

**Interfaces:** Validates the completed dashboard, shared filter state, FAB, and existing role-safe reads without changing Firestore rules or widening a role's projection.

- [ ] **Step 1: Add integration assertions** that Staff/Agent land on their dashboard, Admin backend navigation remains, Chat FAB is present for all roles, role-hidden fields never appear in rendered metrics/results, and user/organization changes clear state.
- [ ] **Step 2: Add offline integration assertions** that the same role-safe cached rates feed dashboard metrics, filters, and Chat results while network-offline, quota-limit, and stale-cache status remain distinguishable.
- [ ] **Step 3: Run `npm test` and confirm every application test passes.**
- [ ] **Step 4: Run `npm run build` and confirm TypeScript and Vite production compilation succeed.**
- [ ] **Step 5: Review `git diff --check` and the final changed-file list; ensure no unrelated working-tree changes are staged.**
- [ ] **Step 6: Commit** any final acceptance tests/fixes as `test: verify role dashboards and chat filter sync`.

## Execution Notes

- Keep the existing working-tree edits intact; inspect them before any edit to overlapping files. Stage only the files listed by the active task.
- `AppLayout.tsx`, `DashboardView.tsx`, `MasterTable.tsx`, and `ChatExperience.tsx` are large existing components. Extract focused dashboard/filter/panel units instead of duplicating complete role pages or adding another large conditional component.
- Admin uses the full `CommissionRate` contract. Staff/Agent dashboard cards and filters must use the Task 1 role-discriminated projections and never infer permission from hidden/zero-valued fields.
- Update `src/components/StaffPortalView.tsx` and `src/components/AgentPortalView.tsx` only if final call-site inspection shows they are still actively routed; avoid unrelated cleanup of legacy portal components.
