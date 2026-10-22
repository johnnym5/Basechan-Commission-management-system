# Personalized Role-Based Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement personalized, role-specific notification formatting with per-school titles (e.g. *"New rate update for University of Aberdeen"*) and actionable click-to-filter CTA behavior in the Activity Center.

**Architecture:**
- Extend `UserUpdate` interface in `src/types/chat.ts` with `universityId` and `universityName`.
- Enhance `buildUserUpdateNotice` and `publishRelevantUpdates` in `src/services/userUpdates.ts` to format per-school titles and create distinct per-school notifications for multi-school edits.
- Update `AppLayout.tsx` to display a **"Check it out"** CTA button in the Activity Center and configure `handleActivityUpdateClick` to mark the notification as read, navigate to the Dashboard, and set `dashboardFilters` to display only the affected school.

**Tech Stack:** React, TypeScript, Vitest, Firestore.

**Spec:** `docs/superpowers/specs/2026-03-31-personalized-notification-system-design.md`

## Global Constraints
- **Role Isolation**: AGENT users receive notices ONLY when agent-visible fields/sheets are updated. STAFF users receive notices ONLY when staff-visible fields/sheets are updated. Pure internal Admin edits produce 0 notifications for AGENT/STAFF.
- **Filter Precision**: Clicking a notification must filter the Dashboard to display only the specific target school.

## Review Focus
- **Input/Condition 1**: Multi-school batch update published by Admin -> Program creates individual, school-specific notifications for each affected school rather than an ambiguous combined notification.
- **Input/Condition 2**: Admin modifies master rate without changing agent rate or default route -> Program generates zero notification records for AGENT or STAFF.
- **Input/Condition 3**: User clicks "Check it out" CTA on notification -> Notification is marked read, Activity drawer closes, Dashboard opens, and `dashboardFilters` contains the target school's `universityId`.

---

### Task 1: Extend `UserUpdate` Model & Per-School Notice Formatting

**Files:**
- Modify: `src/types/chat.ts`
- Modify: `src/services/userUpdates.ts`
- Test: `src/services/userUpdates.test.ts`

**Interfaces:**
- Produces: `UserUpdate` with `universityId?: string` and `universityName?: string`.
- Produces: `buildUserUpdateNotice` producing titles like `"New rate update for [School Name]"`, `"New intake update for [School Name]"`, `"New route update for [School Name]"`, `"New guidance update for [School Name]"`.

- [ ] **Step 1: Write the failing test**

In `src/services/userUpdates.test.ts`, add a test suite verifying `buildUserUpdateNotice` sets `universityId`, `universityName`, and formats per-school titles:

```typescript
it('formats per-school title and populates universityId and universityName for single school updates', () => {
  const singleSchoolRates: CommissionRate[] = [
    { id: 'rate-1', universityId: 'uni-aberdeen', universityName: 'University of Aberdeen', intake: 'Jan 2026', sourceSheet: 'Public', studyLevel: 'PG', aggregator: 'SI-UK', masterRate: 20, agentRate: 12, diffMargin: 8, isFlatFee: false, netOrGross: 'GROSS' },
  ];
  const change = { type: 'rates' as const, title: 'Commission rates updated', summary: 'Commission rate information was updated.', rates: singleSchoolRates, operationId: 'op-1' };
  const notice = buildUserUpdateNotice(change, { uid: 'agent-1', email: 'agent@example.com', role: 'AGENT' }, {});
  expect(notice).toBeDefined();
  expect(notice?.title).toBe('New rate update for University of Aberdeen');
  expect(notice?.universityId).toBe('uni-aberdeen');
  expect(notice?.universityName).toBe('University of Aberdeen');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/userUpdates.test.ts`
Expected: FAIL (title is "Commission rates updated" instead of "New rate update for University of Aberdeen", universityId is undefined).

- [ ] **Step 3: Update `src/types/chat.ts` and `src/services/userUpdates.ts`**

In `src/types/chat.ts`, add `universityId?: string; universityName?: string;` to `UserUpdate`.

In `src/services/userUpdates.ts`, update `buildUserUpdateNotice`:
```typescript
export function buildUserUpdateNotice(
  change: UpdateChange,
  recipient: UpdateRecipient,
  hiddenByRole: Record<string, Partial<Record<'AGENT' | 'STAFF', boolean>>>,
  createdAt = new Date().toISOString(),
): UserUpdate | undefined {
  const visibleRates = change.type === 'access' ? [] : filterUpdateRatesForRole(change.rates, recipient.role, hiddenByRole);
  if (change.type !== 'access' && visibleRates.length === 0) return undefined;
  const content = buildUpdateNoticeContent({ ...change, rates: visibleRates });
  const operationId = change.operationId || stableId();

  const uniqueSchoolNames = Array.from(new Set(visibleRates.map((r) => r.universityName).filter(Boolean)));
  const uniqueSchoolIds = Array.from(new Set(visibleRates.map((r) => r.universityId).filter(Boolean)));
  
  let formattedTitle = change.title;
  if (uniqueSchoolNames.length === 1) {
    const schoolName = uniqueSchoolNames[0];
    if (change.type === 'rates') formattedTitle = `New rate update for ${schoolName}`;
    else if (change.type === 'intake') formattedTitle = `New intake update for ${schoolName}`;
    else if (change.type === 'routing') formattedTitle = `New route update for ${schoolName}`;
    else if (change.type === 'guidance') formattedTitle = `New guidance update for ${schoolName}`;
  }

  return {
    id: `${operationId}-${recipient.uid}`,
    title: formattedTitle,
    summary: content.summary,
    type: change.type,
    createdAt,
    isRead: false,
    changedSchoolCount: content.changedSchoolCount,
    affectedSchoolIds: content.affectedSchoolIds,
    universityId: uniqueSchoolIds.length === 1 ? uniqueSchoolIds[0] : undefined,
    universityName: uniqueSchoolNames.length === 1 ? uniqueSchoolNames[0] : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/userUpdates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/types/chat.ts src/services/userUpdates.ts src/services/userUpdates.test.ts
git commit -m "feat: format per-school notification titles and attach universityId"
```

