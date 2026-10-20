# Implementation Plan: Add University, Add Route, Discard Sync & Route Selection Bug Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Add University modal, Add Route capability inside UniversityDetailModal, Discard and Force Push controls in the sync popover, and fix StaffPortalView default route selection.

**Architecture:** 
- `StaffPortalView`: Prioritize `isDefaultRoute === true` over `guidance === 'FOCUS'` when determining the single authorized route per school/level/intake.
- `RateChangeBasket`: Surface "Discard This Change" and "Force Push" buttons when sync has failed or is in conflict, enabling user to eject stuck local operations or overwrite cloud.
- `AddUniversityModal`: Modal for Admin to create brand new universities from scratch, only generating `CommissionRate` docs for rows with filled-in rates and queuing them via `createRates`.
- `DashboardView`: Add "➕ Add University" button in the admin action bar to trigger `AddUniversityModal`.
- `UniversityDetailModal`: Add "+ Add Route" section in edit mode allowing admins to append a new aggregator/level route to the active university and intake.

**Tech Stack:** React 19, TypeScript, TanStack Table v8, Lucide React, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-add-university-route-discard-design.md`

## Global Constraints
- Strictly adhere to `import type { ... }` for type imports (`verbatimModuleSyntax`).
- Do not introduce react-router-dom; maintain local state navigation.
- No direct mutations of arrays or props; maintain immutable React patterns.
- Only create `CommissionRate` documents for non-empty, non-zero rate rows when adding a university or route.
- Generate stable IDs using `generateCompositeId(universityName, intake, aggregator, studyLevel)`.

## Review Focus
1. When `isDefaultRoute` is set on an ALLOWED route while another route is marked FOCUS, staff must see the default route.
2. When a sync conflict occurs, clicking Discard must remove the failed operation from IndexedDB without corrupting existing clean rates.
3. Adding a new university with only 2 aggregator rates filled must generate exactly 2 `CommissionRate` records.
4. Adding a route to an existing university must prevent adding an aggregator+level combination that already exists for that intake.
5. Deleting or saving a university must remain strictly scoped to the viewed intake.

---

### Task 1: Fix Staff Authorized Route Selection in StaffPortalView

**Files:**
- Modify: `src/components/StaffPortalView.tsx:242-262`
- Test: `src/components/StaffPortalView.test.tsx`

**Interfaces:**
- Consumes: `CommissionRate.isDefaultRoute`, `CommissionRate.guidance`, `CommissionRate.diffMargin`
- Produces: `staffAuthorizedRates: CommissionRate[]` checking `isDefaultRoute === true` first, then `guidance === 'FOCUS'`, then top yield.

- [ ] **Step 1: Write unit tests in `src/components/StaffPortalView.test.tsx` for route selection prioritization**

Verify that `isDefaultRoute === true` takes priority over `guidance === 'FOCUS'`, and that `guidance === 'FOCUS'` takes priority over `diffMargin`.

- [ ] **Step 2: Run test to verify it fails if not prioritizing `isDefaultRoute`**

Run: `npx vitest run src/components/StaffPortalView.test.tsx`

- [ ] **Step 3: Update `staffAuthorizedRates` in `src/components/StaffPortalView.tsx`**

Check `isDefaultRoute === true` first before falling back to `focusRate` and `topYield`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/StaffPortalView.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/StaffPortalView.tsx src/components/StaffPortalView.test.tsx
git commit -m "fix: prioritize isDefaultRoute over FOCUS guidance in StaffPortalView"
```

---

### Task 2: Enhance Sync Popover with Discard and Force Push Actions

**Files:**
- Modify: `src/components/RateChangeBasket.tsx`
- Test: `src/components/RateChangeBasket.test.tsx`

**Interfaces:**
- Consumes: `onDiscard?: (id: string) => void`, `onRetry: (id?: string) => void`, `onResolveConflict?: (id: string, resolution: 'keep-cloud' | 'apply-local') => void`, `operations?: PendingRateOperation[]`
- Produces: UI buttons "Discard Change" and "Force Push" rendered inside the popover when `hasFailed` is true.

- [ ] **Step 1: Write unit test in `src/components/RateChangeBasket.test.tsx`**

Test that when an operation has failed/conflicted, clicking "Discard Change" calls `onDiscard(operationId)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RateChangeBasket.test.tsx`

