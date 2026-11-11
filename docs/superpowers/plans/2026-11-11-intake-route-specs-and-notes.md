# Implementation Plan: Intake Management, Per-Route Specifications, Editable University Name & Shared Notes

This plan outlines the architecture, data models, components, and testing steps for delivering the 4 requested enhancements in Basechan Commission Management System:
1. **Intake Dropdown & "Add New Intake"** on both Main Dashboard & Modal.
2. **Per-Route Independent Commission Type & Intake** with single vs bulk route editing in `UniversityDetailModal`.
3. **Editable University Name** with clean propagation across all routes.
4. **Shared Notes Section** across Admin, Staff, and Agent.

---

## Proposed Changes

### 1. Intake Selector & "Add New Intake" (Dashboard & Modal)
- **Files to update:**
  - `src/components/SmartSearchBar.tsx`
  - `src/components/MasterTable.tsx`
  - `src/components/UniversityDetailModal.tsx`
- **Design:**
  - Standardized intake selector displaying all existing intakes from `useSystemConfig().activeIntakes` + unique intakes present in `rates`.
  - When Admin is active, render an **"+ Add Intake"** action button under / beside the intake dropdown.
  - Clicking "+ Add Intake" opens a lightweight prompt / inline popover to enter a new intake string (e.g. "Jan 2027", "May 2027"), automatically updating system config via `updateActiveIntakes` and selecting it immediately.

### 2. Per-Route Independent Commission Type & Intake in `UniversityDetailModal`
- **Files to update:**
  - `src/components/UniversityDetailModal.tsx`
  - `src/components/MasterTable.tsx` (`handleSaveUniversityRecord`)
- **Design:**
  - In `UniversityDetailModal`, replace the rigid monolithic single intake/type form with a flexible route-level specification model.
  - Data structure per route in `editForm.routes`:
    ```ts
    interface RouteEditSpec {
      aggregator: string;
      studyLevel: StudyLevel;
      masterRate: string;
      agentRate: string;
      isFlatFee: boolean;
      intake: string;
      guidance?: SchoolGuidance;
    }
    ```
  - **Single vs Bulk Mode (Option A from Brainstorming)**:
    - At top of Route Table: a "Bulk Update All Routes" control allowing Admin to set Intake or Commission Type across all routes at once.
    - Each individual route row also has its own:
      - Intake dropdown (with "+ Add Intake")
      - Commission Type selector (`%` vs `Flat Fee £`)
      - Incoming Rate (Master) & Outgoing Rate (Agent)
    - If Admin changes only one route (e.g., CRIZAC), only CRIZAC's intake / commission type / rate changes, leaving all other routes intact!
  - `handleSaveUniversityRecord` in `MasterTable.tsx` saves mutations per route without forcing a universal intake or universal commission type.

### 3. Editable University Name
- **Files to update:**
  - `src/components/UniversityDetailModal.tsx`
  - `src/components/MasterTable.tsx`
- **Design:**
  - University name in `UniversityDetailModal` becomes an editable text input in edit mode (previously read-only `<span>`).
  - When saving, if `newUniversityName !== originalUniversityName`:
    - Generate new composite IDs with the new name.
    - Delete old rate IDs and create/upsert the new rates transactionally via `writeRateOperation`.
    - Automatically update selected detail view name to the new university name so the modal doesn't close or break.

### 4. Shared Notes Section (Admin, Staff, Agent)
- **Files to update:**
  - `src/components/UniversityDetailModal.tsx`
  - `src/components/MasterTable.tsx` (`GroupRoutesModal`)
  - `src/types/index.ts` (verify `notes?: string` on read models)
- **Design:**
  - Each university displays a prominent **"Institution Notes & Directives"** memo card in both `UniversityDetailModal` and `GroupRoutesModal`.
  - In edit mode, Admin can edit the note.
  - Saving persists `notes` across all routes of the university.
  - Staff and Agent read the note prominently on their detail/card view.

---

## Verification Plan

### Automated Tests
1. `src/components/UniversityDetailModal.test.tsx`:
   - Test per-route independent intake and commission type (e.g. CRIZAC flat fee vs EDVOY percentage).
   - Test editable university name saving and callback.
   - Test note rendering and editing.
2. `src/utils/groupingUtils.test.ts` / `src/components/MasterTable.test.tsx`:
   - Test intake dropdown options and custom intake creation.
   - Test note display in `GroupRoutesModal`.
3. Run `npm test` to ensure all 55 test suites pass with 0 regressions.
4. Run `npm run build` to verify TypeScript compile and Vite production bundle.
