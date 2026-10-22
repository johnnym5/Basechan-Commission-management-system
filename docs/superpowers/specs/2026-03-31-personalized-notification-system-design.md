# Personalized Role-Based Notification System Design

## Overview
This specification details the architecture for personalizing user notifications based on user roles (`AGENT`, `STAFF`, `ADMIN`) and turning notifications into actionable events with one-click filtering.

When an Admin makes changes to commission rates, intakes, guidance, or default routes:
1. Notifications are formatted per-school with clear titles (e.g., *"New rate update for University of Aberdeen"*).
2. Updates are filtered so users only receive notifications relevant to their role and permitted sheets. Pure internal Admin changes produce zero notifications for Agents and Staff.
3. Clicking a notification or its *"Check it out"* CTA marks it as read, opens the Dashboard, and filters the table to show only the affected school.

---

## Requirements & Scope

### 1. Role-Based Relevance Filtering
- **Agent Relevance Gate**:
  - Notifications published to `AGENT` users only when agent-visible fields are modified (`agentRate`, `isFlatFee`, `netOrGross`, `guidance`, `intake`, `studyLevel`, `sourceSheet`).
  - Sheet visibility settings (`disabledForAgents !== true`) are respected.
  - Internal Admin edits (e.g., modifying `masterRate` or `diffMargin` without changing `agentRate`) produce 0 notifications for Agents.
- **Staff Relevance Gate**:
  - Notifications published to `STAFF` users only when staff-visible fields are modified (`aggregator`, `isDefaultRoute`, `guidance`, `intake`, `studyLevel`, `sourceSheet`).
  - Sheet visibility settings (`disabledForStaff !== true`) are respected.
  - Changes purely affecting agent payout structures or internal master rates produce 0 notifications for Staff.

### 2. Specific Titling & Data Model
- **`UserUpdate` Data Model (`src/types/chat.ts`)**:
  - Extended with `universityId?: string` and `universityName?: string` fields alongside existing `affectedSchoolIds?: string[]`.
- **Title Construction (`src/services/adminRateWriteService.ts` & `src/services/userUpdates.ts`)**:
  - When 1 school is changed or batch changes are processed per school:
    - Rate updates: `"New rate update for [School Name]"`
    - Intake updates: `"New intake update for [School Name]"`
    - Route/aggregator updates: `"New route update for [School Name]"`
    - Guidance updates: `"New guidance update for [School Name]"`
  - Summaries detail the specific change (e.g., *"Agent rate updated for Jan 2026 intake"* or *"Default route changed to SI-UK"*).

### 3. Activity Center UI & Click-To-Filter CTA
- **Activity Drawer Item (`src/components/AppLayout.tsx`)**:
  - Unread indicator dot (blue for unread).
  - Explicit **"Check it out"** CTA button with an arrow icon.
- **Click Action (`handleActivityUpdateClick`)**:
  1. Marks the update as read in Firestore (`markUpdateRead(user.uid, update.id)`).
  2. Updates local activity list state.
  3. Closes Activity Center popover.
  4. Navigates to `Dashboard` view (`setCurrentPage('Dashboard')`).
  5. Sets `dashboardFilters` to `{ ...createEmptyDashboardFilters(), schoolIds: [targetSchoolId] }` (with fallback to `query: universityName`).
  6. Smooth-scrolls to the `#dashboard-results` table.

---

## Architectural Changes

```
Admin Mutation (Add/Edit/Batch Rate)
       │
       ▼
adminRateWriteService.ts
       │ (Calculates changed fields & role relevance)
       ▼
userUpdates.ts (publishRelevantUpdates)
       │
       ├── Filters recipients by role & sheet visibility
       ├── Formats per-school titles & sets universityId
       └── Writes to users/{uid}/updates/{id} in Firestore
       │
       ▼
AppLayout.tsx (Activity Center Popover)
       │
       ├── Real-time listener: subscribeToUserUpdates
       ├── Renders cards with "Check it out" CTA
       └── On click: markUpdateRead + setDashboardFilters + scroll
```

---

## Verification & Testing Strategy
1. **Unit & Service Tests**:
   - `userUpdates.test.ts`: Verify `buildUserUpdateNotice` generates per-school titles and includes `universityId`.
   - Test recipient selection filters out AGENT users when only `masterRate` is changed.
   - Test recipient selection filters out STAFF users when only `agentRate` is changed.
   - Test sheet visibility settings disable updates for hidden sheets.
2. **UI Tests (`AppLayout.test.tsx`)**:
   - Test clicking a notification calls `markUpdateRead` and sets `dashboardFilters` with `schoolIds`.
