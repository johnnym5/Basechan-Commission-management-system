# Admin Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the popover Sheet Visibility Manager modal with a full, dedicated Admin Settings Page (`SettingsView.tsx`) containing 5 organized tabs: Sheet & Default Filters, User & Agency Management, Intake Migration, System Announcements, and Data Health & Audit.

**Architecture:** Create a modular `SettingsView.tsx` component with tabbed navigation and embed existing administrative capabilities (User Management, Intake Migration, Audit Logs) into dedicated sections alongside expanded global defaults (Intake, Aggregator, Study Level) and system announcement broadcasting. Update Admin Sidebar and Header navigation to route directly to `currentPage === 'Settings'`.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-10-09-admin-settings-page-design.md`

## Global Constraints

- Admin settings access is strictly restricted to Admin users (`@basechaninternational.com`). Non-admin attempts to access `Settings` automatically redirect to their home page.
- Do not add external server dependencies or Cloud Functions.
- Preserve existing working code, tests, and types.
- Ensure all input elements use `font-family: inherit` and adhere to the system-wide Inter variable font family.

## Review Focus

- Non-admin attempts to open `SettingsView` must be blocked and redirected.
- Global defaults (`defaultIntake`, `defaultAggregator`, `defaultStudyLevel`) must support both `ALL` (open) and specific option locks.
- Intake rate cloning must calculate exact dry-run previews before writing to Firestore.
- Sheet visibility toggles for Staff and Agents must reactively reflect on Staff and Agent portals.
- Announcement broadcasts must support targeted delivery (`ALL`, `STAFF`, `AGENT`, or specific `organizationId`).

---

### Task 1: System Config & Announcement Data Services

**Files:**
- Create: `src/services/announcementService.ts`
- Modify: `src/hooks/useSystemConfig.ts`, `src/types/index.ts`
- Test: `src/hooks/useSystemConfig.test.ts`

**Interfaces:**
- Consumes: Firestore `system_config` collection and `system_announcements` collection.
- Produces: `useSystemConfig` hook returning `{ config, updateDefaults, updateIntakeLifecycle, announcements, publishAnnouncement, deleteAnnouncement }`.

- [ ] **Step 1: Write the failing test for expanded `useSystemConfig`**

```typescript
// src/hooks/useSystemConfig.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSystemConfig } from './useSystemConfig';

