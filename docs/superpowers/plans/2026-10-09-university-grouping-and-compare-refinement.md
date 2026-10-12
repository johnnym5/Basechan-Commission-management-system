# University Grouping, Active/Previous Intakes Modal & Compare Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `Apply Chip` filter handoff, group university routes into 1 consolidated card by default, split active vs. previous intakes in the pop-up modal, and remove the AI button from Compare View.

**Architecture:** Extend `MasterTable.tsx` and `SmartSearchBar.tsx` token matching to support fuzzy university name/id matching when `Apply Chip` is clicked. Add active vs. previous intake separation with a collapsible "View Previous Intakes" section in `GroupRoutesModal`. Ensure `CompareView.tsx` and `AppLayout.tsx` hide the AI launcher when on the Compare page.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-10-09-university-grouping-and-compare-refinement-design.md`

## Global Constraints

- Preserve role security boundaries across Admin, Staff, and Agent.
- Maintain existing tests and ensure zero TypeScript compile errors.

---

### Task 1: Fix Apply Chip Search Handoff in SmartSearchBar & MasterTable

**Files:**
- Modify: `src/components/SmartSearchBar.tsx`
- Modify: `src/components/MasterTable.tsx`
- Test: `src/components/SmartSearchBar.test.tsx`

- [ ] **Step 1: Update `handleAcceptSuggestion` in `SmartSearchBar.tsx` to handle fuzzy suggestion handoffs cleanly.**
- [ ] **Step 2: Update `MasterTable.tsx` filter evaluation for `token.type === 'school'` to check name & ID inclusion.**
- [ ] **Step 3: Run `npx vitest run src/components/SmartSearchBar.test.tsx` to verify passing tests.**

---

### Task 2: Consolidated 1-Card University Grouping & Active vs Previous Intakes Modal

**Files:**
- Modify: `src/components/MasterTable.tsx`
- Test: `src/utils/groupingUtils.test.ts`

- [ ] **Step 1: Ensure default grouping mode in `MasterTable.tsx` groups routes per university into 1 card.**
- [ ] **Step 2: Update `GroupRoutesModal` in `MasterTable.tsx` to display active intakes by default and collapse previous intakes under `"View Previous Intakes (N)"`.**
- [ ] **Step 3: Run `npx vitest run src/utils/groupingUtils.test.ts` to verify.**

---

### Task 3: Compare View Alignment & AI Button Removal

**Files:**
- Modify: `src/components/CompareView.tsx`
- Modify: `src/components/AppLayout.tsx`
- Test: `src/components/AppLayout.test.tsx`

- [ ] **Step 1: Check `CompareView.tsx` and ensure active vs. previous intakes collapsible section displays properly.**
- [ ] **Step 2: Update `AppLayout.tsx` so `ChatAssistantLauncher` is hidden when `currentPage === 'Compare Rates'` or `'Compare'`.**
- [ ] **Step 3: Run `npx vitest run src/components/AppLayout.test.tsx` to verify.**

---

### Task 4: Production Build & Live Verification

- [ ] **Step 1: Run `npm run build` to verify zero compile errors.**
- [ ] **Step 2: Run `npx vitest run` to verify all test suites pass.**
