# Searchable Dropdowns and Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make application dropdowns searchable, provide complete country suggestions while filtering invalid country artifacts, and replace the legal terms copy with the user's approved wording.

**Architecture:** Add a shared controlled searchable select for fixed options, and upgrade the existing free-entry predictive input to show all matching suggestions. Add a local country catalogue and validate existing country suggestions against it. Replace existing native selects across the app without changing their values or permission rules; update the Legal Center and login gateway from one shared terms-content component/data source.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-searchable-dropdowns-and-terms-design.md`

## Global Constraints

- Do not add a UI dependency; use the existing React, TypeScript, and Tailwind stack.
- Keep searches local and deterministic; typing must not query a server.
- Preserve free-text entry only on fields that already support creating new values, including country, aggregator, and intake.
- Do not change role permissions or rate-write authorization.
- Use the exact user-provided terms and acceptance wording, with only heading and layout formatting.

## Review Focus

- Filtering must search the complete option list even when there are more than eight matches; test a result beyond the former cap.
- Keyboard users must be able to open, navigate, select, and dismiss; component tests cover these interactions.
- Empty/no-match search must not discard the current selected value or submit a different value; component test covers this case.
- Existing custom country, aggregator, and intake values must stay editable/selectable while invalid country artifacts are excluded; country utility tests cover these inputs.
- Terms text and gateway acceptance must match supplied wording in both locations; test the shared terms source and rendered gateway checkbox.

---

### Task 1: Shared fixed-choice searchable select

**Files:**
- Create: `src/components/SearchableSelect.tsx`
- Test: `src/components/SearchableSelect.test.tsx`

**Interfaces:**
- Produces `SearchableSelect` with `options: Array<{label: string; value: string}>`, `value`, `onChange`, `ariaLabel`, optional `placeholder`, and optional `disabled`.
- Filtering is case-insensitive substring matching over the full option list; fixed-choice values cannot be created by typing.

- [ ] **Step 1: Write failing tests** for full-list filtering beyond eight matches, no-match state, arrow navigation + Enter selection, Escape dismissal, and disabled behavior.
- [ ] **Step 2: Run `npm test -- --run src/components/SearchableSelect.test.tsx`** and confirm failures are behavior assertions.
- [ ] **Step 3: Implement** the controlled accessible combobox/listbox with complete filtering and keyboard behavior.
- [ ] **Step 4: Re-run the targeted test** and confirm all cases pass.
- [ ] **Step 5: Commit** `feat: add shared searchable select`.

### Task 2: Complete free-entry suggestions and country catalogue

**Files:**
- Create: `src/utils/countryOptions.ts`
- Test: `src/utils/countryOptions.test.ts`
- Test: `src/components/PredictiveInput.test.tsx`
- Modify: `src/components/PredictiveInput.tsx`
- Modify: `src/components/AddRateModal.tsx`

**Interfaces:**
- Country module exports `COUNTRY_OPTIONS: string[]` with a complete supported country list, plus `getCountrySuggestions(existingValues: string[]): string[]` that retains recognized existing aliases and excludes non-country values.
- PredictiveInput remains free-entry and filters the full suggestion list without an eight-item cap.

- [ ] **Step 1: Write failing tests** for country coverage, retaining `UK`, rejecting `KAPLAN`/`INTO Partnerships`, full free-entry filtering beyond eight, and selecting a custom value.
- [ ] **Step 2: Run the targeted tests** and confirm the country/cap assertions fail.
- [ ] **Step 3: Implement the local country catalogue and `getCountrySuggestions`; update Add Rate country options; keep all current distinct aggregator/intake values and free-entry behavior in Add/Edit.**
- [ ] **Step 4: Run targeted tests** and confirm all pass.
- [ ] **Step 5: Commit** `feat: complete country and predictive suggestions`.

### Task 3: Convert rate entry, migration, and batch controls

**Files:**
- Modify: `src/components/AddRateModal.tsx`
- Modify: `src/components/EditRateModal.tsx`
- Modify: `src/components/MigrateIntakeModal.tsx`
- Modify: `src/components/BatchEditModal.tsx`
- Modify: `src/components/AppLayout.tsx`
- Test: `src/components/AddRateModal.test.tsx`
- Test: `src/components/EditRateModal.test.tsx`
- Test: `src/components/MigrateIntakeModal.test.tsx`
- Test: `src/components/BatchEditModal.test.tsx`

**Interfaces:**
- Consume `SearchableSelect` from Task 1 and free-entry `PredictiveInput` from Task 2.
- Existing role gating, form field values, required constraints, and callbacks remain unchanged.

- [ ] **Step 1: Write/update tests** in the listed modal test files for Add/Edit free-entry fields, migration source intake/sheet searching, and batch fixed-choice searching.
- [ ] **Step 2: Run focused tests** and confirm the required dropdown behaviors fail before conversion.
- [ ] **Step 3: Replace native selects** in these workflows with the shared control; keep country, intake, aggregator free-entry on their current editable inputs.
- [ ] **Step 4: Run focused tests and `npm run build`**; confirm the controls preserve values and compile.
- [ ] **Step 5: Commit** `feat: make rate workflow dropdowns searchable`.

### Task 4: Convert portal, table, and calculator dropdowns

**Files:**
- Modify: `src/components/AgentPortalView.tsx`
- Modify: `src/components/StaffPortalView.tsx`
- Modify: `src/components/MasterTable.tsx`
- Modify: `src/components/DealCalculatorView.tsx`
- Test: `src/components/AgentPortalView.test.tsx`
- Test: `src/components/StaffPortalView.test.tsx`
- Test: `src/components/MasterTable.test.tsx`
- Test: `src/components/DealCalculatorView.test.tsx`

**Interfaces:**
- Consume `SearchableSelect` from Task 1; preserve existing option values and role-specific visibility.

- [ ] **Step 1: Add focused tests** in the listed test files for searchable country/intake filters, table filters, and calculator choices.
- [ ] **Step 2: Run focused tests** and verify the expected dropdown selection/search behavior is missing.
- [ ] **Step 3: Replace native selects** in these components with `SearchableSelect` and retain each existing change callback.
- [ ] **Step 4: Run focused tests and verify `rg -n "<select"` reports no matches in these files.**
- [ ] **Step 5: Commit** `feat: make portal and table filters searchable`.

### Task 5: Convert administration dropdowns

**Files:**
- Modify: `src/components/AgentAccessGate.tsx`
- Modify: `src/components/AuditLogsDrawer.tsx`
- Modify: `src/components/UserManagementView.tsx`
- Test: `src/components/AgentAccessGate.test.tsx`
- Test: `src/components/AuditLogsDrawer.test.tsx`
- Test: `src/components/UserManagementView.test.tsx`

**Interfaces:**
- Consume `SearchableSelect` from Task 1; preserve access control, selected enum values, and audit filter semantics.

- [ ] **Step 1: Add focused tests** in the listed test files for role/status/access and audit filter searching.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Replace native selects** while retaining role checks and callbacks.
- [ ] **Step 4: Run focused tests and verify no native selects remain under `src/components`.**
- [ ] **Step 5: Commit** `feat: make administration dropdowns searchable`.

### Task 6: Replace Terms of Use copy in both entry points

**Files:**
- Create: `src/components/TermsOfUseContent.tsx`
- Test: `src/components/TermsOfUseContent.test.tsx`
- Modify: `src/components/LegalModal.tsx`
- Modify: `src/components/LoginView.tsx`

**Interfaces:**
- `TermsOfUseContent` renders the four exact user-provided sections and acceptance statement for reuse in Legal Center and login gateway.
- Login gateway acceptance checkbox remains required before login access.

- [ ] **Step 1: Write failing tests** asserting each supplied section and checkbox statement appear in the shared content and login gateway.
- [ ] **Step 2: Run focused tests** and confirm outdated wording fails the assertions.
- [ ] **Step 3: Replace old Terms copy** in both entry points with shared content; retain separate Privacy Policy behavior and gateway checkbox gating.
- [ ] **Step 4: Run focused tests.**
- [ ] **Step 5: Commit** `docs: update terms of use and acceptance copy`.

### Task 7: Full verification

**Files:**
- No production changes expected.

- [ ] Run `npm test`; expected all tests pass.
- [ ] Run `npm run build`; expected successful production build.
- [ ] Run `rg -n "<select" src/components`; expected no results.
- [ ] Review all diffs for unchanged access policies and exact user-provided legal wording.