- [ ] **Step 3: Implement Discard and Force Push buttons in `src/components/RateChangeBasket.tsx`**

In the popover footer, if `hasFailed` is true and `failedOps.length > 0`:
- Render "Discard Change" button (calls `onDiscard(failedOps[0].operationId)`).
- If the failure is a conflict and `onResolveConflict` is provided, offer "Force Push" (calls `onResolveConflict(failedOps[0].operationId, 'apply-local')`).
- Keep the "Retry Sync Now" button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RateChangeBasket.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/RateChangeBasket.tsx src/components/RateChangeBasket.test.tsx
git commit -m "feat: add Discard Change and Force Push options to sync popover"
```

---

### Task 3: Create AddUniversityModal Component

**Files:**
- Create: `src/components/AddUniversityModal.tsx`
- Test: `src/components/AddUniversityModal.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  interface AddUniversityModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingRates: CommissionRate[];
    defaultIntake?: string;
    onUniversityAdded: (rates: CommissionRate[]) => Promise<void> | void;
  }
  ```
- Produces: Modal with dark theme styling, inputs for University Name, Country, Baseline Intake, Guidance, Default Route, Commission Type, and rate inputs (Agent FD/UG/PG, Master UG/PG, Edvoy, SI-UK, UAP, Crizac, KC Overseas, Aims Education). Only produces `CommissionRate` objects for filled rows.

- [ ] **Step 1: Write unit test in `src/components/AddUniversityModal.test.tsx`**

Test that submitting the form with University Name "Test Uni" and Agent PG rate 15% creates only the filled rate with composite ID and proper defaults.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AddUniversityModal.test.tsx`

- [ ] **Step 3: Implement `src/components/AddUniversityModal.tsx`**

Build modal matching `UniversityDetailModal` dark visual styling with full form fields, validation, and composite ID generation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AddUniversityModal.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/AddUniversityModal.tsx src/components/AddUniversityModal.test.tsx
git commit -m "feat: create AddUniversityModal component"
```

---

### Task 4: Integrate AddUniversityModal into DashboardView & Admin Action Bar

**Files:**
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/MasterTable.tsx`

**Interfaces:**
- Consumes: `AddUniversityModal`, `createRates` from `adminRateWriteService`
- Produces: "➕ Add University" button in the admin action bar that opens `AddUniversityModal` and queues new rates.

- [ ] **Step 1: Add "Add University" button in `src/components/DashboardView.tsx` or `src/components/MasterTable.tsx`**

Place the button alongside the existing Excel upload / Export buttons in the header row.
Wire `handleAddUniversity` to call `createRates(newRates, userEmail)` and display a success banner.

- [ ] **Step 2: Run build and tests**

Run: `npm run build && npx vitest run src/components/DashboardView.test.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardView.tsx src/components/MasterTable.tsx
git commit -m "feat: integrate Add University button and workflow on Admin dashboard"
```

---

### Task 5: Implement Add Route Inside UniversityDetailModal

**Files:**
- Modify: `src/components/UniversityDetailModal.tsx`
- Test: `src/components/UniversityDetailModal.test.tsx`

**Interfaces:**
- Consumes: `onAddRoute?: (rate: CommissionRate) => Promise<void> | void;`
- Produces: Collapsible "+ Add New Route" section in edit mode with aggregator selector, study level, intake, and rates.

- [ ] **Step 1: Write test in `src/components/UniversityDetailModal.test.tsx` for adding a route**

Test that clicking "+ Add Route" reveals inputs and submitting fires `onAddRoute` with the constructed `CommissionRate`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/UniversityDetailModal.test.tsx`

- [ ] **Step 3: Implement Add Route sub-section in `src/components/UniversityDetailModal.tsx` and wire in `MasterTable.tsx`**

In `UniversityDetailModal`, add an accordion/sub-form in edit mode.
In `MasterTable.tsx`, wire `onAddRoute={async (newRate) => { await createRates([newRate], userEmail); }}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/UniversityDetailModal.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/UniversityDetailModal.tsx src/components/MasterTable.tsx src/components/UniversityDetailModal.test.tsx
git commit -m "feat: add route creation support inside UniversityDetailModal"
```

---

### Task 6: Full Verification and Build Check

- [ ] **Step 1: Run complete type check**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 3: Run production build**

Run: `npm run build`

- [ ] **Step 4: Push to main**

```bash
git push origin main
```
