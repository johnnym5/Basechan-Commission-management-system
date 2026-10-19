# Mobile Performance and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve first-load performance and make staff/agent/admin dashboard interactions usable on narrow screens and with keyboard or reduced-motion settings.

**Architecture:** Preserve the approved black/navy and blue-accent system while reducing initial JavaScript through real lazy boundaries. Use native semantic controls for dashboard filters and retain the full chat/dashboard behavior with responsive layout rules and motion preferences.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library, CSS/Tailwind, browser accessibility tooling already in repository.

**Spec:** `docs/superpowers/specs/2026-10-19-system-audit-remediation-roadmap-design.md`

## Global Constraints

- Do not change role permissions or local/offline data behavior as part of visual optimization.
- Do not add dependencies solely to raise or suppress bundle warnings.
- Preserve the dark black/navy and blue-accent direction.
- Metric filters must be keyboard-operable with visible focus and accessible names/state.
- Respect `prefers-reduced-motion`; keep animation functional without motion.
- Measure emitted production chunks before setting or changing any bundle budget.

## Review Focus

- Admin-only and spreadsheet modules must not enter the initial chunk through static imports.
- Deferred screens still render, load, and report errors when first opened.
- 320–375 px width avoids horizontal overflow and preserves readable metric labels.
- Metric selection supports keyboard users and announces selected state.
- Reduced-motion preference removes nonessential movement without hiding content or breaking open/close transitions.

---

### Task 1: Establish a reproducible bundle baseline

**Files:**
- Modify: `vite.config.ts` only if existing chunk reporting needs explicit setup
- Create: `docs/performance/bundle-baseline-2026-10-19.md`

- [ ] **Step 1: Run** `npm run build` and record emitted JS/CSS chunk sizes and gzip values using repository-supported tools.
- [ ] **Step 2: Trace** why `xlsx` and admin-only modules appear in the initial entry using Vite's generated manifest or dependency graph.
- [ ] **Step 3: Record** baseline per entry and deferred feature; do not change threshold yet.

### Task 2: Split admin and spreadsheet-only code at feature boundaries

**Files:**
- Modify: `src/components/AppLayout.tsx` and actual admin view/component import points found in the dependency trace
- Modify: `vite.config.ts` only for stable manual chunks if dynamic boundaries prove insufficient
- Test: `src/components/AppLayout.test.tsx` and lazy-route/component tests

**Interfaces:**
- Admin view modules load through `React.lazy(() => import(...))` and render within an accessible `Suspense` fallback.
- Spreadsheet parser loads only when import/export workflow opens; no top-level consumer statically imports `xlsx`.

- [ ] **Step 1: Add failing lazy-loading assertions** that initial role shell does not resolve Admin/spreadsheet modules and opening the feature does.
- [ ] **Step 2: Run focused AppLayout tests**; confirm eager module loading before changing import boundaries.
- [ ] **Step 3: Implement lazy imports** at feature boundaries and add concise loading/error UI consistent with the dark/blue style.
- [ ] **Step 4: Rebuild and inspect emitted chunks**; verify the admin/spreadsheet modules are deferred and baseline improves.

### Task 3: Make role-dashboard metrics accessible and responsive

**Files:**
- Modify: `src/components/RoleDashboardView.tsx`
- Test: `src/components/RoleDashboardView.test.tsx`
- Modify: associated dashboard CSS/Tailwind classes

- [ ] **Step 1: Add tests** for button semantics, accessible label, `aria-pressed`/equivalent selected state, tab/enter/space operation, and visible focus.
- [ ] **Step 2: Run focused tests**; confirm current clickable div fails semantic and keyboard assertions.
- [ ] **Step 3: Implement semantic controls** retaining filter behavior; adjust mobile typography/spacing so labels remain readable and touch targets remain at least 44 CSS px where layout allows.
- [ ] **Step 4: Verify responsive snapshots/layout assertions** at 320 px, 375 px, tablet, and desktop widths without horizontal scroll.

### Task 4: Verify chat/navigation motion and viewport handling

**Files:**
- Modify: shared chat panel/drawer, mobile header, and dashboard layout components identified from current AppLayout
- Test: associated component tests

- [ ] **Step 1: Add tests** for small viewport panel sizing, close/open state, Escape/focus return where applicable, and reduced-motion CSS behavior.
- [ ] **Step 2: Implement** responsive sheet/panel constraints, safe-area padding, focus handling, and reduced-motion variants using existing motion utilities.
- [ ] **Step 3: Run focused tests** and manually inspect supported responsive breakpoints during implementation.

### Task 5: Set and verify bundle budget

- [ ] **Step 1: Compare emitted chunks to baseline** and define a main-entry and largest-deferred-chunk budget based on measured achievable results.
- [ ] **Step 2: Add a build assertion or documented budget check** that fails on regression without hiding Vite warnings.
- [ ] **Step 3: Run** `npm run build`; expect the initial bundle to meet the measured budget and feature chunks to load on demand.
- [ ] **Step 4: Run** `git diff --check` and record bundle measurements and responsive/accessibility gates.
