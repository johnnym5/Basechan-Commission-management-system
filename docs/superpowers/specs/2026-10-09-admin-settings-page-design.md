# Dedicated Admin Settings Page Design

**Status:** Proposed
**Date:** 2026-10-09
**Target:** Dedicated System Settings Page (`src/components/SettingsView.tsx`)

---

## 1. Executive Summary & Purpose

Transform the current quick `SheetVisibilityModal` popover into a comprehensive, dedicated **Admin System Settings Page** (`SettingsView.tsx`).

The Settings page serves as the centralized command center for Admin users (`@basechaninternational.com`) to manage:
1. **Sheet & Intake Visibility & Global Default Filters** (Default Intake, Default Aggregator, Default Study Level, Staff/Agent Visibility, Intake Badging).
2. **User Management & Agency Access** (Pending/Approved/Rejected/Revoked queue, Organization creation, One-click bulk actions, Override badges).
3. **Intake Management & Migration** (Intake rate cloning engine, Dry-run safety preview, Intake term migration, Application deadline rules).
4. **System Announcements & Broadcast Updates** (Global banner publisher, Targeted role updates).
5. **Data Health, Audit Logs & System Maintenance** (Role projection rebuilds, Embedded audit log viewer with CSV export, Firestore quota/cache diagnostics).

---

## 2. Navigation & User Access

### Access Control
* **Admin Exclusive:** Restricted strictly to authenticated users belonging to the Admin domain (`@basechaninternational.com`). Non-admin users (Staff or Agents) who attempt to navigate to `currentPage === 'Settings'` are automatically redirected to their role home page (`Chat`).

### Entry Points
1. **Admin Sidebar:** Dedicated **Settings** navigation item with a gear icon (`Settings` / `SlidersHorizontal`) placed in the Admin navigation group.
2. **Header User Menu:** Replacing the old `Sheet Visibility Manager` popup item in the top-right profile dropdown with a direct link to **System Settings**.

---

## 3. Dedicated Settings Page Structure & Tab Layout

`SettingsView.tsx` will render a modern, responsive executive dashboard with 5 primary top tabs:

```
[ 🏷️ Sheet & Default Filters ] [ 👥 Users & Agencies ] [ 🔄 Intake & Migration ] [ 📢 Announcements ] [ 🛡️ Data Health & Audit ]
```

---

### Tab 1: 🏷️ Sheet & Global Default Filters

#### Features:
1. **Expanded Global Default Filters (Open to Any or Lock to Specific):**
   * **Default Main Intake:** Select a specific intake (e.g. `Sept 2026`) or leave open to `ALL / Any Intake`.
   * **Default Aggregator:** Select a specific default aggregator (e.g. `UAP`, `EDVOY`, `CRIZAC`, `SI-UK`) or leave open to `ALL / Any Aggregator`.
   * **Default Study Level:** Select a specific default level (`UG`, `PG`, `Foundation`, `PhD`) or leave open to `ALL / Any Level`.
2. **Sheet Visibility Matrix:**
   * Enable or Disable specific sheets for **Staff** and **Agents** independently.
   * View live rate counts for each sheet.
3. **Intake Lifecycle Badging:**
   * Tag intake sheets with status badges: `Active Enrollment`, `Closing Soon`, or `Archived`.
   * Archiving an intake hides older sheets from default daily views while retaining underlying rate data.
4. **Default Display & Sorting Preferences:**
   * Configure default Agent display mode (`Card Grid` vs `Compact Table`).
   * Set default sorting field (`University Name`, `Commission Rate %`, or `Guidance Status`).

---

### Tab 2: 👥 User & Organization Access

#### Features:
1. **Access Request Queue:**
   * Filterable queues for `Pending`, `Approved`, `Rejected`, and `Revoked` Agent requests.
2. **Agency & Organization Management:**
   * Create new agency records, rename existing organizations, and reassign Agents.
3. **One-Click Bulk Actions:**
   * Multi-select pending requests to approve or assign to an agency in a single batch action.
4. **Organization Rate Override Indicator:**
   * Badge next to agencies displaying whether custom negotiated rate overrides are active.

---

### Tab 3: 🔄 Intake Management & Migration

#### Features:
1. **Intake Rate Cloning Engine:**
   * Clone all rates from a source intake (e.g. `Sept 2025`) to a new target intake (e.g. `Sept 2026`).
   * Optional percentage or flat fee adjustment during cloning (e.g. increase all cloned rates by +1.5%).
2. **Migration Safety Dry-Run Preview:**
   * Pre-execution modal showing exact counts of affected rates, universities, and aggregators *before* applying writes.
3. **Intake Term Rename & Consolidation:**
   * Safely update intake names across canonical rates and role projections.
4. **Application Deadline Rules:**
   * Configure application closing dates per intake term (e.g. `Sept 2026 closes Oct 15`), automatically broadcasting countdown alerts on Staff & Agent portals.

---

### Tab 4: 📢 System Announcements & Broadcast Updates

#### Features:
1. **Global Banner Publisher:**
   * Create top-banner announcements visible across the entire platform.
2. **Targeted Role Broadcasts:**
   * Publish notification notices targeting specific organizations, all Agents, or all Staff members.
3. **Active Announcement Manager:**
   * Edit, deactivate, or delete active announcements with expiry dates.

---

### Tab 5: 🛡️ Data Health, Audit & Maintenance

#### Features:
1. **Projection Sync & Rebuild:**
   * Trigger full or incremental rebuilds of `staff_rates` and `agent_rates` role projections.
2. **Embedded Audit Trail & Activity Feed:**
   * Filterable audit log showing recent Admin actions (rate edits, user access changes, sheet visibility toggles) with a **Export Audit Log (CSV)** button.
3. **Storage & Quota Health Diagnostics:**
   * Display real-time Firestore connectivity, local IndexedDB cache health, and quota state.

---

## 4. Data Models & Firestore State

### Firestore Document: `system_config/defaults`
```typescript
export interface SystemConfigDefaults {
  defaultIntake: string;          // 'ALL' or specific intake name
  defaultAggregator: string;      // 'ALL' or specific aggregator name
  defaultStudyLevel: string;      // 'ALL' or specific study level name
  defaultViewMode: 'cards' | 'table';
  defaultSortBy: string;
  updatedAt: string;
  updatedBy: string;
}
```

### Firestore Document: `system_config/intake_lifecycles`
```typescript
export interface IntakeLifecycleSetting {
  sheetName: string;
  status: 'active' | 'closing' | 'archived';
  applicationDeadline?: string | null;
  updatedAt: string;
  updatedBy: string;
}
```

### Firestore Document: `system_announcements/{announcementId}`
```typescript
export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  targetRole: 'ALL' | 'STAFF' | 'AGENT' | string; // 'ALL', 'STAFF', 'AGENT', or organizationId
  isBanner: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  expiresAt?: string | null;
}
```

---

## 5. Verification & Testing Plan

1. **Unit Tests:**
   * Test `useSystemConfig` hook for updating and reading default filters (`defaultIntake`, `defaultAggregator`, `defaultStudyLevel`).
   * Test dry-run calculation logic during intake cloning to verify accurate affected counts before Firestore writes.
   * Test role access guard to ensure non-Admin users cannot render `SettingsView`.

2. **Integration Verification:**
   * Verify navigation from Admin Sidebar gear icon and Header user dropdown into `currentPage === 'Settings'`.
   * Verify updating a default filter (e.g. setting Default Aggregator to `UAP`) instantly reflects on new visits.
   * Verify live Firestore deployment and security rules.