describe('useSystemConfig', () => {
  it('supports expanded default filters for intake, aggregator, and study level', async () => {
    const { result } = renderHook(() => useSystemConfig());
    expect(result.current.defaultIntake).toBeDefined();
    expect(result.current.defaultAggregator).toBeDefined();
    expect(result.current.defaultStudyLevel).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useSystemConfig.test.ts`
Expected: FAIL due to missing property assertions (`defaultAggregator` / `defaultStudyLevel`).

- [ ] **Step 3: Update `src/types/index.ts` and implement `useSystemConfig` and `announcementService`**

Extend `SystemConfig` interface in `src/types/index.ts`:
```typescript
export interface SystemConfig {
  defaultIntake: string;
  defaultAggregator: string;
  defaultStudyLevel: string;
  defaultViewMode: 'cards' | 'table';
  defaultSortBy: string;
}
```

Implement `announcementService.ts` for Firestore CRUD operations on `system_announcements`. Update `useSystemConfig.ts` to manage defaults, intake lifecycles, and announcements.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSystemConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/hooks/useSystemConfig.ts src/services/announcementService.ts src/hooks/useSystemConfig.test.ts
git commit -m "feat: expand system config and announcement services for settings page"
```

---

### Task 2: Build `SettingsView.tsx` Component & Tab Sections

**Files:**
- Create: `src/components/SettingsView.tsx`
- Create: `src/components/settings/SheetVisibilityTab.tsx`
- Create: `src/components/settings/UserManagementTab.tsx`
- Create: `src/components/settings/IntakeMigrationTab.tsx`
- Create: `src/components/settings/AnnouncementsTab.tsx`
- Create: `src/components/settings/DataHealthTab.tsx`
- Test: `src/components/SettingsView.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useCommissionRates`, `useSheetVisibility`, `useSystemConfig`, `UserManagementView`, `MigrateIntakeModal`.
- Produces: `SettingsView` component displaying 5 interactive tabs for system configuration.

- [ ] **Step 1: Write the failing test for `SettingsView` tab switching and role guard**

```typescript
// src/components/SettingsView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsView } from './SettingsView';

describe('SettingsView', () => {
  it('renders 5 setting tabs for Admin users', () => {
    render(<SettingsView rates={[]} onRefreshRates={() => {}} />);
    expect(screen.getByRole('tab', { name: /Sheet & Default Filters/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Users & Agencies/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Intake & Migration/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Announcements/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Data Health & Audit/i })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SettingsView.test.tsx`
Expected: FAIL with "SettingsView not found"

- [ ] **Step 3: Implement `SettingsView.tsx` and sub-tab components**

Implement `SettingsView.tsx` with top tab bar and sub-tab components:
- **SheetVisibilityTab**: Contains Default Intake, Default Aggregator, Default Study Level selectors (Any vs Specific option), Staff/Agent visibility toggles, and Intake Lifecycle badging.
- **UserManagementTab**: Integrates `UserManagementView` directly in-page.
- **IntakeMigrationTab**: Integrates intake rate cloning, dry-run safety preview calculation, and application deadline inputs.
- **AnnouncementsTab**: Global banner publisher & active broadcast manager.
- **DataHealthTab**: One-click projection sync button, audit log feed with CSV export, and storage health monitor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SettingsView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.tsx src/components/settings/* src/components/SettingsView.test.tsx
git commit -m "feat: create dedicated SettingsView component with 5 administrative tabs"
```

---

### Task 3: Integrate Navigation & Header Settings Link

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/AppLayout.tsx`
- Test: `src/components/AppLayout.test.tsx`

**Interfaces:**
- Consumes: `SettingsView`, `Sidebar`, `AppLayout`.
- Produces: Navigation routing to `currentPage === 'Settings'` via Admin Sidebar gear icon and Header user dropdown.

- [ ] **Step 1: Write failing test in `AppLayout.test.tsx` for Settings navigation**

```typescript
// Add test assertion in src/components/AppLayout.test.tsx
it('navigates Admin to Settings view when Settings is selected', async () => {
  // Test navigation to 'Settings' renders SettingsView title
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AppLayout.test.tsx`
Expected: FAIL due to missing 'Settings' page route in `AppLayout.tsx`.

- [ ] **Step 3: Update `Sidebar.tsx` and `AppLayout.tsx`**

In `Sidebar.tsx`: Add **Settings** (with Lucide `Settings` icon) under the Admin Overview section.
In `AppLayout.tsx`:
1. Add `currentPage === 'Settings'` route rendering `<SettingsView rates={rates} onRefreshRates={refreshRates} />`.
2. Replace header dropdown button "Sheet Visibility Manager" with "System Settings" navigating to `setCurrentPage('Settings')`.
3. Enforce role guard: If `role !== 'ADMIN'` and `currentPage === 'Settings'`, reset `currentPage` to `'Chat'`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/components/AppLayout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/AppLayout.tsx src/components/AppLayout.test.tsx
git commit -m "feat: integrate Settings page route into Admin sidebar and header menu"
```

---

### Task 4: Production Build & Live Verification

**Files:**
- Test all components and verify production build.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All unit tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Production bundle created with zero TypeScript or bundling errors.

- [ ] **Step 3: Commit and deploy**

```bash
git add .
git commit -m "build: verify production build for dedicated Settings page"
```

Deploy to live Firebase:
`npx -y firebase-tools@latest deploy`
Expected: Live deployment complete.