---

### Task 2: Implement Multi-School Split in `publishRelevantUpdates`

**Files:**
- Modify: `src/services/userUpdates.ts`
- Test: `src/services/userUpdates.test.ts`

**Interfaces:**
- Consumes: `publishRelevantUpdates(change: UpdateChange)`
- Produces: Per-school split notices when multiple schools are updated in a single operation.

- [ ] **Step 1: Write the failing test**

In `src/services/userUpdates.test.ts`, add a test for multi-school update splitting:

```typescript
it('splits multi-school changes into per-school updates when published', async () => {
  // Test that when rates for multiple schools are provided, buildUserUpdateNotice produces per-school notices when split
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/userUpdates.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement multi-school splitting in `publishRelevantUpdates`**

In `src/services/userUpdates.ts`, update `publishRelevantUpdates`:
If `change.rates` contains multiple distinct `universityId`s, split `change.rates` by `universityId` and create a notice for each school per recipient.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/userUpdates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/services/userUpdates.ts src/services/userUpdates.test.ts
git commit -m "feat: split multi-school updates into distinct per-school notifications"
```

---

### Task 3: Activity Center UI with "Check it out" CTA & Click-To-Filter Navigation

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Test: `src/components/AppLayout.test.tsx`

**Interfaces:**
- Consumes: `handleActivityUpdateClick(update: UserUpdate)`
- Produces: UI card with "Check it out" CTA button that marks notification as read, sets `dashboardFilters` to `{ ...createEmptyDashboardFilters(), schoolIds: [targetSchoolId] }`, navigates to `Dashboard`, closes the drawer, and scrolls to table.

- [ ] **Step 1: Write the failing test**

In `src/components/AppLayout.test.tsx`, write a test for notification click handling:

```typescript
it('applies school filter and navigates to dashboard when an activity update is clicked', async () => {
  // Mock subscribeToUserUpdates to emit an update with universityId: 'uni-123'
  // Click the activity update or CTA
  // Expect dashboardFilters to be set with schoolIds: ['uni-123']
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AppLayout.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `AppLayout.tsx`**

1. In `handleActivityUpdateClick`:
```typescript
const handleActivityUpdateClick = (update: UserUpdate) => {
  if (!user) return;
  
  // Mark as read if unread
  if (!update.isRead && !isLocalOnly) {
    setActivityUpdates((current) => current.map((item) => item.id === update.id ? { ...item, isRead: true } : item));
    void markUpdateRead(user.uid, update.id).catch(() => {
      setActivityUpdates((current) => current.map((item) => item.id === update.id ? { ...item, isRead: false } : item));
    });
  }

  // Navigate to Dashboard & close activity drawer
  setCurrentPage('Dashboard');
  setIsActivityOpen(false);

  // Apply school filter
  const targetSchoolId = update.universityId || update.affectedSchoolIds?.[0];
  if (targetSchoolId) {
    setDashboardFilters({
      ...createEmptyDashboardFilters(),
      schoolIds: [targetSchoolId],
    });
  } else if (update.universityName) {
    setDashboardFilters({
      ...createEmptyDashboardFilters(),
      query: update.universityName,
    });
  }

  // Scroll to results
  window.setTimeout(() => {
    document.getElementById('dashboard-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
};
```

2. In the Activity Center notification list template in `AppLayout.tsx`:
Add the **"Check it out"** CTA button inside each notification item:

```tsx
<button
  key={update.id}
  type="button"
  onClick={() => handleActivityUpdateClick(update)}
  className="group flex w-full flex-col gap-1.5 rounded-xl p-3 text-left transition hover:bg-white dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-[#222F43]"
>
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <span className={`h-2 w-2 shrink-0 rounded-full ${update.isRead ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'}`} />
      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{update.title}</span>
    </div>
    <span className="text-[10px] text-slate-400 shrink-0">{new Date(update.createdAt).toLocaleDateString()}</span>
  </div>
  <p className="pl-4 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{update.summary}</p>
  <div className="pl-4 pt-1 flex items-center justify-between">
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-amber-400 group-hover:underline">
      Check it out &rarr;
    </span>
  </div>
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AppLayout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/AppLayout.tsx src/components/AppLayout.test.tsx
git commit -m "feat: add Check It Out CTA button and school filtering to activity updates"
```
