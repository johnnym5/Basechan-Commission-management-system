# Design Spec: Add University, Add Route, Discard Pending Changes + Bug Fixes

**Date:** 2026-10-20  
**Status:** Approved for implementation planning  
**Scope:** Admin dashboard — new CRUD flows + sync reliability improvements

---

## 1. Problem Statement

### Confirmed Bugs

**Bug 1 — Set Default Route Causes Route to Disappear**  
When admin sets a default route for a university, one or more aggregator routes may vanish from the staff/agent view. Root cause: `handleSetDefaultRoute` may trigger a full re-save of all rates for the university, recalculating composite IDs using `baselineIntake`. If intake changes even slightly, old rate docs stay at old IDs while new ones are created at new IDs — causing the old routes to become orphaned or invisible in filtered views. Additionally, `StaffPortalView` shows the "authorised route" based on `guidance === 'FOCUS'` rather than `isDefaultRoute === true`, so changing the default route without adjusting guidance can cause mismatches.

**Bug 2 — Sync Retry Gets Stuck in Conflict Loop**  
When a rate change conflicts (`"One or more edited fields changed in Firestore"`), the pending op stays in the queue with `status: 'conflict'`. Retrying re-runs the same write, hits the same conflict, and loops indefinitely. There is no escape mechanism (force-push or discard) for the user to resolve the deadlock.

### New Features Requested

1. **Add University** — create a brand-new university with rates from scratch via a form modal on the admin dashboard.
2. **Add Route** — add a new aggregator route to an existing university from inside the UniversityDetailModal.
3. **Discard Pending Change** — in the sync status popover, allow admin to discard a specific failing/conflicted op (reverting to last Firestore state).

---

## 2. Out of Scope

- Bulk import from Excel (already exists via ExcelUploadModal)
- Agent/staff creating or editing rates (admin-only)
- Changing the sync architecture (IndexedDB queue stays as-is)

---

## 3. Bug Fixes — Detailed Design

### 3A — Fix: Set Default Route (MasterTable.tsx + StaffPortalView.tsx)

**Problem precision:**  
`handleSetDefaultRoute` (MasterTable.tsx ~line 1202) updates `isDefaultRoute: true` on the chosen aggregator doc. But `handleSaveUniversityRecord` (called from the batch edit path) recalculates the composite ID as:  
```
generateCompositeId(universityName, intake, aggregator, studyLevel)
```  
If `baselineIntake` in `updatedData` differs from `rate.intake`, the resulting ID changes. The old Firestore doc is NOT deleted — it becomes an orphan. The new ID doc is created but may not match any existing filter. Visually the rate "disappears."

**Fix A1 — ID stability in `handleSaveUniversityRecord`:**  
Only regenerate the composite ID if `updatedData.baselineIntake` is explicitly different from the current rate's intake AND the user explicitly checked "Set as System Default Intake". Otherwise preserve the existing `rate.id`. Add a guard:
```ts
const intakeChanged = makeDefaultIntake && updatedData.baselineIntake && updatedData.baselineIntake !== rate.intake;
const id = intakeChanged
  ? generateCompositeId(rate.universityName, updatedData.baselineIntake, rate.aggregator, rate.studyLevel)
  : rate.id;
```
If the ID does change, the old doc must be **deleted** (via `deleteRates`) as part of the same batch so no orphans are created.

**Fix A2 — StaffPortalView default route signal:**  
`StaffPortalView` currently uses `guidance === 'FOCUS'` as the primary signal for which route to show. Change to: check `isDefaultRoute === true` first, fall back to `guidance === 'FOCUS'`, fall back to first available rate. This makes default route and guidance independent, consistent with how admin sets them.

**Fix A3 — `handleSetDefaultRoute` isolation:**  
`handleSetDefaultRoute` should only write `isDefaultRoute: true` to the chosen rate, and `isDefaultRoute: false` to all other rates for the same university+intake+studyLevel combination. It must NOT trigger a full re-save or recalculate IDs. Keep it as a targeted patch operation.

---

### 3B — Fix: Sync Conflict Deadlock (RateChangeBasket.tsx + rateWriteQueue / rateWriteSyncService)

**Current state:**  
Conflicted ops stay in queue forever. Retry re-submits the same write. No resolution path.

**Fix:**  
- In the sync status popover (`RateChangeBasket.tsx`), when `syncState === 'failed'` or the operation is in `conflict` state, show two buttons:
  - **"Force Push"** — re-submits the write with `force: true` flag, bypassing conflict check, overwriting Firestore with local version.
  - **"Discard This Change"** — calls `discardOperation(id)` on `rateWriteQueue`, removes the op from IndexedDB queue, marks it as discarded, refreshes rates from Firestore.
- `discardOperation(id)` is a new export from `rateWriteQueue.ts` that deletes the pending op by ID from the local queue.
- After discard, `refreshCommissionRates()` is called to reload fresh from Firestore.
- The existing "Reset All" button in the basket/workspace widget is separate — it discards ALL pending ops. That behavior stays.

---

## 4. New Feature: Add University Modal

### 4A — Component: `AddUniversityModal.tsx`

**Location:** `src/components/AddUniversityModal.tsx`

**Trigger:** "➕ Add University" button on admin dashboard top bar (DashboardView.tsx header row).

**Props:**
```ts
interface AddUniversityModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRates: CommissionRate[];       // for duplicate name detection
  onUniversityAdded: (count: number) => void;
}
```

