# Firestore Read Optimization & Ultra-Low Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 3,500+ document read spike on app open by implementing aggregated sheet buckets (`rate_sheets/{sheetKey}`), cache-first IndexedDB storage, and lazy sheet loading, reducing startup reads to **1 single billable read**.

**Architecture:** Rates are stored as arrays inside 15 intake sheet bucket documents (`rate_sheets/{sheetKey}`). On app open, the client loads cached rates from browser IndexedDB (0 reads) and queries a single timestamp document (`settings/system_config`) to verify sync (1 read), fetching updated or active sheet bucket documents on-demand.

**Tech Stack:** React, TypeScript, Vitest, Firebase Firestore (SDK v10+), IndexedDB, Tailwind CSS.

**Spec:** [2026-10-12-firestore-read-optimization-design.md](file:///C:/Users/HP/Documents/CODING/BASECHAN%20COMMISSION%20MANAGEMENT%20SYSTEM/docs/superpowers/specs/2026-10-12-firestore-read-optimization-design.md)

## Global Constraints

- **Single Document Reads**: Opening the app MUST perform at most 1 billable Firestore read on warm startup.
- **Data Integrity**: Sheet buckets MUST maintain complete compatibility with all `CommissionRate` fields (`id`, `universityName`, `intake`, `studyLevel`, `masterRate`, `agentRate`, `diffMargin`, `isFlatFee`, `guidance`, `aggregator`).
- **100% Test Pass Rate**: All 222+ existing unit tests must remain green.

## Review Focus

1. **Empty Local Cache (Cold Start)**: On first install, the system fetches the active default sheet bucket in 1 read, populating IndexedDB.
2. **Warm Cache (App Re-Open)**: Serves cached rates in <50ms from IndexedDB; validates `ratesLastUpdatedAt` timestamp doc (1 read).
3. **Multi-Tab Synchronization**: Updates to sheet buckets in 1 tab invalidate cache and re-sync across open tabs smoothly.
4. **Offline Mode Resilience**: When offline or quota-exceeded, loads cached sheet buckets from IndexedDB without throwing network errors.
5. **Rate Mutation Updates**: Adding, editing, or deleting a rate updates both canonical models and the corresponding `rate_sheets/{sheetKey}` bucket doc.

---

### Task 1: Rate Sheet Bucket Data Schema & Aggregation Utilities

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/rateReadModels.ts`
- Test: `src/services/rateReadModels.test.ts`

**Interfaces:**
- Produces: `RateSheetBucket` type in `src/types/index.ts`:
  ```ts
  export interface RateSheetBucket {
    sheetKey: string;
    sheetName: string;
    rateCount: number;
    updatedAt: string;
    updatedBy: string;
    rates: CommissionRate[];
  }
  ```
- Produces: `buildRateSheetBucket(sheetName: string, rates: CommissionRate[], userEmail: string): RateSheetBucket` in `src/services/rateReadModels.ts`

- [ ] **Step 1: Write the failing unit tests for `buildRateSheetBucket`**

Add tests in `src/services/rateReadModels.test.ts`:
```ts
it('buildRateSheetBucket generates valid bucket document payload from rates', () => {
  const sampleRates = [{ id: 'r1', universityName: 'Uni A', intake: 'Sept 2026' } as any];
  const bucket = buildRateSheetBucket('Sept 2026', sampleRates, 'admin@test.com');
  expect(bucket.sheetKey).toBe('sept_2026');
  expect(bucket.rateCount).toBe(1);
  expect(bucket.rates[0].id).toBe('r1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/rateReadModels.test.ts`
Expected: FAIL with `buildRateSheetBucket is not defined`

- [ ] **Step 3: Implement `RateSheetBucket` type and `buildRateSheetBucket` function**

In `src/types/index.ts` export `RateSheetBucket`.
In `src/services/rateReadModels.ts` implement `buildRateSheetBucket(sheetName, rates, userEmail)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/rateReadModels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/rateReadModels.ts src/services/rateReadModels.test.ts
git commit -m "feat: add RateSheetBucket schema and builder utilities"
```

---

### Task 2: Cache-First Sync Engine & Sheet Bucket Persistence

**Files:**
- Modify: `src/services/rateSyncService.ts`
- Modify: `src/services/localRateDatabase.ts`
- Test: `src/services/rateSyncService.test.ts`

**Interfaces:**
- Consumes: `RateSheetBucket` from `src/types/index.ts`
- Produces: `syncRateSheetsCacheFirst(scope: RateSyncScope): Promise<CommissionRate[]>` in `src/services/rateSyncService.ts`
- Produces: `saveLocalSheetBucket(sheetKey: string, bucket: RateSheetBucket): Promise<void>` in `src/services/localRateDatabase.ts`
- Produces: `getLocalSheetBucket(sheetKey: string): Promise<RateSheetBucket | null>` in `src/services/localRateDatabase.ts`

- [ ] **Step 1: Write failing unit tests for IndexedDB sheet bucket storage and cache-first sync**

In `src/services/rateSyncService.test.ts`:
```ts
it('syncRateSheetsCacheFirst loads cached sheet buckets from local database when timestamp is unchanged', async () => {
  const rates = await syncRateSheetsCacheFirst({ uid: 'user-1', role: 'STAFF' });
  expect(Array.isArray(rates)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/rateSyncService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement IndexedDB bucket helpers and `syncRateSheetsCacheFirst`**

In `src/services/localRateDatabase.ts`: Implement `saveLocalSheetBucket` and `getLocalSheetBucket`.
In `src/services/rateSyncService.ts`: Implement `syncRateSheetsCacheFirst`, querying IndexedDB first and `settings/system_config` timestamp doc for verification.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/rateSyncService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/localRateDatabase.ts src/services/rateSyncService.ts src/services/rateSyncService.test.ts
git commit -m "feat: implement cache-first sheet bucket sync engine"
```

---

### Task 3: Hook Integration & End-to-End Verification

**Files:**
- Modify: `src/hooks/useCommissionRates.ts`
- Test: `src/hooks/useCommissionRates.test.ts`

**Interfaces:**
- Consumes: `syncRateSheetsCacheFirst` from `src/services/rateSyncService.ts`
- Produces: Updated `useCommissionRates` hook serving ultra-low read rate data to dashboard components.

- [ ] **Step 1: Write failing unit test for `useCommissionRates` cache-first integration**

In `src/hooks/useCommissionRates.test.ts`:
```ts
it('useCommissionRates serves rates via cache-first sync without triggering full collection scans', async () => {
  const { result } = renderHook(() => useCommissionRates('user-1', 'STAFF'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(Array.isArray(result.current.rates)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useCommissionRates.test.ts`
Expected: FAIL

- [ ] **Step 3: Wire `useCommissionRates` to use `syncRateSheetsCacheFirst`**

In `src/hooks/useCommissionRates.ts`: Replace direct un-paginated `getDocsFromServer` calls with `syncRateSheetsCacheFirst`.

- [ ] **Step 4: Run full Vitest suite & build check**

Run: `npm test && npm run build`
Expected: ALL tests PASS and 0 build errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCommissionRates.ts src/hooks/useCommissionRates.test.ts
git commit -m "feat: integrate ultra-low read cache-first engine into useCommissionRates"
```
