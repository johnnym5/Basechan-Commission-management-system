# University Grouping, Active/Previous Intakes Modal & Compare Refinement Design

**Status:** Proposed
**Date:** 2026-10-09
**Target:** Search Token Matching, Default University Grouping, Intakes Modal Breakdown, Compare View Grouping & AI Button Removal

---

## 1. Executive Summary & Purpose

Refine Basechan CMS search filter handoffs and route organization across Admin, Staff, Agent, and Compare views:
1. **Fix Apply Chip Handoff:** Ensure clicking `Apply Chip` on fuzzy "Did You Mean?" suggestions adds the search token, clears text input, and reliably matches universities by both `universityName` and `universityId`.
2. **Consolidated 1-Card University Grouping by Default:** In `MasterTable`, group multiple routes for a university into 1 clean consolidated card showing total routes, top yield, country, and status.
3. **Active vs. Previous Intakes Modal Breakdown:** Clicking a university card opens `GroupRoutesModal`, displaying active/upcoming intakes by default and providing a collapsible "View Previous Intakes" section for past/archived intakes.
4. **Compare View Alignment:** Apply 1-card university grouping and active/previous intake breakdown to `CompareView.tsx`.
5. **Remove AI Launcher in Compare View:** Strip the floating AI/Chat launcher button from `CompareView.tsx`.

---

## 2. Technical Component Design

### A. Apply Chip Search Token Handoff (`SmartSearchBar.tsx`, `MasterTable.tsx`)
* **Token Matching Engine:**
  * When `Apply Chip` is clicked, `handleAcceptSuggestion` adds a `type: 'school'` token.
  * In `MasterTable.tsx` filter evaluation:
    ```typescript
    if (token.type === 'school') {
      const target = token.value.toLowerCase().trim();
      const matchName = row.universityName.toLowerCase().includes(target) || target.includes(row.universityName.toLowerCase());
      const matchId = row.universityId.toLowerCase() === target;
      if (!matchName && !matchId) return false;
    }
    ```
  * Ensures `Apply Chip` always displays the matching university results immediately.

---

### B. Consolidated University Cards & Modal Breakdown (`MasterTable.tsx`, `groupingUtils.ts`)
* **Default Grouping Mode:** Set default `groupByMode = 'UNIVERSITY'` when search/filters are active.
* **Modal Breakdown in `GroupRoutesModal`:**
  * Categorize routes into:
    * **Active Intakes:** Current/upcoming intakes (e.g., `Jan 2026`, `Sept 2026`, `2026/2027`).
    * **Previous Intakes:** Past/archived intakes (e.g., `2024`, `Jan 2025`, `Sept 2025`).
  * Display Active Intakes cards first in the modal.
  * Render a collapsible toggle button at the bottom: `"View Previous Intakes (N)"` with a smooth expand/collapse transition.

---

### C. Compare View Grouping & AI Button Removal (`CompareView.tsx`)
* **Consolidated Comparison Cards:** Group routes per university in `CompareView.tsx` into 1 card per school, opening the same active/previous intakes modal on click.
* **Remove AI Button:** Strip `<ChatAssistantLauncher>` or floating AI trigger button from `CompareView.tsx`.

---

## 3. Verification & Testing Plan

1. **Unit Tests:**
   * Test `Apply Chip` suggestion click filter handoff in `SmartSearchBar.test.tsx` & `MasterTable.test.tsx`.
   * Test active vs. previous intake separation in `groupingUtils.test.ts`.
   * Test `CompareView.test.tsx` verifying AI button is removed and university cards are grouped.
2. **Production Build:**
   * Run `npm run build` to confirm zero TypeScript compile errors.