**Form Fields:**
| Field | Input Type | Required |
|---|---|---|
| University Name | text (with duplicate warning) | ✅ |
| Country | text | ✅ |
| Baseline Intake | text (e.g. "Sept 2026") | ✅ |
| Commission Type | select: Percentage / Fixed Fee | ✅ |
| School Guidance | select: Allowed / Focus / Do Not Use | ✅ |
| Default Route | select from aggregator list | ✅ |
| Agent Rate FD | number | optional |
| Agent Rate UG | number | optional |
| Agent Rate PG | number | optional |
| Master Rate UG | number | optional |
| Master Rate PG | number | optional |
| EDVOY UG / PG | number | optional |
| SI-UK UG / PG | number | optional |
| UAP UG / PG | number | optional |
| CRIZAC UG / PG | number | optional |
| KC Overseas UG / PG | number | optional |
| AIMS Education UG / PG | number | optional |

**Rate row creation rule:** Only create a `CommissionRate` doc for aggregator+level combinations where the rate field is non-empty and non-zero. Leave blank = no doc created.

**ID generation:** Use existing `generateCompositeId(universityName, intake, aggregator, studyLevel)`.

**Duplicate detection:** If `existingRates` already contains a rate with the same composite ID, show a warning badge on that field (not a blocking error — admin may want to overwrite via Excel import separately).

**Save flow:**
1. Build array of `CommissionRate` objects for all filled-in rows
2. Call `createRates(newRates, userEmail)` — new function that batch-writes to Firestore via write queue
3. Show success toast with count of rows created
4. Call `onUniversityAdded(count)` → parent refreshes table

**Design:** Match the existing UniversityDetailModal dark theme exactly. Two-column rate grid. Same tag pills at top (country, intake, guidance, default route).

---

## 5. New Feature: Add Route (inside UniversityDetailModal)

### 5A — "Add Route" button in UniversityDetailModal edit mode

**Location:** Bottom of the rate grid in `UniversityDetailModal.tsx`, visible only in edit mode and only to ADMIN.

**Inline mini-form fields:**
- Aggregator (dropdown of existing aggregators in the system + "Custom..." option for free text)
- Study Level (UG / PG / FD)
- Intake (pre-filled with `baselineIntake`, editable)
- Agent Rate (number)
- Master Rate (number)

**Save behaviour:**  
Calls `createRates([newRate], userEmail)` — adds one new `CommissionRate` doc. Then the modal re-derives its data to show the new row immediately.

**Validation:** Aggregator + Study Level + Intake combination must not already exist for this university (composite ID collision check).

---

## 6. New Feature: Discard Pending Change

### 6A — `discardOperation(id: string)` in rateWriteQueue.ts

New exported async function:
```ts
export async function discardOperation(operationId: string): Promise<void>
```
- Removes the operation from IndexedDB by `operationId`
- Does NOT write anything to Firestore
- Caller must invoke `refreshCommissionRates()` after to reload state from Firestore

### 6B — RateChangeBasket.tsx UI changes

When `syncState === 'failed'` and `errorMessage` is present:
- Show **"Force Push"** button (blue) — calls `onRetry(operationId)` with a `force` flag
- Show **"Discard This Change"** button (rose/red outline) — calls `onDiscard(operationId)`

New prop on `RateChangeBasket`:
```ts
onDiscard?: (id?: string) => void;
```

`onDiscard` is wired in `AppLayout.tsx` → calls `discardOperation(id)` then `refreshCommissionRates()`.

---

## 7. Files to Create / Modify

| File | Action | What Changes |
|---|---|---|
| `src/components/AddUniversityModal.tsx` | **Create** | New modal for adding a university |
| `src/components/UniversityDetailModal.tsx` | **Modify** | Add "Add Route" inline form in edit mode |
| `src/components/MasterTable.tsx` | **Modify** | Fix ID stability in `handleSaveUniversityRecord`; fix `handleSetDefaultRoute` isolation; add "Add University" button trigger |
| `src/components/DashboardView.tsx` | **Modify** | Add "➕ Add University" button in header; wire `AddUniversityModal` |
| `src/components/StaffPortalView.tsx` | **Modify** | Fix authorised route selection: `isDefaultRoute` first, then FOCUS |
| `src/components/RateChangeBasket.tsx` | **Modify** | Add `onDiscard` prop; show Force Push + Discard buttons in failed state |
| `src/services/rateWriteQueue.ts` | **Modify** | Add `discardOperation(id)` export |
| `src/components/AppLayout.tsx` | **Modify** | Wire `onDiscard` from RateChangeBasket → `discardOperation` + refresh |
| `src/components/AddUniversityModal.test.tsx` | **Create** | Tests: form validation, rate row creation rule, duplicate detection |
| `src/components/MasterTable.test.tsx` | **Modify** | Add tests for ID stability and default route isolation |

---

## 8. Success Criteria

- [ ] Adding a university with 3 rates filled in creates exactly 3 `CommissionRate` docs
- [ ] Editing a university's rates and saving does NOT change doc IDs unless intake explicitly changed + default intake checkbox checked
- [ ] Setting a default route does NOT cause any other route to disappear from staff/agent view
- [ ] A conflicted sync op can be discarded — after discard, the table reloads from Firestore and the error clears
- [ ] "Force Push" on a conflicted op overwrites Firestore and clears the error
- [ ] All 323+ existing tests still pass
